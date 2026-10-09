import {
  ILLUSTRATIONS_CACHE,
  ILLUSTRATIONS_CACHE_PREFIX,
  SHELL_CACHE_PREFIX,
} from '../src/sw/precache-manifest';
import { acrossReload, BUILD_DIRS } from './support/builds';
import { expect, test } from './support/fixtures';
import { setupOnboardedAdmin } from './support/flows';
import {
  cacheNames,
  fakeOutboxOp,
  idbGetAll,
  idbPut,
  metaValue,
  registrationCount,
  waitForController,
} from './support/pwa';

const SHELL_CACHE_RE = /^shell-[0-9a-f]{12}$/;
/** Fenêtre sans rechargement qui prouve l'absence de boucle, une fois l'interrupteur appliqué. */
const NO_LOOP_MS = 3_000;

test.use({ serverOptions: { publicDir: BUILD_DIRS.A } });

// 01 §9.1.6 scénario 6 : interrupteur d'urgence (R-PWA-6) : désenregistrement, caches vidés, rechargement
// unique depuis le réseau, IndexedDB intact ; puis retour du SW une fois l'interrupteur levé.
test("interrupteur d'urgence : SW et caches retirés sans boucle, base intacte, puis SW rétabli", async ({
  server,
  context,
}) => {
  const page = await setupOnboardedAdmin(server, context);
  const userId = await metaValue(page, 'userId');
  if (typeof userId !== 'string') throw new Error("meta.userId absent après l'onboarding");
  const op = fakeOutboxOp(userId);
  const doomed = async () =>
    (await cacheNames(page)).filter(
      (n) => n.startsWith(SHELL_CACHE_PREFIX) || n.startsWith(ILLUSTRATIONS_CACHE_PREFIX),
    );
  const controlled = () => page.evaluate(() => navigator.serviceWorker?.controller != null);

  await test.step('opération en attente, coquille et illustrations en cache', async () => {
    // La panne d'abord : sinon le moteur pousserait l'opération avant elle.
    server.setFault({
      kind: 'status',
      pathPrefix: '/api/sync/push',
      status: 503,
      body: { error: 'internal' },
    });
    await idbPut(page, 'outbox', op);
    const names = await cacheNames(page);
    expect(names).toContain(ILLUSTRATIONS_CACHE);
    expect(names.filter((n) => SHELL_CACHE_RE.test(n))).toHaveLength(1);
  });

  await test.step('interrupteur actif : plus de SW ni de caches, page affichée, pas de boucle', async () => {
    // Chargements de document de la page (requêtes de navigation, chemin seul) : une navigation dans le
    // même document (replaceState du routeur) n'en fait pas, un chargement coupé par un autre en fait une.
    const navigations: string[] = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        navigations.push(new URL(request.url()).pathname);
    });
    // Même build A sur le serveur et dans le cache : le libellé ne dirait pas d'où vient la page, le
    // contrôleur si (un document servi par le SW A en désinstallation reste contrôlé par lui).
    await server.restart({ SW_KILL_SWITCH: '1' });
    // `commit` : la navigation de l'interrupteur peut partir avant le DOMContentLoaded du rechargement.
    await page.reload({ waitUntil: 'commit' });
    // Le rechargement demandé, puis celui de l'interrupteur (par le SW ou par la page, R-PWA-6).
    await expect.poll(() => navigations.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => acrossReload(page, () => registrationCount(page)), { timeout: 15_000 }).toBe(0);
    await expect.poll(() => acrossReload(page, doomed), { timeout: 15_000 }).toEqual([]);
    // Page rechargée depuis le réseau, à son adresse, hors de tout SW, et appli démarrée.
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.getByTestId('connection-status')).toBeVisible();
    expect(await controlled()).toBe(false);
    // Aucun rechargement de plus : le témoin posé dans la page survit à la fenêtre.
    await page.evaluate(() => {
      (window as { e2eSameDocument?: boolean }).e2eSameDocument = true;
    });
    await page.waitForTimeout(NO_LOOP_MS);
    // Rechargement unique : celui demandé plus un seul de l'interrupteur, sur toute l'étape.
    expect(navigations, 'chargements depuis le rechargement demandé, interrupteur compris').toEqual([
      '/',
      '/',
    ]);
    expect(await page.evaluate(() => (window as { e2eSameDocument?: boolean }).e2eSameDocument)).toBe(true);
    expect(await registrationCount(page)).toBe(0);
    expect(await controlled()).toBe(false);
  });

  await test.step('IndexedDB jamais touché', async () => {
    expect((await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId)).toEqual([op.opId]);
    expect(await metaValue(page, 'userId')).toBe(userId);
  });

  await test.step('interrupteur levé : le SW revient et contrôle la page', async () => {
    await server.restart({ SW_KILL_SWITCH: '' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForController(page);
    expect(await registrationCount(page)).toBe(1);
  });
});

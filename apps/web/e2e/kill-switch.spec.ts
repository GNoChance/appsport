import {
  ILLUSTRATIONS_CACHE,
  ILLUSTRATIONS_CACHE_PREFIX,
  SHELL_CACHE_PREFIX,
} from '../src/sw/precache-manifest';
import { acrossReload, BUILD_DIRS, shellLabel } from './support/builds';
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
  if (typeof userId !== 'string') throw new Error('meta.userId absent après l’onboarding');
  const op = fakeOutboxOp(userId);
  const doomed = async () =>
    (await cacheNames(page)).filter(
      (n) => n.startsWith(SHELL_CACHE_PREFIX) || n.startsWith(ILLUSTRATIONS_CACHE_PREFIX),
    );

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
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await server.restart({ SW_KILL_SWITCH: '1' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Le rechargement demandé, puis celui de l'interrupteur (par le SW ou par la page, R-PWA-6).
    await expect.poll(() => navigations, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => acrossReload(page, () => registrationCount(page)), { timeout: 15_000 }).toBe(0);
    await expect.poll(() => acrossReload(page, doomed), { timeout: 15_000 }).toEqual([]);
    // Page servie par le réseau, appli démarrée.
    await expect(page.getByTestId('connection-status')).toBeAttached();
    expect(await shellLabel(page)).toBe('A');
    // Aucun rechargement de plus : aucune navigation et le témoin posé dans la page survit.
    const before = navigations;
    await page.evaluate(() => {
      (window as { e2eSameDocument?: boolean }).e2eSameDocument = true;
    });
    await page.waitForTimeout(NO_LOOP_MS);
    expect(navigations - before, 'navigations après l’interrupteur').toBe(0);
    expect(await page.evaluate(() => (window as { e2eSameDocument?: boolean }).e2eSameDocument)).toBe(true);
    expect(await registrationCount(page)).toBe(0);
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

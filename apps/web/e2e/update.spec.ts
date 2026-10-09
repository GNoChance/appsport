import { LOCAL_DB_VERSION } from '../src/local-db/db';
import { SHELL_CACHE_PREFIX } from '../src/sw/precache-manifest';
import { BUILD_DIRS, loadBuilds, shellLabel } from './support/builds';
import { expect, test } from './support/fixtures';
import { setupOnboardedAdmin } from './support/flows';
import {
  cacheNames,
  fakeOutboxOp,
  idbGetAll,
  idbPut,
  idbVersion,
  metaValue,
  swStatus,
  waitForWaitingWorker,
} from './support/pwa';
import type { E2EFault } from './support/server';

// Navigation servie par le SW : bornée, pour qu'une régression nomme l'étape et non le délai du test.
const SHELL_TIMEOUT_MS = 10_000;
/** Séance en cours simulée (R-PWA-3) : l'écran de séance relève de la brique 3. */
const SESSION_ID = 'seance-e2e';
/** Push refusé : l'opération reste dans l'outbox jusqu'à la fin du test. */
const PUSH_FAULT: E2EFault = {
  kind: 'status',
  pathPrefix: '/api/sync/push',
  status: 503,
  body: { error: 'internal' },
};

test.use({ serverOptions: { publicDir: BUILD_DIRS.A } });

// 01 §9.1.6 scénario 4 (séance simulée par meta.activeSessionId) : build A installé, build B déployé ;
// R-PWA-2, R-PWA-3, R-PWA-4, R-PWA-8, R-VER-4 ; Review Focus 5 (coquille A servie tant que B attend).
test('mise à jour : B attend pendant la séance, puis remplace A au clic sans toucher la base', async ({
  server,
  context,
  browserName,
}) => {
  const { a, b } = await loadBuilds();
  expect(a.buildHash).not.toBe(b.buildHash);
  const page = await setupOnboardedAdmin(server, context);
  const banner = page.getByTestId('update-banner');
  const label = () => shellLabel(page);
  const reload = () => page.reload({ waitUntil: 'domcontentloaded', timeout: SHELL_TIMEOUT_MS });
  expect(await label()).toBe('A');

  const userId = await metaValue(page, 'userId');
  if (typeof userId !== 'string') throw new Error("meta.userId absent après l'onboarding");
  const op = fakeOutboxOp(userId);

  await test.step('séance en cours et opération en attente sur A', async () => {
    // La panne d'abord : sinon le moteur pousserait l'opération avant elle.
    server.setFault(PUSH_FAULT);
    await idbPut(page, 'outbox', op);
    await idbPut(page, 'meta', { key: 'activeSessionId', value: SESSION_ID });
  });

  await test.step('B déployé : il attend, la coquille A reste servie, pas de bandeau en séance', async () => {
    await server.restart({ APPSPORT_PUBLIC_DIR: b.dir });
    await reload();
    await waitForWaitingWorker(page);
    expect(await label()).toBe('A');
    // R-PWA-3 : ni tout de suite, ni une fois le SW en attente évalué (réponse à GET_STATUS en 1 s au plus).
    await expect(banner).toHaveCount(0);
    await page.waitForTimeout(3_000);
    await expect(banner).toHaveCount(0);
  });

  await test.step('Review Focus 5 : rechargé à froid en ligne puis sans réseau, A tant que B attend', async () => {
    // Le label vient d'une meta d'index.html, présente même si le JS ou le CSS ne charge pas : on vérifie
    // aussi que l'application s'est affichée (R-PWA-8), et son état hors ligne quand le réseau est coupé.
    const connection = page.getByTestId('connection-status');
    await reload();
    expect(await label()).toBe('A');
    await expect(connection).toBeVisible({ timeout: SHELL_TIMEOUT_MS });
    // Requêtes sans réponse (VPN coupé) : la coquille vient du cache, identique sous Chromium et WebKit.
    server.setFault({ kind: 'blackhole' });
    await reload();
    expect(await label()).toBe('A');
    await expect(connection).toBeVisible({ timeout: SHELL_TIMEOUT_MS });
    // navigator.onLine reste vrai : 'unknown' tant que la première requête n'a pas expiré, puis 'offline'.
    await expect(connection).toHaveAttribute('data-state', /^(offline|unknown)$/);
    // Requêtes retenues libérées, puis la panne du push rétablie, sans requête traitée entre les deux.
    server.setFault(null);
    server.setFault(PUSH_FAULT);
    if (browserName === 'webkit') {
      test.info().annotations.push({
        type: 'webkit-setOffline',
        description:
          'context.setOffline(true) + rechargement non exécuté sous WebKit : toute navigation sous le hors-ligne ' +
          'émulé y échoue (« WebKit encountered an internal error »), même servie par le SW (constaté en T38). ' +
          'Le rechargement à froid sans réseau y est couvert par le trou noir du proxy ci-dessus (01 §9.1.6, Review Focus 5).',
      });
    } else {
      await context.setOffline(true);
      await reload();
      expect(await label()).toBe('A');
      await expect(connection).toBeVisible({ timeout: SHELL_TIMEOUT_MS });
      await expect(connection).toHaveAttribute('data-state', 'offline', { timeout: 5_000 });
      await context.setOffline(false);
    }
    await waitForWaitingWorker(page);
  });

  await test.step('séance finie : bandeau fermable, puis B au clic', async () => {
    await idbPut(page, 'meta', { key: 'activeSessionId', value: null });
    await reload();
    expect(await label()).toBe('A');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toHaveAttribute('data-dismissible', 'true');
    await banner.getByRole('button', { name: 'Mettre à jour', exact: true }).click();
    // R-PWA-4 : SKIP_WAITING, activation de B puis rechargement de la page.
    await expect.poll(label, { timeout: 20_000 }).toBe('B');
    await expect.poll(async () => (await swStatus(page))?.buildHash, { timeout: 20_000 }).toBe(b.buildHash);
  });

  await test.step('base intacte, ancienne coquille purgée, plus de bandeau', async () => {
    // R-VER-4 : aucune opération jetée ; R-PWA-4 : IndexedDB jamais effacé (même schéma en A et B).
    expect((await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId)).toEqual([op.opId]);
    expect(await idbVersion(page)).toBe(LOCAL_DB_VERSION * 10);
    expect(await metaValue(page, 'userId')).toBe(userId);
    // Seuls les shell-* : illustrations-v1 et le marqueur appsport-meta (ADR 0001 décision 5) restent.
    await expect
      .poll(async () => (await cacheNames(page)).filter((n) => n.startsWith(SHELL_CACHE_PREFIX)))
      .toEqual([`${SHELL_CACHE_PREFIX}${b.buildHash}`]);
    await expect(banner).toHaveCount(0);
  });
});

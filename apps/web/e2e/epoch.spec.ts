import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { PRIVACY_POLICY_VERSION } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { E2E_PASSWORD, loginViaUi } from './support/flows';
import { idbGetAll, metaValue, triggerForeground } from './support/pwa';
import { bootstrapAdmin, type E2EServer } from './support/server';

const SYNC_TIMEOUT = { timeout: 20_000 };

/**
 * Administrateur créé par l'API (amorçage, compte, profil avec son coach, lieu maison, fin de l'onboarding),
 * sans accord santé. Sans coach, le serveur refuse de terminer l'onboarding.
 */
async function createAdminViaApi(server: E2EServer, page: Page): Promise<void> {
  const { code } = await bootstrapAdmin(server);
  const call = async (method: 'POST' | 'PATCH', path: string, data: unknown, status: number) => {
    const res = await page.request.fetch(`${server.url}${path}`, {
      method,
      headers: { Origin: server.url },
      data,
    });
    expect(res.status(), `${method} ${path}`).toBe(status);
  };
  await call(
    'POST',
    '/api/invitations/accept',
    { code, username: 'camille', password: E2E_PASSWORD, termsVersion: PRIVACY_POLICY_VERSION },
    201,
  );
  await call(
    'PATCH',
    '/api/me/training-profile',
    {
      coach: 'skald',
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      onboardingStep: 'health',
    },
    200,
  );
  await call('POST', '/api/places', { kind: 'home', equipment: [], isPrimary: true }, 201);
  await call('POST', '/api/me/onboarding/complete', {}, 200);
}

async function serverEpoch(server: E2EServer, page: Page): Promise<string> {
  const res = await page.request.get(`${server.url}/api/health`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { epoch: string }).epoch;
}

/** `daysPerWeek` du miroir local du profil, après un cycle de synchro déclenché. */
async function mirroredDaysPerWeek(page: Page): Promise<unknown> {
  await triggerForeground(page);
  const [profile] = await idbGetAll<{ daysPerWeek: number }>(page, 'training_profile');
  return profile?.daysPerWeek;
}

/** Époque locale et époque du filigrane (`<époque>:…`), après un cycle de synchro déclenché. */
async function localEpochs(page: Page): Promise<{ serverEpoch: unknown; watermarkEpoch: string }> {
  await triggerForeground(page);
  const serverEpoch = await metaValue(page, 'serverEpoch');
  const watermark = await metaValue(page, 'watermark');
  return {
    serverEpoch,
    watermarkEpoch: typeof watermark === 'string' ? (watermark.split(':')[0] ?? '') : '',
  };
}

// 01 §9.1.6 scénario 7 ; 08 §12 P4 (a) ; R-SYN-25, R-SYN-26, R-SYN-28 : instantané, modification de classe E,
// restauration avec nouvelle époque, puis le téléphone repart de la base restaurée (le serveur fait foi).
test('époque : restauration, nouvelle époque et pull complet sans perte de session', async ({
  server,
  context,
  page,
}) => {
  test.setTimeout(180_000);
  const denied: string[] = [];
  const replays: string[] = [];
  let fullPulls = 0;
  context.on('response', (res) => {
    if (res.status() === 401 || res.status() === 410) denied.push(`${res.status()} ${res.url()}`);
  });
  context.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.endsWith('/consents/health/replay-withdraw')) replays.push(url.pathname);
    if (url.pathname === '/api/sync/pull' && !url.searchParams.has('since')) fullPulls += 1;
  });
  const connection = page.getByTestId('connection-status');

  const epoch1 = await test.step("admin créé par l'API, appli en ligne sur l'époque 1", async () => {
    await createAdminViaApi(server, page);
    const epoch = await serverEpoch(server, page);
    // Une session n'est adoptée par l'appli (meta.userId) qu'à la connexion depuis l'écran.
    await page.goto(`${server.url}/login`);
    await loginViaUi(page, 'camille');
    await expect(page).toHaveURL(`${server.url}/`);
    await expect(connection).toHaveAttribute('data-state', 'online', SYNC_TIMEOUT);
    await expect.poll(() => metaValue(page, 'serverEpoch'), SYNC_TIMEOUT).toBe(epoch);
    await expect.poll(() => mirroredDaysPerWeek(page), SYNC_TIMEOUT).toBe(3);
    return epoch;
  });

  const since = new Date().toISOString();
  const snapshot = await test.step('instantané quotidien, puis profil modifié (4 jours)', async () => {
    const snap = await server.cli(['snapshot', '--tag', 'daily']);
    expect(snap.code, snap.stderr).toBe(0);
    const path = /^Instantané écrit : (.+)$/m.exec(snap.stdout)?.[1]?.trim();
    if (!path) throw new Error('snapshot : ligne « Instantané écrit : » absente');
    const res = await page.request.patch(`${server.url}/api/me/training-profile`, {
      headers: { Origin: server.url },
      data: { daysPerWeek: 4 },
    });
    expect(res.status()).toBe(200);
    await expect.poll(() => mirroredDaysPerWeek(page), SYNC_TIMEOUT).toBe(4);
    return path;
  });

  const epoch2 =
    await test.step('P4 (a) : privacy:collect, arrêt, restore, privacy:reapply, redémarrage', async () => {
      const list = join(server.dataDir, 'privacy-events.json');
      const collect = await server.cli(['privacy:collect', '--since', since, '--out', list]);
      expect(collect.code, collect.stderr).toBe(0);
      await server.stop();
      // Seuls comptent les pulls complets faits sur la base restaurée.
      fullPulls = 0;
      const restore = await server.cli(['restore', snapshot]);
      expect(restore.code, restore.stderr).toBe(0);
      const epoch = /^Restauration terminée\. Nouvelle époque : ([0-9a-f-]{36}) /m.exec(restore.stdout)?.[1];
      if (!epoch) throw new Error('restore : ligne « Restauration terminée » absente');
      const reapply = await server.cli(['privacy:reapply', list]);
      expect(reapply.code, reapply.stderr).toBe(0);
      await server.restart();
      expect(await serverEpoch(server, page)).toBe(epoch);
      return epoch;
    });
  expect(epoch2).not.toBe(epoch1);

  await test.step('nouvelle époque adoptée par la page ouverte, un seul pull complet', async () => {
    // Le pull complet est terminé (filigrane de l'époque 2 écrit) avant tout rechargement : un rechargement
    // qui l'interromprait en ferait partir un second (R-SYN-26).
    await expect
      .poll(() => localEpochs(page), SYNC_TIMEOUT)
      .toEqual({ serverEpoch: epoch2, watermarkEpoch: epoch2 });
    expect(fullPulls, 'un seul pull complet sur la base restaurée').toBe(1);
  });

  await test.step('rechargement : nouvelle époque conservée, le serveur fait foi (R-SYN-28)', async () => {
    await page.reload();
    await expect(connection).toHaveAttribute('data-state', 'online', SYNC_TIMEOUT);
    await expect.poll(() => metaValue(page, 'serverEpoch'), SYNC_TIMEOUT).toBe(epoch2);
    await expect
      .poll(async () => String(await metaValue(page, 'watermark')), SYNC_TIMEOUT)
      .toMatch(new RegExp(`^${epoch2}:`));
    await expect.poll(() => mirroredDaysPerWeek(page), SYNC_TIMEOUT).toBe(3);
    expect(await idbGetAll(page, 'outbox')).toEqual([]);
    expect(replays, 'renvoi de retrait (T26) : aucun accord retiré').toEqual([]);
    expect(denied, 'aucune session perdue').toEqual([]);
    expect(fullPulls, 'le rechargement repart du filigrane, sans second pull complet').toBe(1);
  });
});

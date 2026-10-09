import { BUILD_DIRS, loadBuilds, shellLabel } from './support/builds';
import { expect, test } from './support/fixtures';
import { setupOnboardedAdmin } from './support/flows';
import { fakeOutboxOp, idbGetAll, idbPut, metaValue, triggerForeground } from './support/pwa';

const PROTOCOL_UNSUPPORTED = { error: 'protocol_unsupported', serverProtocol: 1, minProtocol: 1 };

test.use({ serverOptions: { publicDir: BUILD_DIRS.A } });

// 01 §9.1.6 scénario 5 : 426, puis mise à jour, puis synchro de la file ; R-VER-2, R-PWA-5.
test('426 : file gardée, bandeau non fermable, mise à jour vers B puis synchro de la file', async ({
  server,
  context,
}) => {
  const { b } = await loadBuilds();
  const page = await setupOnboardedAdmin(server, context);
  const connection = page.getByTestId('connection-status');
  const banner = page.getByTestId('update-banner');
  const outboxIds = async () => (await idbGetAll<{ opId: string }>(page, 'outbox')).map((o) => o.opId);
  expect(await shellLabel(page)).toBe('A');

  const userId = await metaValue(page, 'userId');
  if (typeof userId !== 'string') throw new Error('meta.userId absent après l’onboarding');
  const op = fakeOutboxOp(userId);

  await test.step('426 sur la synchro : état protocol_unsupported, file gardée (R-VER-2)', async () => {
    // La panne d'abord : sinon le moteur pousserait l'opération avant elle.
    server.setFault({ kind: 'status', pathPrefix: '/api/sync/', status: 426, body: PROTOCOL_UNSUPPORTED });
    await idbPut(page, 'outbox', op);
    await server.restart({ APPSPORT_PUBLIC_DIR: b.dir });
    await triggerForeground(page);
    await expect(connection).toHaveAttribute('data-state', 'protocol_unsupported', { timeout: 15_000 });
    expect(await outboxIds()).toEqual([op.opId]);
  });

  await test.step('bandeau non fermable (R-PWA-5), puis B au clic', async () => {
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toHaveAttribute('data-dismissible', 'false');
    await expect(banner.getByRole('button', { name: 'Plus tard', exact: true })).toHaveCount(0);
    await banner.getByRole('button', { name: 'Mettre à jour', exact: true }).click();
    await expect.poll(() => shellLabel(page), { timeout: 20_000 }).toBe('B');
  });

  await test.step('protocole rétabli : la file part, le refus du serveur est compté', async () => {
    server.setFault(null);
    await triggerForeground(page);
    await expect(connection).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
    await expect.poll(outboxIds, { timeout: 15_000 }).toEqual([]);
    await expect(page.getByTestId('pending-counter')).toHaveAttribute('data-count', '0');
    // L'opération factice vise une ligne sync_rejection inexistante : le serveur la refuse.
    const deadletter = await idbGetAll<{ opId: string }>(page, 'deadletter');
    expect(deadletter.map((d) => d.opId)).toEqual([op.opId]);
    await expect(page.getByTestId('rejected-counter')).toHaveAttribute(
      'data-count',
      String(deadletter.length),
    );
  });
});

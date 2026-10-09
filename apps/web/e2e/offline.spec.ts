import { expect, test } from './support/fixtures';
import { loginViaUi, setupOnboardedAdmin } from './support/flows';
import { idbGetAll, triggerForeground } from './support/pwa';

// 01 §9.1.6 scénario 2 (sans séance, brique 3) : hors ligne simulé par `context.setOffline(true)` puis par
// des requêtes qui n'aboutissent pas (délai de 4 s, R-SYN-30), retour du réseau, vue d'un second contexte.
test('hors ligne : coquille du cache, état de connexion, profil et second appareil', async ({
  server,
  context,
  newContext,
}) => {
  const page = await setupOnboardedAdmin(server, context);
  const connection = page.getByTestId('connection-status');
  const username = page.getByLabel('Pseudo', { exact: true });
  const saveUsername = page.getByRole('button', { name: 'Enregistrer le pseudo', exact: true });

  // Pas de navigation sous `setOffline` : WebKit y fait échouer même une navigation servie par le SW
  // (« WebKit encountered an internal error »). Le rechargement à froid hors ligne passe par l'étape suivante.
  await test.step('réseau coupé (context.setOffline)', async () => {
    await context.setOffline(true);
    await triggerForeground(page);
    await expect(connection).toHaveAttribute('data-state', 'offline', { timeout: 5_000 });
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(username).toHaveValue('camille');
    // Classe E (API en ligne) : refusée hors ligne avec « Nécessite le réseau ».
    await username.fill('camille-sans-reseau');
    await saveUsername.click();
    await expect(page.getByText('Nécessite le réseau', { exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect(connection).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
  });

  await test.step('requêtes sans réponse (VPN coupé) alors que navigator.onLine reste vrai', async () => {
    server.setFault({ kind: 'blackhole' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await connection.waitFor({ state: 'attached' });
    await expect(connection).toHaveAttribute('data-state', 'offline', { timeout: 5_000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.goto(`${server.url}/profile`, { waitUntil: 'domcontentloaded' });
    await expect(username).toHaveValue('camille');
    server.setFault(null);
    await triggerForeground(page);
    await expect(connection).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
  });

  await test.step('second appareil : le nouveau pseudo arrive par la synchro', async () => {
    const otherContext = await newContext();
    const other = await otherContext.newPage();
    await other.goto(`${server.url}/login`);
    await loginViaUi(other, 'camille');
    await expect(other).toHaveURL(`${server.url}/`);

    await username.fill('camille2');
    const [renamed] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/me')),
      saveUsername.click(),
    ]);
    expect(renamed.status()).toBe(200);

    await expect
      .poll(
        async () => {
          await triggerForeground(other);
          return (await idbGetAll<{ username: string }>(other, 'user')).map((u) => u.username);
        },
        { timeout: 15_000 },
      )
      .toContain('camille2');
  });
});

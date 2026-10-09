import { SYNC_TIMEOUT_MS } from '@appsport/contracts';
import { expect, test } from './support/fixtures';
import { loginViaUi, setupOnboardedAdmin } from './support/flows';
import { idbGetAll, triggerForeground } from './support/pwa';

// Une navigation servie par le SW ou une attente d'état bornée : sans borne, une régression échouerait
// au délai global du test (120 s) sans nommer l'étape.
const SHELL_TIMEOUT_MS = 10_000;

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
  // Refus de classe E : l'alerte annoncée (`role="alert"`) du formulaire du pseudo, pas un texte quelconque.
  const usernameAlert = page.locator('form').filter({ has: saveUsername }).getByRole('alert');

  // Pas de navigation sous `setOffline` : WebKit y fait échouer même une navigation servie par le SW
  // (« WebKit encountered an internal error »). Le rechargement à froid hors ligne passe par l'étape suivante.
  await test.step('réseau coupé (context.setOffline)', async () => {
    // Preuve du déclencheur « premier plan » (R-SYN-29) : la dernière synchro a réussi (aucune reprise
    // programmée), l'outbox est vide (pas de cycle à 60 s) et l'événement `offline` n'en lance pas ;
    // seul le cycle déclenché ici peut faire passer l'état à 'offline' dans les 5 s.
    await expect(connection).toHaveAttribute('data-state', 'online');
    await expect(page.getByTestId('pending-counter')).toHaveAttribute('data-count', '0');
    await context.setOffline(true);
    await triggerForeground(page);
    await expect(connection).toHaveAttribute('data-state', 'offline', { timeout: 5_000 });
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(username).toHaveValue('camille');
    // Classe E (API en ligne) : refusée hors ligne avec « Nécessite le réseau ».
    await username.fill('camille-sans-reseau');
    await saveUsername.click();
    await expect(usernameAlert).toHaveText('Nécessite le réseau');
    await context.setOffline(false);
    await expect(connection).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
  });

  await test.step('requêtes sans réponse (VPN coupé) alors que navigator.onLine reste vrai', async () => {
    await expect(connection).toHaveAttribute('data-state', 'online');
    server.setFault({ kind: 'blackhole' });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: SHELL_TIMEOUT_MS });
    await connection.waitFor({ state: 'attached', timeout: SHELL_TIMEOUT_MS });
    await expect(connection).toHaveAttribute('data-state', 'offline', { timeout: 5_000 });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.goto(`${server.url}/profile`, { waitUntil: 'domcontentloaded', timeout: SHELL_TIMEOUT_MS });
    await expect(username).toHaveValue('camille');
    // Classe E sous des requêtes muettes : refus au bout de SYNC_TIMEOUT_MS (4 s), pas une attente sans fin.
    await username.fill('camille-sans-reponse');
    await saveUsername.click();
    await expect(usernameAlert).toHaveText('Nécessite le réseau', { timeout: SYNC_TIMEOUT_MS + 6_000 });
    server.setFault(null);
    // Accélère seulement le retour : les échecs du trou noir ont déjà programmé une reprise (2 s, 4 s…)
    // qui suffirait à repasser 'online'. La preuve du déclencheur est à l'étape précédente.
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

    // Une seule ligne : la synchro met à jour l'utilisateur, elle n'en ajoute pas un second.
    await expect
      .poll(
        async () => {
          await triggerForeground(other);
          return (await idbGetAll<{ username: string }>(other, 'user')).map((u) => u.username);
        },
        { timeout: 15_000 },
      )
      .toEqual(['camille2']);
  });
});

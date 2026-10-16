import { EXPERIENCE_LABELS, GOAL_LABELS } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { createAccountViaUi } from './support/flows';
import { emulateStandalone, requireServiceWorker } from './support/pwa';
import { bootstrapAdmin } from './support/server';

// Spec refonte §12 (ruling P9) : le parcours ajouté, du choix du coach jusqu'à « Éveil terminé », puis l'accueil.
// Textes du Scribe mot pour mot (spec refonte §8), écrits ici : le code des coachs importe la boîte à outils et
// ses feuilles de style, que l'exécuteur des E2E ne charge pas.
const SCRIBE = {
  name: 'Le Scribe',
  intro:
    "Je suis le Scribe. Je prépare un plan clair et je note chaque série pour faire le point avec toi. Nos échanges viendront plus tard : pour l'instant, je consigne.",
  ready: 'Profil complet, lieu noté. Le plan arrivera ici.',
  /** Lignes du jour de l'accueil, une par jour de Paris à tour de rôle ; `{jours}` = 2 (rythme choisi ici). */
  daily: [
    'Profil complet, lieu noté, rythme de 2 séances par semaine. Le plan arrivera ici.',
    'Point du jour : ton profil est à jour.',
    'Je consigne. Les premières séances arriveront bientôt.',
  ],
};
const QUESTS = ['Profil complété', 'Lieu principal choisi', 'Prêt hors ligne'];
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Le voyant « Prêt hors ligne » attend le service worker et le premier pull. */
const READY_TIMEOUT_MS = 30_000;

test('onboarding : choix du coach, présentation, les 8 autres écrans, « Éveil terminé » puis l’accueil', async ({
  server,
  context,
  page,
}) => {
  await emulateStandalone(context);
  const { link } = await bootstrapAdmin(server);
  await page.goto(link);
  await requireServiceWorker(page);
  await createAccountViaUi(page, 'noa');

  const current = page.getByTestId('onboarding-step');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const choose = (name: string) => current.getByRole('radio', { name, exact: true }).check();
  /** Écran `step`, titre nommé avec son rang « Étape n sur 9 ». */
  const at = async (step: string, n: number, title: string) => {
    await expect(current).toHaveAttribute('data-step', step);
    await expect(page.getByRole('heading', { level: 2, name: `Étape ${n} sur 9 ${title}` })).toBeVisible();
  };

  await test.step('coach : Le Scribe, puis sa présentation', async () => {
    await at('coach', 1, 'Choisis ton coach');
    await choose(SCRIBE.name);
    await button('Continuer').click();
    await at('coach', 1, SCRIBE.name);
    await expect(current.getByText("Message d'accueil", { exact: true })).toBeVisible();
    await expect(current.getByText(SCRIBE.intro, { exact: true })).toBeAttached();
    await button("C'est parti").click();
  });

  await test.step('les 8 autres écrans, avancés par « Continuer »', async () => {
    await at('goal', 2, 'Objectif');
    await choose(GOAL_LABELS.strength);
    await button('Continuer').click();
    await at('sport', 3, 'Autre sport');
    await choose('Non');
    await button('Continuer').click();
    await at('place_kind', 4, 'Lieu principal');
    await choose('À la maison');
    await button('Continuer').click();
    await at('place', 5, 'Ma maison');
    // « Nom du lieu » prérempli.
    await button('Continuer').click();
    await at('experience', 6, 'Niveau');
    await choose(EXPERIENCE_LABELS.lt_6_months);
    await button('Continuer').click();
    await at('availability', 7, 'Disponibilité');
    await choose('2');
    await choose('60 min');
    await expect(current.getByText('2 séances de 60 min par semaine', { exact: true })).toBeVisible();
    await button('Continuer').click();
    await at('health', 8, 'Santé et prudence');
    await button('Continuer').click();
    await at('ready', 9, "C'est prêt");
  });

  await test.step('« Éveil terminé » : rang E, quêtes cochées, mot du Scribe, puis « Commencer »', async () => {
    await expect(page.getByRole('heading', { name: 'Éveil terminé.', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Rang E', exact: true })).toBeVisible();
    for (const quest of QUESTS) {
      await expect(page.getByRole('checkbox', { name: quest, exact: true })).toBeChecked({
        timeout: READY_TIMEOUT_MS,
      });
    }
    await expect(current.getByText('3/3', { exact: true })).toBeVisible();
    await expect(current.getByText(SCRIBE.ready, { exact: true })).toBeVisible();
    await expect(button('Commencer')).toBeEnabled();
    await button('Commencer').click();
    await page.waitForURL((url) => url.pathname === '/');
    // L'accueil : son onglet actif, et le titre qui salue le pseudo (« Bonjour, » ou « Bonsoir, » selon l'heure).
    await expect(
      page.getByTestId('tab-bar').getByRole('link', { name: 'Accueil', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: /^Bon(jour|soir), noa$/ })).toBeVisible();
    // La bulle du Scribe choisi, étiquetée « Aujourd'hui », avec sa ligne du jour (laquelle dépend du jour).
    const bubble = page.getByRole('main').locator('[data-mode="training"]');
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText(SCRIBE.name);
    await expect(bubble.getByText("Aujourd'hui", { exact: true })).toBeVisible();
    await expect(
      bubble.getByText(new RegExp(`^(${SCRIBE.daily.map(escapeRegExp).join('|')})$`)),
    ).toBeVisible();
  });
});

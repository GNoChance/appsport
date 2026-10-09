import { EXPERIENCE_LABELS, GOAL_LABELS, PRESETS } from '@appsport/contracts';
import { type BrowserContext, expect, type Page } from '@playwright/test';
import { emulateStandalone, requireServiceWorker, waitForController } from './pwa';
import { bootstrapAdmin, type E2EServer } from './server';

// Parcours d'écran communs aux E2E, par les libellés exacts des composants (Interfaces §6, `exact: true`).

/** 31 points de code : au-dessus du minimum admin de 14 (R-MDP-1), pas de changement imposé. */
export const E2E_PASSWORD = 'cheval agrafe batterie correcte';

const READY_TIMEOUT_MS = 30_000;

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** Formulaire « Crée ton compte » déjà affiché ; attend l'onboarding (R-CPT-2). */
export async function createAccountViaUi(page: Page, username: string): Promise<void> {
  await page.getByLabel('Pseudo', { exact: true }).fill(username);
  await page.getByLabel('Mot de passe', { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel('Confirmation', { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("J'ai lu la page Confidentialité et règles", { exact: true }).check();
  await button(page, 'Créer mon compte').click();
  await page.waitForURL((url) => url.pathname === '/onboarding');
}

/**
 * Les 8 écrans de l'onboarding (02 §8) depuis l'objectif : chaque écran est attendu par son `data-step`,
 * puis E8 « Commencer » une fois le voyant « Prêt hors ligne » au vert (R-SYN-33) ; attend l'accueil.
 */
export async function completeOnboardingViaUi(
  page: Page,
  o: { place: { kind: 'gym'; name: string; city: string } | { kind: 'home' } },
): Promise<void> {
  const current = page.getByTestId('onboarding-step');
  const at = (step: string) => expect(current).toHaveAttribute('data-step', step);
  const choose = (name: string) => current.getByRole('radio', { name, exact: true }).check();
  const next = () => button(page, 'Suivant').click();

  await at('goal');
  await choose(GOAL_LABELS.muscle);
  await next();
  await at('sport');
  await choose('Non');
  await next();
  await at('place_kind');
  await choose(o.place.kind === 'gym' ? 'À la salle' : 'À la maison');
  await next();
  await at('place');
  if (o.place.kind === 'gym') {
    await button(page, "Ma salle n'est pas dans la liste").click();
    await page.getByLabel('Nom de la salle', { exact: true }).fill(o.place.name);
    await page.getByLabel('Ville', { exact: true }).fill(o.place.city);
    await button(page, 'Continuer').click();
    await choose(PRESETS.gym_small.label);
    // La salle créée valide l'écran : pas de « Suivant ».
    await button(page, 'Créer la salle').click();
  } else {
    // « Nom du lieu » prérempli.
    await next();
  }
  await at('experience');
  await choose(EXPERIENCE_LABELS.none);
  await next();
  await at('availability');
  await choose('3');
  await choose('45 min');
  await next();
  await at('health');
  await next();
  await at('ready');
  await expect(page.getByTestId('offline-ready')).toHaveAttribute('data-state', 'ready', {
    timeout: READY_TIMEOUT_MS,
  });
  await button(page, 'Commencer').click();
  await page.waitForURL((url) => url.pathname === '/');
}

/** Administrateur amorcé (lien), compte créé et onboarding fini (maison) dans l'appli installée ; page contrôlée par le SW. */
export async function setupOnboardedAdmin(
  server: E2EServer,
  context: BrowserContext,
  username = 'camille',
): Promise<Page> {
  await emulateStandalone(context);
  const { link } = await bootstrapAdmin(server);
  const page = await context.newPage();
  await page.goto(link);
  await requireServiceWorker(page);
  await createAccountViaUi(page, username);
  await completeOnboardingViaUi(page, { place: { kind: 'home' } });
  await waitForController(page);
  return page;
}

/** Formulaire de connexion déjà affiché (/login). */
export async function loginViaUi(page: Page, username: string): Promise<void> {
  await page.getByLabel('Pseudo', { exact: true }).fill(username);
  await page.getByLabel('Mot de passe', { exact: true }).fill(E2E_PASSWORD);
  await button(page, 'Se connecter').click();
}

import type { Page } from '@playwright/test';
import { EXPERIENCE_LABELS, GOAL_LABELS, HEALTH_CONSENT_TEXT } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { createAccountViaUi } from './support/flows';
import { emulateStandalone } from './support/pwa';
import { bootstrapAdmin } from './support/server';

// Barre « Retour » / « Continuer » collée en bas de l'onboarding (maquettes B01–B08) : elle porte aussi l'erreur
// de l'écran et grandit avec elle (deux lignes à 390 px). Un champ atteint par Tab ou par focus() finit au-dessus
// d'elle, jamais dessous (WCAG 2.2, 2.4.11), dans Chromium comme dans WebKit, qui ignore scroll-padding pour
// focus(). Le service worker n'y joue aucun rôle.

const DRAFT_INCOMPLETE = 'Termine ou efface la limitation en cours avant de continuer.';

/** Fin des animations (entrée d'écran, cascade des cartes) : les boîtes sont à leur place. */
const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

test('onboarding, erreur dans la barre collée : le champ atteint par Tab ou focus() finit au-dessus d’elle', async ({
  server,
  context,
  page,
}) => {
  await emulateStandalone(context);
  const { link } = await bootstrapAdmin(server);
  await page.goto(link);
  await createAccountViaUi(page, 'noa');

  const current = page.getByTestId('onboarding-step');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const at = (step: string) => expect(current).toHaveAttribute('data-step', step);
  const choose = (name: string) => current.getByRole('radio', { name, exact: true }).check();

  await test.step('jusqu’à « Santé et prudence »', async () => {
    await at('coach');
    await choose('Le Skald');
    await button('Continuer').click();
    await button("C'est parti").click();
    await at('goal');
    await choose(GOAL_LABELS.muscle);
    await button('Continuer').click();
    await at('sport');
    await choose('Non');
    await button('Continuer').click();
    await at('place_kind');
    await choose('À la maison');
    await button('Continuer').click();
    await at('place');
    await button('Continuer').click();
    await at('experience');
    await choose(EXPERIENCE_LABELS.none);
    await button('Continuer').click();
    await at('availability');
    await choose('3');
    await choose('45 min');
    await button('Continuer').click();
    await at('health');
  });

  // La barre : le bloc de l'écran qui porte l'erreur et les boutons.
  const bar = page.getByRole('alert').locator('xpath=..');
  await test.step('limitation commencée (la zone seule) : l’erreur de deux lignes s’affiche dans la barre', async () => {
    await current.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text, exact: true }).check();
    await button("J'accepte et je renseigne").click();
    await current.getByLabel('Zone', { exact: true }).selectOption({ index: 1 });
    await button('Continuer').click();
    await expect(page.getByRole('alert')).toHaveText(DRAFT_INCOMPLETE);
    await expect(bar.getByRole('button', { name: 'Continuer', exact: true })).toBeVisible();
    await settle(page);
  });

  const note = current.getByLabel('Note', { exact: true });
  const previous = current.getByRole('group', { name: 'Gêne', exact: true }).getByRole('radio').last();

  /** « Note » centrée sur la barre (entièrement dessous), focus sur le contrôle d'avant sans défiler. */
  const placeUnderBar = async () => {
    const placed = await bar.evaluate(
      (b, [field, before]) => {
        const r = (field as HTMLElement).getBoundingClientRect();
        const box = b.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + r.top + r.height / 2 - (box.top + box.height / 2));
        (before as HTMLElement).focus({ preventScroll: true });
        const f = (field as HTMLElement).getBoundingClientRect();
        const now = b.getBoundingClientRect();
        return { covered: f.top >= now.top && f.bottom <= now.bottom, barHeight: now.height };
      },
      [await note.elementHandle(), await previous.elementHandle()] as const,
    );
    expect(placed.covered, '« Note » peut passer entièrement sous la barre').toBe(true);
    // Erreur de deux lignes : la barre dépasse l'ancienne marge fixe de 6,5 rem (104 px).
    expect(placed.barHeight).toBeGreaterThan(104);
  };

  /** « Note » a le focus et finit au-dessus de la barre (haut de la barre − bas du champ ≥ 0). */
  const noteAboveBar = async () => {
    await expect(note).toBeFocused();
    const field = await note.elementHandle();
    await expect
      .poll(
        () =>
          bar.evaluate(
            (b, f) =>
              Math.round(b.getBoundingClientRect().top - (f as HTMLElement).getBoundingClientRect().bottom),
            field,
          ),
        { message: 'haut de la barre − bas de « Note » (≥ 0 : au-dessus)' },
      )
      .toBeGreaterThanOrEqual(0);
  };

  await test.step('Tab vers « Note », posée sous la barre : elle finit au-dessus', async () => {
    await placeUnderBar();
    await page.keyboard.press('Tab');
    await noteAboveBar();
  });

  await test.step('focus() de « Note », posée sous la barre : elle finit au-dessus', async () => {
    await placeUnderBar();
    await note.evaluate((field) => (field as HTMLElement).focus());
    await noteAboveBar();
  });
});

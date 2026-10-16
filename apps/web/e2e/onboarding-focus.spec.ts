import type { Page } from '@playwright/test';
import { GOAL_LABELS } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { createAccountViaUi } from './support/flows';
import { emulateStandalone } from './support/pwa';
import { bootstrapAdmin } from './support/server';

// WCAG 2.2 2.4.11 (focus jamais caché) et 1.4.10, spec refonte §12 : la barre « Retour » / « Continuer » de
// l'onboarding reste collée en bas de l'écran (maquettes B01–B08), sauf sur un écran bas (téléphone couché,
// clavier ouvert, zoom à 400 %) : là elle reprend sa place à la fin de l'écran (onboarding.module.css,
// max-height: 30rem) et ne peut plus rien recouvrir. Un champ atteint au clavier finit alors à l'écran, à
// découvert (WebKit ne défile que jusqu'à la ligne de saisie : le bas du cadre peut rester sous le bord).
// La tabulation de WebKit ne passe que par les champs de saisie : la création d'une salle (nom, puis ville) s'y
// prête. Barre collée (écran haut) : e2e/onboarding-bar.spec.ts, par Tab et par focus() ; sur cet écran, la
// ville est trop haut dans la page pour passer sous une barre collée.

/** Écran bas (téléphone couché, clavier ouvert), sous les 30 rem où la barre se décolle. */
const SHORT_HEIGHT = 320;

/** Fin des animations (entrée d'écran, cascade) : les boîtes sont à leur place. */
const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

/**
 * Boîte du champ `fieldId` en px de la fenêtre, si un ancêtre de « Retour » est collé ou fixé (la barre), et si
 * le centre du champ est à découvert (rien posé dessus).
 */
const boxes = (page: Page, fieldId: string) =>
  page.evaluate((id) => {
    const back = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retour');
    let pinned = false;
    for (let el = back?.parentElement ?? null; el; el = el.parentElement) {
      if (['sticky', 'fixed'].includes(getComputedStyle(el).position)) pinned = true;
    }
    const field = document.getElementById(id);
    const box = field?.getBoundingClientRect();
    const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
    return {
      pinned,
      uncovered: hit !== null && field?.contains(hit) === true,
      top: Math.round(box?.top ?? Number.NaN),
      centre: Math.round(box ? box.top + box.height / 2 : Number.NaN),
    };
  }, fieldId);

test('onboarding, écran bas : la barre ne colle plus, le champ atteint par Tab finit à l’écran, à découvert (WCAG 2.4.11)', async ({
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
  const choose = (name: string) => current.getByRole('radio', { name, exact: true }).check();
  const at = (step: string) => expect(current).toHaveAttribute('data-step', step);

  await test.step('jusqu’à la création d’une salle (maquette B04)', async () => {
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
    await choose('À la salle');
    await button('Continuer').click();
    await at('place');
    await button('Créer une salle').click();
    await expect(page.getByLabel('Ville', { exact: true })).toBeVisible();
  });

  await test.step('Tab du nom vers la ville, sous le bas de l’écran : la ville finit à l’écran, à découvert', async () => {
    const width = page.viewportSize()?.width ?? 390;
    await page.setViewportSize({ width, height: SHORT_HEIGHT });
    await settle(page);
    const nameId = await page.getByLabel('Nom de la salle', { exact: true }).evaluate((el) => el.id);
    const cityId = await page.getByLabel('Ville', { exact: true }).evaluate((el) => el.id);
    // Haut de la page, focus sur le nom sans défiler : la ville est sous le bas de la fenêtre.
    await page.evaluate((id) => {
      window.scrollTo(0, 0);
      document.getElementById(id)?.focus({ preventScroll: true });
    }, nameId);
    const before = await boxes(page, cityId);
    expect(before.pinned, 'écran bas : la barre n’est plus collée').toBe(false);
    expect(before.top, 'avant : la ville est sous le bas de la fenêtre').toBeGreaterThanOrEqual(SHORT_HEIGHT);

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Ville', { exact: true })).toBeFocused();
    await expect
      .poll(
        async () => {
          const after = await boxes(page, cityId);
          return after.top >= 0 && after.centre < SHORT_HEIGHT && after.uncovered;
        },
        { message: 'la ville est dans la fenêtre (haut et centre) et rien ne recouvre son centre' },
      )
      .toBe(true);
    expect((await boxes(page, cityId)).pinned, 'la barre reste décollée').toBe(false);
  });
});

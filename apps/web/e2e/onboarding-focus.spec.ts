import type { Page } from '@playwright/test';
import { GOAL_LABELS } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { createAccountViaUi } from './support/flows';
import { emulateStandalone } from './support/pwa';
import { bootstrapAdmin } from './support/server';

// WCAG 2.2 2.4.11 (focus jamais caché), spec refonte §12 : la barre « Retour » / « Continuer » de l'onboarding
// reste collée en bas de l'écran (maquettes B01–B08) ; un champ atteint au clavier défile au-dessus d'elle
// (scroll-padding-bottom, onboarding.module.css), jamais dessous. La tabulation de WebKit ne passe que par les
// champs de saisie : la création d'une salle (nom, puis ville) s'y prête.

/** Écran bas (téléphone couché, clavier ouvert) : la ville peut passer sous la barre sans sortir de l'écran. */
const SHORT_HEIGHT = 320;

/** Fin des animations (entrée d'écran, cascade) : les boîtes sont à leur place. */
const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

/** Boîte du champ `fieldId` et haut de la barre collée (l'ancêtre sticky de « Retour »), en px de la fenêtre. */
const boxes = (page: Page, fieldId: string) =>
  page.evaluate((id) => {
    const back = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retour');
    let bar = back?.parentElement ?? null;
    while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement;
    const field = document.getElementById(id)?.getBoundingClientRect();
    const barBox = bar?.getBoundingClientRect();
    return {
      sticky: bar !== null,
      top: Math.round(field?.top ?? Number.NaN),
      bottom: Math.round(field?.bottom ?? Number.NaN),
      barTop: Math.round(barBox?.top ?? Number.NaN),
    };
  }, fieldId);

test('onboarding : le champ atteint par Tab finit au-dessus de la barre collée en bas (WCAG 2.4.11)', async ({
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

  await test.step('Tab du nom vers la ville posée sous la barre : la ville finit au-dessus', async () => {
    const width = page.viewportSize()?.width ?? 390;
    await page.setViewportSize({ width, height: SHORT_HEIGHT });
    await settle(page);
    const nameId = await page.getByLabel('Nom de la salle', { exact: true }).evaluate((el) => el.id);
    const cityId = await page.getByLabel('Ville', { exact: true }).evaluate((el) => el.id);
    // Centre de la ville sur le centre de la barre : entièrement dessous, mais dans la fenêtre ; focus sur le
    // nom sans défiler.
    const placed = await page.evaluate(
      ({ fromId, toId }) => {
        const back = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retour');
        let bar = back?.parentElement ?? null;
        while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement;
        const from = document.getElementById(fromId);
        const to = document.getElementById(toId);
        if (!bar || !from || !to) return false;
        const b = bar.getBoundingClientRect();
        const r = to.getBoundingClientRect();
        const scroll = window.scrollY + r.top + r.height / 2 - (b.top + b.height / 2);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (scroll < 0 || scroll > max) return false;
        window.scrollTo(0, scroll);
        from.focus({ preventScroll: true });
        return true;
      },
      { fromId: nameId, toId: cityId },
    );
    expect(placed, 'la ville peut passer sous la barre').toBe(true);
    const before = await boxes(page, cityId);
    expect(before.sticky, 'barre collée trouvée').toBe(true);
    expect(before.bottom, 'avant : la ville est sous la barre').toBeGreaterThan(before.barTop);
    expect(before.top, 'avant : la ville est dans la fenêtre').toBeLessThan(SHORT_HEIGHT);

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Ville', { exact: true })).toBeFocused();
    await expect
      .poll(
        async () => {
          const after = await boxes(page, cityId);
          return after.bottom <= after.barTop;
        },
        { message: 'bas de la ville ≤ haut de la barre' },
      )
      .toBe(true);
  });
});

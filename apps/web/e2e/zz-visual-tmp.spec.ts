import type { Page } from '@playwright/test';
import { EXPERIENCE_LABELS, GOAL_LABELS, HEALTH_CONSENT_TEXT } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { createAccountViaUi } from './support/flows';
import { emulateStandalone } from './support/pwa';
import { bootstrapAdmin } from './support/server';

// TEMPORAIRE : captures pour vérification visuelle, jamais commité.
const OUT = process.env.SHOT_DIR ?? 'shots';

const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

for (const theme of ['carnet', 'clair']) {
  test(`visuel ${theme}`, async ({ server, context, page, browserName }) => {
    test.skip(browserName !== 'chromium');
    await context.addInitScript((t) => localStorage.setItem('rune.theme', t), theme);
    await emulateStandalone(context);
    const { link } = await bootstrapAdmin(server);
    await page.goto(link);
    await createAccountViaUi(page, 'noa');
    const current = page.getByTestId('onboarding-step');
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const at = (step: string) => expect(current).toHaveAttribute('data-step', step);
    const choose = (name: string) => current.getByRole('radio', { name, exact: true }).check();
    await page.setViewportSize({ width: 390, height: 844 });
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
    await settle(page);
    await page.screenshot({ path: `${OUT}/${theme}-place-390.png` });
    await button('Continuer').click();
    await at('experience');
    await choose(EXPERIENCE_LABELS.none);
    await button('Continuer').click();
    await at('availability');
    await choose('3');
    await choose('45 min');
    await button('Continuer').click();
    await at('health');
    await current.getByRole('checkbox', { name: HEALTH_CONSENT_TEXT.text, exact: true }).check();
    await button("J'accepte et je renseigne").click();
    await current.getByLabel('Zone', { exact: true }).selectOption({ index: 1 });
    await button('Continuer').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.screenshot({ path: `${OUT}/${theme}-health-error-390.png` });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.screenshot({ path: `${OUT}/${theme}-health-error-1280.png` });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.screenshot({ path: `${OUT}/${theme}-health-error-landscape.png` });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: `${OUT}/${theme}-health-error-landscape-bottom.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await current.getByLabel('Zone', { exact: true }).selectOption({ index: 0 });
    await button('Continuer').click();
    await at('ready');
    // Fenêtre qui s'ouvre : animations figées à 150, 400 et 590 ms, puis la fin.
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const t of [150, 300, 400, 590]) {
      await page.evaluate((ms) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = ms;
        }
      }, t);
      await page.screenshot({ path: `${OUT}/${theme}-ready-${t}.png` });
    }
    await page.evaluate(() => {
      for (const a of document.getAnimations()) a.finish();
    });
    await settle(page);
    await page.screenshot({ path: `${OUT}/${theme}-ready-end.png` });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: `${OUT}/${theme}-ready-bottom.png` });
  });
}

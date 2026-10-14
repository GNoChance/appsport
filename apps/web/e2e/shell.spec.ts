import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { setupOnboardedAdmin } from './support/flows';

// Spec refonte §5 (maquettes MixSombre / MixClair) : sur téléphone, la barre d'onglets flotte en position fixe
// au-dessus du contenu. Playwright refait défiler la page quand elle intercepte un clic : seul le point
// réellement touché (elementFromPoint) voit un contrôle resté dessous. Contraintes : cible tactile, WCAG 2.2
// 2.4.11 (focus jamais caché), 1.4.4 et 1.4.10 (texte à 200 %, 320 px).

/** Fin des animations (entrée d'écran, pastille d'onglet, démarrage) : les boîtes sont à leur place. */
const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

const tab = (page: Page, name: string) =>
  page.getByTestId('tab-bar').getByRole('link', { name, exact: true });

/** Bas de la page : le centre du dernier contrôle hors de la barre le touche-t-il, ou touche-t-il la barre ? */
async function lastControlAtBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid="tab-bar"]');
    const controls = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'),
    ].filter((el) => !bar?.contains(el) && el.getClientRects().length > 0);
    const last = controls.at(-1);
    if (!bar || !last) return { name: null, reached: false, underBar: false };
    const r = last.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      name: last.textContent,
      reached: hit !== null && last.contains(hit),
      underBar: hit !== null && bar.contains(hit),
    };
  });
}

/**
 * Pose sous la barre un champ de saisie précédé d'un autre (la tabulation de WebKit ne passe que par les
 * champs), focus sur le précédent sans défiler ; rend l'identifiant du champ, null si aucun ne s'y prête.
 */
async function fieldUnderBar(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid="tab-bar"]')?.getBoundingClientRect();
    if (!bar) return null;
    const typing = (el: Element): el is HTMLInputElement =>
      el instanceof HTMLInputElement &&
      !el.readOnly &&
      ['text', 'password'].includes(el.type) &&
      el.id !== '';
    const controls = [
      ...document.querySelectorAll<HTMLElement>('main a[href], main button, main input, main select'),
    ].filter((el) => el.getClientRects().length > 0 && !el.matches(':disabled'));
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (let i = 1; i < controls.length; i++) {
      const [previous, field] = [controls[i - 1] as HTMLElement, controls[i] as HTMLElement];
      if (!typing(previous) || !typing(field)) continue;
      const r = field.getBoundingClientRect();
      // Centre du champ sur le centre de la barre : entièrement dessous, mais dans la fenêtre.
      const scroll = window.scrollY + r.top + r.height / 2 - (bar.top + bar.height / 2);
      if (scroll < 0 || scroll > max) continue;
      window.scrollTo(0, scroll);
      previous.focus({ preventScroll: true });
      return field.id;
    }
    return null;
  });
}

/** Le champ a-t-il le focus, et sa boîte finit-elle au-dessus de la barre ? */
const fieldAboveBar = (page: Page, id: string) =>
  page.evaluate((fieldId) => {
    const field = document.getElementById(fieldId);
    const bar = document.querySelector('[data-testid="tab-bar"]')?.getBoundingClientRect();
    if (!field || !bar) return { focused: false, bottom: Number.NaN, barTop: Number.NaN };
    return {
      focused: document.activeElement === field,
      bottom: Math.round(field.getBoundingClientRect().bottom),
      barTop: Math.round(bar.top),
    };
  }, id);

/** En-tête de l'accueil et barre : où tombent le texte de la pastille et les libellés des onglets ? */
const shellLayout = (page: Page) =>
  page.evaluate(() => {
    const textRects = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .flatMap((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return [...range.getClientRects()];
        });
    const pill = document.querySelector('[data-testid="connection-status"]');
    const avatar = document.querySelector('a[aria-label="Mon profil"]')?.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="tab-bar"]')?.getBoundingClientRect();
    if (!pill || !avatar || !bar) return null;
    const pillText = textRects(pill);
    const covers = (a: DOMRect, b: DOMRect) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    return {
      pillOverAvatar: pillText.some((r) => covers(r, avatar)),
      pillClipped: pillText.some((r) => r.left < 0 || r.right > window.innerWidth + 0.5),
      avatarClipped: avatar.left < 0 || avatar.right > window.innerWidth + 0.5,
      tabsOverflowing: [...document.querySelectorAll('[data-testid="tab-bar"] a')].flatMap((a) => {
        const cell = a.getBoundingClientRect();
        const out = textRects(a).some(
          (r) =>
            r.left < cell.left - 0.5 ||
            r.right > cell.right + 0.5 ||
            r.top < bar.top - 0.5 ||
            r.bottom > bar.bottom + 0.5,
        );
        return out ? [a.textContent] : [];
      }),
    };
  });

test('barre d’onglets : ni sur le dernier contrôle ni sur le focus ; lisible à 320 px, texte à 200 %', async ({
  server,
  context,
}) => {
  const page = await setupOnboardedAdmin(server, context);
  // Document neuf : « Commencer » mène encore à l'accueil quand sa requête aboutit, après la redirection de la
  // garde ; un onglet touché juste après serait annulé (WebKit). Le rechargement coupe cette suite en attente.
  await page.goto(`${server.url}/profile`);
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(tab(page, 'Profil')).toHaveAttribute('aria-current', 'page');
  await settle(page);

  await test.step('bas de page : le centre du dernier contrôle le touche, pas la barre', async () => {
    const hit = await lastControlAtBottom(page);
    expect.soft(hit.underBar, `« ${hit.name} » sous la barre`).toBe(false);
    expect.soft(hit.reached, `« ${hit.name} » reçoit le toucher`).toBe(true);
  });

  await test.step('tabulation : le champ atteint finit au-dessus de la barre (2.4.11)', async () => {
    const id = await fieldUnderBar(page);
    expect(id, 'un champ de saisie peut passer sous la barre').not.toBeNull();
    if (!id) return;
    await page.keyboard.press('Tab');
    await expect.poll(async () => (await fieldAboveBar(page, id)).focused).toBe(true);
    const after = await fieldAboveBar(page, id);
    expect
      .soft(after.bottom, 'bas du champ atteint par Tab ≤ haut de la barre')
      .toBeLessThanOrEqual(after.barTop);
  });

  await test.step('focus() d’un champ (erreur, suppression) : il finit au-dessus de la barre (2.4.11)', async () => {
    const id = await fieldUnderBar(page);
    expect(id, 'un champ de saisie peut passer sous la barre').not.toBeNull();
    if (!id) return;
    await page.evaluate((fieldId) => document.getElementById(fieldId)?.focus(), id);
    const after = await fieldAboveBar(page, id);
    expect.soft(after.focused).toBe(true);
    expect.soft(after.bottom, 'bas du champ ≤ haut de la barre').toBeLessThanOrEqual(after.barTop);
  });

  await test.step('320 px, texte à 200 % : pastille, initiale et libellés restent lisibles', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await tab(page, 'Accueil').click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('link', { name: 'Mon profil' })).toBeVisible();
    await settle(page);
    const layout = await shellLayout(page);
    expect(layout, 'en-tête de l’accueil et barre d’onglets affichés').not.toBeNull();
    expect.soft(layout?.pillOverAvatar, 'texte de la pastille sur le rond de l’initiale').toBe(false);
    expect.soft(layout?.pillClipped, 'texte de la pastille coupé au bord').toBe(false);
    expect.soft(layout?.avatarClipped, 'rond de l’initiale coupé au bord').toBe(false);
    expect.soft(layout?.tabsOverflowing, 'libellés hors de leur onglet').toEqual([]);

    await tab(page, 'Profil').click();
    await page.waitForURL((url) => url.pathname === '/profile');
    await settle(page);
    const hit = await lastControlAtBottom(page);
    expect.soft(hit.underBar, `« ${hit.name} » sous la barre, texte à 200 %`).toBe(false);
    expect.soft(hit.reached, `« ${hit.name} » reçoit le toucher, texte à 200 %`).toBe(true);
  });
});

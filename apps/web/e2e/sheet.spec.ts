import type { Locator, Page } from '@playwright/test';
import { PRIVACY_POLICY_VERSION } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { E2E_PASSWORD, loginViaUi } from './support/flows';
import { bootstrapAdmin, type E2EServer } from './support/server';

/**
 * Administrateur créé par l'API (profil avec son coach, sans quoi l'onboarding ne se termine pas), onboarding
 * fini, avec deux maisons : « Maison » (principale) et « Garage ».
 */
async function createAdminWithTwoPlaces(server: E2EServer, page: Page): Promise<void> {
  const { code } = await bootstrapAdmin(server);
  const call = async (method: 'POST' | 'PATCH', path: string, data: unknown, status: number) => {
    const res = await page.request.fetch(`${server.url}${path}`, {
      method,
      headers: { Origin: server.url },
      data,
    });
    expect(res.status(), `${method} ${path}`).toBe(status);
  };
  await call(
    'POST',
    '/api/invitations/accept',
    { code, username: 'camille', password: E2E_PASSWORD, termsVersion: PRIVACY_POLICY_VERSION },
    201,
  );
  await call(
    'PATCH',
    '/api/me/training-profile',
    {
      coach: 'skald',
      goal: 'muscle',
      experience: 'none',
      daysPerWeek: 3,
      sessionMinutes: 45,
      onboardingStep: 'health',
    },
    200,
  );
  await call('POST', '/api/places', { kind: 'home', equipment: [], isPrimary: true }, 201);
  await call('POST', '/api/places', { kind: 'home', name: 'Garage', equipment: [], isPrimary: false }, 201);
  await call('POST', '/api/me/onboarding/complete', {}, 200);
}

/** Connecté, sur la fiche de la maison « Garage » ouverte depuis Salles › Mes lieux. */
async function openGarage(server: E2EServer, page: Page): Promise<void> {
  await createAdminWithTwoPlaces(server, page);
  await page.goto(`${server.url}/login`);
  await loginViaUi(page, 'camille');
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto(`${server.url}/places`);
  await page.getByRole('link', { name: 'Garage', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Garage' })).toBeVisible();
}

/** Fin des animations d'entrée : chaque élément est à sa place. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('élément sans boîte');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Spec refonte §6 (maquette C06) : la feuille du bas passe au-dessus de toute la page. Rendue sur place, elle
// partage le contexte d'empilement de l'écran : la barre d'onglets flottante (z-index 50) prendrait sinon les
// touchers destinés à ses actions du bas.
test('feuille du bas : ses actions reçoivent le toucher, même par-dessus la barre d’onglets', async ({
  server,
  page,
}) => {
  await openGarage(server, page);
  await page.getByRole('button', { name: 'Supprimer ce lieu', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Supprimer Garage ?' });
  await expect(sheet).toBeVisible();
  await settled(page);

  // L'action du bas de la feuille est posée sur la barre d'onglets.
  const remove = sheet.getByRole('button', { name: 'Supprimer', exact: true });
  const target = await center(remove);
  const bar = await page.getByRole('navigation', { name: 'Navigation principale' }).boundingBox();
  if (!bar) throw new Error('barre d’onglets sans boîte');
  expect(target.y, 'la barre d’onglets passe sous « Supprimer »').toBeGreaterThan(bar.y);
  expect(target.y).toBeLessThan(bar.y + bar.height);

  // Ce qui reçoit le toucher au centre de « Supprimer » appartient à la feuille.
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="dialog"]') !== null,
    target,
  );
  expect(hit, 'le centre de « Supprimer » appartient à la feuille').toBe(true);

  // Vrai pointeur, sans force : Playwright vérifie que « Supprimer » reçoit bien le toucher.
  await remove.click({ timeout: 5_000 });
  await page.waitForURL((url) => url.pathname === '/places');
  await expect(page.getByRole('heading', { level: 1, name: 'Salles' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Garage', exact: true })).toHaveCount(0);
});

// Spec refonte §10.3 (maquette D03) : la barre des changements reste collée au bas de l'écran pendant que les
// pastilles défilent dessous ; leurs cases transparentes (z-index 1) ne doivent pas prendre ses touchers.
test('barre des changements : ses boutons reçoivent le toucher, même par-dessus les pastilles', async ({
  server,
  page,
}) => {
  await openGarage(server, page);
  await page.getByRole('button', { name: 'Modifier le matériel', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Matériel' })).toBeVisible();
  // Toutes les catégories dépliées : assez de pastilles pour défiler sous la barre.
  const collapsed = page.getByRole('button', { expanded: false });
  while ((await collapsed.count()) > 0) await collapsed.first().click();
  const chair = page.getByRole('checkbox', { name: 'Chaise ou banc stable', exact: true });
  await chair.check();
  const bar = page.getByRole('region', { name: 'Changements à enregistrer' });
  // Texte entier du résumé : une partie nulle (« 0 retrait ») le ferait échouer.
  await expect(bar.locator('p')).toHaveText('1 changement · 1 ajout');
  await settled(page);

  // Fait défiler l'écran jusqu'à poser une pastille sous « Annuler » de la barre.
  const cancel = bar.getByRole('button', { name: 'Annuler', exact: true });
  const target = await center(cancel);
  const aligned = await page.evaluate(({ x, y }) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (const input of document.querySelectorAll<HTMLInputElement>('main input[type="checkbox"]')) {
      const r = input.getBoundingClientRect();
      if (r.width === 0 || r.left > x || r.right < x) continue;
      const scroll = window.scrollY + r.top + r.height / 2 - y;
      if (scroll < 0 || scroll > max) continue;
      window.scrollTo(0, scroll);
      return true;
    }
    return false;
  }, target);
  expect(aligned, 'une pastille peut passer sous « Annuler »').toBe(true);
  const after = await center(cancel);
  const under = await page.evaluate(({ x, y }) => {
    for (const input of document.querySelectorAll<HTMLInputElement>('main input[type="checkbox"]')) {
      const r = input.getBoundingClientRect();
      if (r.left <= x && x <= r.right && r.top <= y && y <= r.bottom) return true;
    }
    return false;
  }, after);
  expect(under, 'une pastille est sous « Annuler »').toBe(true);

  // Ce qui reçoit le toucher au centre de « Annuler » appartient à la barre.
  const hit = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[aria-label="Changements à enregistrer"]') !== null,
    after,
  );
  expect(hit, 'le centre de « Annuler » appartient à la barre').toBe(true);

  // Vrai pointeur : « Annuler » remet le brouillon, la barre s'en va, rien n'est parti.
  await cancel.click({ timeout: 5_000 });
  await expect(bar).toHaveCount(0);
  await expect(chair).not.toBeChecked();
});

const DRAFT_BAR = '[aria-label="Changements à enregistrer"]';

/**
 * Fait défiler l'écran jusqu'à poser au milieu de la barre des changements une pastille (sa case) précédée d'un
 * autre contrôle, et la marque `data-e2e-target`. `focusBefore` : le contrôle d'avant prend d'abord le focus, sans
 * défiler (départ de la tabulation). Faux si aucune pastille ne s'y prête.
 */
async function chipUnderDraftBar(page: Page, focusBefore: boolean): Promise<boolean> {
  return page.evaluate(
    ({ selector, before }) => {
      document.querySelector('[data-e2e-target]')?.removeAttribute('data-e2e-target');
      const bar = document.querySelector(selector);
      if (!bar) return false;
      const controls = [...document.querySelectorAll<HTMLElement>('main input, main button')].filter(
        (el) => el.getClientRects().length > 0 && !bar.contains(el) && !el.matches(':disabled'),
      );
      const max = document.documentElement.scrollHeight - window.innerHeight;
      for (const [i, input] of controls.entries()) {
        if (i === 0 || !(input instanceof HTMLInputElement) || input.type !== 'checkbox') continue;
        if (before) controls[i - 1]?.focus({ preventScroll: true });
        const box = bar.getBoundingClientRect();
        const r = input.getBoundingClientRect();
        const scroll = window.scrollY + r.top + r.height / 2 - (box.top + box.height / 2);
        if (scroll < 0 || scroll > max) continue;
        window.scrollTo(0, scroll);
        const now = input.getBoundingClientRect();
        if (now.top < box.top || now.bottom > box.bottom) continue;
        input.dataset.e2eTarget = '';
        return true;
      }
      return false;
    },
    { selector: DRAFT_BAR, before: focusBefore },
  );
}

/** La pastille marquée a-t-elle le focus, et où est son bas par rapport au haut de la barre ? */
async function targetAboveDraftBar(page: Page) {
  return page.evaluate((selector) => {
    const target = document.querySelector('[data-e2e-target]');
    const bar = document.querySelector(selector);
    if (!target || !bar) return { focused: false, gap: Number.NEGATIVE_INFINITY };
    return {
      focused: document.activeElement === target,
      gap: bar.getBoundingClientRect().top - target.getBoundingClientRect().bottom,
    };
  }, DRAFT_BAR);
}

// WCAG 2.2, 2.4.11 : la barre des changements est opaque et collée en bas ; le contrôle qui prend le focus (tabulation,
// focus() d'un script) ne doit jamais finir dessous. La tabulation de WebKit ne passe que par les champs de saisie.
test('barre des changements : le focus ne finit jamais dessous (WCAG 2.2, 2.4.11)', async ({
  server,
  page,
}) => {
  await openGarage(server, page);
  await page.getByRole('button', { name: 'Modifier le matériel', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Matériel' })).toBeVisible();
  const collapsed = page.getByRole('button', { expanded: false });
  while ((await collapsed.count()) > 0) await collapsed.first().click();
  await page.getByRole('checkbox', { name: 'Chaise ou banc stable', exact: true }).check();
  const bar = page.getByRole('region', { name: 'Changements à enregistrer' });
  await expect(bar.locator('p')).toHaveText('1 changement · 1 ajout');
  await settled(page);

  await test.step('focus() d’une pastille sous la barre : elle finit au-dessus', async () => {
    expect(await chipUnderDraftBar(page, false), 'une pastille peut passer sous la barre').toBe(true);
    await page.locator('[data-e2e-target]').focus();
    await expect.poll(async () => (await targetAboveDraftBar(page)).gap).toBeGreaterThanOrEqual(0);
    expect((await targetAboveDraftBar(page)).focused).toBe(true);
  });

  if (test.info().project.name === 'chromium') {
    await test.step('tabulation jusqu’à une pastille sous la barre : elle finit au-dessus', async () => {
      expect(await chipUnderDraftBar(page, true), 'une pastille peut passer sous la barre').toBe(true);
      await page.keyboard.press('Tab');
      await expect.poll(async () => (await targetAboveDraftBar(page)).focused).toBe(true);
      await expect.poll(async () => (await targetAboveDraftBar(page)).gap).toBeGreaterThanOrEqual(0);
    });
  }
});

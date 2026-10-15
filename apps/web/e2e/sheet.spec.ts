import type { Page } from '@playwright/test';
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

// Spec refonte §6 (maquette C06) : la feuille du bas passe au-dessus de toute la page. Rendue sur place, elle
// partage le contexte d'empilement de l'écran : les champs transparents des cartes de choix et des puces
// (z-index 1) la couvraient et prenaient les touchers destinés à ses actions.
test('feuille du bas : ses actions reçoivent le toucher, même par-dessus des cartes de choix', async ({
  server,
  page,
}) => {
  await createAdminWithTwoPlaces(server, page);
  await page.goto(`${server.url}/login`);
  await loginViaUi(page, 'camille');
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto(`${server.url}/places`);

  await page.getByRole('button', { name: 'Ajouter une maison', exact: true }).click();
  const homeCreate = page.getByRole('region', { name: 'Ajouter une maison', exact: true });
  await expect(homeCreate).toBeVisible();
  const preset = homeCreate.getByRole('radio', { checked: true });
  const presetBefore = await preset.getAttribute('value');

  const garage = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Garage' }) });
  await garage.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Supprimer Garage ?' });
  await expect(sheet).toBeVisible();
  const cancel = sheet.getByRole('button', { name: 'Annuler', exact: true });
  await expect(cancel).toBeVisible();
  // Fin des animations d'entrée : la feuille est à sa place.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

  // Fait défiler la page derrière la feuille jusqu'à poser un champ de choix du formulaire sous « Annuler ».
  const box = await cancel.boundingBox();
  if (!box) throw new Error('« Annuler » sans boîte');
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const aligned = await homeCreate.evaluate((section, { x, y }) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (const input of section.querySelectorAll<HTMLInputElement>(
      'input[type="radio"], input[type="checkbox"]',
    )) {
      const r = input.getBoundingClientRect();
      if (r.width === 0 || r.left > x || r.right < x) continue;
      const scroll = window.scrollY + r.top + r.height / 2 - y;
      if (scroll < 0 || scroll > max) continue;
      window.scrollTo(0, scroll);
      return true;
    }
    return false;
  }, target);
  expect(aligned, 'un champ de choix peut passer sous « Annuler »').toBe(true);

  // Ce qui reçoit le toucher au centre de « Annuler » appartient à la feuille.
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="dialog"]') !== null,
    target,
  );
  expect(hit, 'le centre de « Annuler » appartient à la feuille').toBe(true);

  // Vrai pointeur, sans force : Playwright vérifie que « Annuler » reçoit bien le toucher.
  await cancel.click({ timeout: 5_000 });
  await expect(sheet).toBeHidden();
  await expect(preset).toHaveAttribute('value', presetBefore ?? '');
  await expect(garage.getByRole('link', { name: 'Garage' })).toBeVisible();
});

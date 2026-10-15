// TEMPORAIRE (contrôle visuel de la tâche 10) : jamais commité, supprimé après usage.
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, PRIVACY_POLICY_VERSION } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { E2E_PASSWORD, loginViaUi } from './support/flows';
import { bootstrapAdmin, type E2EServer } from './support/server';

const OUT = process.env.T10_SHOTS_DIR ?? '';
test.use({ viewport: { width: 390, height: 844 } });

async function seed(server: E2EServer, page: Page): Promise<void> {
  const { code } = await bootstrapAdmin(server);
  const call = async (method: 'POST' | 'PATCH' | 'PUT', path: string, data: unknown) => {
    const res = await page.request.fetch(`${server.url}${path}`, {
      method,
      headers: { Origin: server.url },
      data,
    });
    expect(res.ok(), `${method} ${path} ${res.status()}`).toBe(true);
  };
  await call('POST', '/api/invitations/accept', {
    code,
    username: 'camille',
    password: E2E_PASSWORD,
    termsVersion: PRIVACY_POLICY_VERSION,
  });
  await call('PATCH', '/api/me/training-profile', {
    coach: 'skald',
    goal: 'muscle',
    experience: 'none',
    daysPerWeek: 3,
    sessionMinutes: 45,
    onboardingStep: 'health',
  });
  await call('POST', '/api/places', { kind: 'home', equipment: [], isPrimary: true });
  await call('POST', '/api/me/consents', { type: 'health', textVersion: HEALTH_CONSENT_TEXT.version });
  await call('PUT', '/api/me/health-screening', {
    answers: [false, false, false, false],
    questionnaireVersion: HEALTH_QUESTIONNAIRE.version,
  });
  await call('POST', '/api/me/limitations', { bodyArea: 'knee', side: 'left', severity: 'mild', note: null });
  await call('POST', '/api/me/onboarding/complete', {});
}

test('captures T10', async ({ server, page }) => {
  test.skip(!OUT, 'T10_SHOTS_DIR absent');
  mkdirSync(OUT, { recursive: true });
  await seed(server, page);
  await page.goto(`${server.url}/login`);
  await loginViaUi(page, 'camille');
  await page.waitForURL((url) => url.pathname === '/');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const shot = async (name: string, path: string | null, heading: string) => {
      if (path) await page.goto(`${server.url}${path}`);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage: true });
    };
    await shot('C01-hub', '/profile', 'Profil');
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/C06-logout-${scheme}.png` });
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await shot('C02-edit', '/profile/edit', 'Mon profil');
    await page.getByRole('button', { name: 'Changer le mot de passe', exact: true }).click();
    await shot('C02-edit-password', null, 'Mon profil');
    await shot('C03-settings', '/settings', 'Réglages');
    await shot('C04-health', '/profile/health', 'Santé');
    await shot('C05-privacy', '/profile/privacy', 'Confidentialité');
    await shot('mycoach', '/profile/coach', 'Mon coach');
    await page.getByRole('button', { name: 'Changer de coach', exact: true }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/mycoach-sheet-${scheme}.png` });
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  }
});

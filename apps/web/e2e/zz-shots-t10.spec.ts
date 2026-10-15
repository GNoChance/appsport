// TEMPORAIRE (T10) : captures de contrôle visuel, jamais commitées.
import type { Page } from '@playwright/test';
import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, PRIVACY_POLICY_VERSION } from '@rune/contracts';
import { expect, test } from './support/fixtures';
import { E2E_PASSWORD, loginViaUi } from './support/flows';
import { bootstrapAdmin, type E2EServer } from './support/server';

const OUT = process.env.T10_SHOTS ?? '.';

async function setup(server: E2EServer, page: Page): Promise<void> {
  const { code } = await bootstrapAdmin(server);
  const call = async (method: 'POST' | 'PATCH' | 'PUT', path: string, data: unknown) => {
    const res = await page.request.fetch(`${server.url}${path}`, {
      method,
      headers: { Origin: server.url },
      data,
    });
    expect(res.ok(), `${method} ${path}`).toBe(true);
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

test('captures T10', async ({ server, page }, info) => {
  test.skip(info.project.name !== 'chromium');
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(server, page);
  await page.goto(`${server.url}/login`);
  await loginViaUi(page, 'camille');
  await page.waitForURL((url) => url.pathname === '/');
  for (const theme of ['clair', 'sombre'] as const) {
    await page.evaluate((t) => localStorage.setItem('rune.theme', t), theme);
    const shot = async (name: string) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: true });
    };
    for (const [path, name] of [
      ['/profile', 'c01-hub'],
      ['/profile/edit', 'c02-profil'],
      ['/settings', 'c03-reglages'],
      ['/profile/health', 'c04-sante'],
      ['/profile/privacy', 'c05-confidentialite'],
      ['/profile/coach', 'mon-coach'],
    ] as const) {
      await page.goto(`${server.url}${path}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await shot(name);
    }
    await page.getByRole('button', { name: 'Changer de coach', exact: true }).click();
    await shot('mon-coach-feuille');
    await page.goto(`${server.url}/profile`);
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await shot('c06-deconnexion');
    await page.goto(`${server.url}/profile/edit`);
    await page.getByRole('button', { name: 'Changer le mot de passe', exact: true }).click();
    await shot('c02-mot-de-passe');
  }
});

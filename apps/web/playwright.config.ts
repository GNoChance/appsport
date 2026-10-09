import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

// E2E de la PWA (01 §9.1.6, R-TST-1) : build de production servi par le vrai serveur derrière un proxy
// local (pannes réseau), Chromium (Pixel 7) et WebKit (iPhone 14), un seul worker.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  // Rapport HTML en CI seulement : publié par le job e2e en cas d'échec.
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    serviceWorkers: 'allow',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
});

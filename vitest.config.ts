import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    globals: false,
    projects: [
      { test: { name: 'contracts', root: 'packages/contracts', environment: 'node' } },
      { test: { name: 'domain', root: 'packages/domain', environment: 'node' } },
      {
        test: {
          name: 'server',
          root: 'apps/server',
          environment: 'node',
          // Ni UTC ni Paris : une date locale à la place de la date de Paris ou de l'horodatage UTC échoue partout.
          env: { TZ: 'America/New_York' },
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'happy-dom',
          setupFiles: ['test/setup.ts'],
          include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
          exclude: ['e2e/**', '**/node_modules/**'],
        },
      },
    ],
  },
});

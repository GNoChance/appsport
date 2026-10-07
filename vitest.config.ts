import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    globals: false,
    projects: [
      { test: { name: 'contracts', root: 'packages/contracts', environment: 'node' } },
      { test: { name: 'domain', root: 'packages/domain', environment: 'node' } },
      { test: { name: 'server', root: 'apps/server', environment: 'node' } },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'happy-dom',
          setupFiles: ['fake-indexeddb/auto'],
          include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
          exclude: ['e2e/**', '**/node_modules/**'],
        },
      },
    ],
  },
});

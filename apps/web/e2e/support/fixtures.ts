import { type BrowserContext, test as base, expect } from '@playwright/test';
import { type E2EServer, startE2EServer } from './server';

export { expect } from '@playwright/test';
export { DEFAULT_PUBLIC_DIR, REPO_ROOT } from './server';

const CSP_MARKER = 'Content Security Policy';

interface E2EFixtures {
  /** Options de `startE2EServer` (`test.use({ serverOptions: … })`). */
  serverOptions: Parameters<typeof startE2EServer>[0];
  /** Serveur neuf par test, fermé (`close()`) à la fin. */
  server: E2EServer;
  /**
   * Second appareil : contexte avec les options du projet (appareil, langue, fuseau, SW), surveillé comme
   * `context`, fermé à la fin du test. `browser.newContext()` seul n'hérite pas de ces options.
   */
  newContext(): Promise<BrowserContext>;
  /** Messages de console qui citent la CSP (P-LOG-4), tous contextes confondus ; le test échoue s'il y en a. */
  cspViolations: string[];
}

function watchCsp(context: BrowserContext, violations: string[]): void {
  context.on('console', (message) => {
    if (message.text().includes(CSP_MARKER)) violations.push(message.text());
  });
}

export const test = base.extend<E2EFixtures>({
  serverOptions: [{}, { option: true }],
  server: async ({ serverOptions }, use) => {
    const server = await startE2EServer(serverOptions);
    try {
      await use(server);
    } finally {
      await server.close();
    }
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright exige un premier argument déstructuré.
  cspViolations: async ({}, use) => {
    const violations: string[] = [];
    await use(violations);
    expect(violations, CSP_MARKER).toEqual([]);
  },
  context: async ({ context, cspViolations }, use) => {
    watchCsp(context, cspViolations);
    await use(context);
  },
  newContext: async (
    {
      browser,
      cspViolations,
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      locale,
      timezoneId,
      serviceWorkers,
    },
    use,
  ) => {
    const created: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
        locale,
        timezoneId,
        serviceWorkers,
      });
      created.push(context);
      watchCsp(context, cspViolations);
      return context;
    });
    await Promise.all(created.map((context) => context.close()));
  },
});

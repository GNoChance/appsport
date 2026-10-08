// @vitest-environment node
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { PRECACHE_GLOBAL } from '../../src/sw/precache-manifest';
import { bundleServiceWorker } from '../../vite-plugin-precache';

const SW_TS = resolve(import.meta.dirname, '../../src/sw/sw.ts');
const MANIFEST = { buildHash: 'aaaaaaaaaaaa', files: ['/index.html'], localDbVersion: 1 };

let code: string;

beforeAll(async () => {
  code = await bundleServiceWorker(SW_TS);
});

/** Exécute le SW compilé dans un global neuf ; renvoie les événements écoutés. */
function run(global: Record<string, unknown>): string[] {
  const listened: string[] = [];
  const self = { ...global, addEventListener: (type: string) => listened.push(type) };
  runInNewContext(code, Object.assign(self, { self }));
  return listened;
}

describe('amorçage de sw.ts compilé', () => {
  it('global de service worker avec manifeste : install, activate, fetch et message écoutés', () => {
    const listened = run({
      skipWaiting: () => Promise.resolve(),
      registration: {},
      clients: {},
      location: { origin: 'https://appsport.test' },
      [PRECACHE_GLOBAL]: MANIFEST,
    });
    expect(listened.sort()).toEqual(['activate', 'fetch', 'install', 'message']);
  });

  it.each([
    ['page (ni skipWaiting ni registration)', { [PRECACHE_GLOBAL]: MANIFEST }],
    ['service worker sans manifeste', { skipWaiting: () => Promise.resolve(), registration: {} }],
  ])('%s : aucun effet', (_, global) => {
    expect(run(global)).toEqual([]);
  });
});

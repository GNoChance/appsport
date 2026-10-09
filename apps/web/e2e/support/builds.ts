import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { build, type InlineConfig, type Plugin } from 'vite';
import { E2E_DATA_DIR, WEB_DIR } from './server';

// Deux coquilles de production, A et B, pour la mise à jour du SW (01 §9.1.6 scénarios 4 à 6).

export interface E2EBuild {
  label: 'A' | 'B';
  dir: string;
  buildHash: string;
}

const BUILDS_DIR = join(E2E_DATA_DIR, 'builds');
const BUILDS_FILE = join(BUILDS_DIR, 'builds.json');
const BUILD_HASH_RE = /^[0-9a-f]{12}$/;
/** Ligne du manifeste de précache, en tête de sw.js (`precachePlugin`). */
const MANIFEST_LINE_RE = /^self\.__APPSPORT_PRECACHE__ = (\{.*\});$/;

/** `<REPO_ROOT>/.e2e-data/builds/{A,B}`. */
export const BUILD_DIRS: { A: string; B: string } = {
  A: join(BUILDS_DIR, 'A'),
  B: join(BUILDS_DIR, 'B'),
};

/**
 * Build de production de apps/web avec le chargeur de configuration du script `build` du paquet
 * (`vite build --configLoader runner`) et le prénom du porteur « Alex » (« hébergé chez Alex »).
 */
export async function buildWeb(extra: InlineConfig = {}): Promise<void> {
  const previous = process.env.VITE_OWNER_FIRST_NAME;
  process.env.VITE_OWNER_FIRST_NAME = 'Alex';
  try {
    await build({ ...extra, root: WEB_DIR, configLoader: 'runner', logLevel: 'error' });
  } finally {
    if (previous === undefined) delete process.env.VITE_OWNER_FIRST_NAME;
    else process.env.VITE_OWNER_FIRST_NAME = previous;
  }
}

/** Seule différence entre A et B : `<meta name="e2e-build" content="<L>">` dans index.html. */
function e2eBuildLabel(label: E2EBuild['label']): Plugin {
  return {
    name: 'appsport-e2e-build-label',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'e2e-build', content: label }, injectTo: 'head' },
    ],
  };
}

/** buildHash du manifeste de précache, lu sur la première ligne de `<dir>/sw.js`. */
export async function readBuildHash(dir: string): Promise<string> {
  const firstLine = (await readFile(join(dir, 'sw.js'), 'utf8')).split('\n', 1)[0] ?? '';
  const json = MANIFEST_LINE_RE.exec(firstLine)?.[1];
  const buildHash: unknown =
    json === undefined ? undefined : (JSON.parse(json) as { buildHash?: unknown }).buildHash;
  if (typeof buildHash !== 'string' || !BUILD_HASH_RE.test(buildHash))
    throw new Error(`${join(dir, 'sw.js')} : première ligne sans manifeste de précache valide`);
  return buildHash;
}

/** Construit A puis B, écrit `.e2e-data/builds/builds.json` ; lève si les deux buildHash sont égaux. */
export async function buildTwice(): Promise<{ a: E2EBuild; b: E2EBuild }> {
  const builds: E2EBuild[] = [];
  for (const label of ['A', 'B'] as const) {
    const dir = BUILD_DIRS[label];
    await buildWeb({ build: { outDir: dir, emptyOutDir: true }, plugins: [e2eBuildLabel(label)] });
    builds.push({ label, dir, buildHash: await readBuildHash(dir) });
  }
  const [a, b] = builds as [E2EBuild, E2EBuild];
  if (a.buildHash === b.buildHash) throw new Error(`builds A et B de même buildHash (${a.buildHash})`);
  await mkdir(BUILDS_DIR, { recursive: true });
  await writeFile(BUILDS_FILE, `${JSON.stringify({ a, b }, null, 2)}\n`);
  return { a, b };
}

/** Builds écrits par `buildTwice` (global-setup). */
export async function loadBuilds(): Promise<{ a: E2EBuild; b: E2EBuild }> {
  let raw: string;
  try {
    raw = await readFile(BUILDS_FILE, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error('lancer la suite via playwright test : global-setup construit A et B');
    throw error;
  }
  return JSON.parse(raw) as { a: E2EBuild; b: E2EBuild };
}

const NAVIGATED = 'Execution context was destroyed';

/**
 * Lecture dans la page refaite dans le nouveau document si un rechargement la coupe (« Mettre à jour »,
 * interrupteur d'urgence) : `expect.poll` ne reprend pas une lecture qui lève.
 */
export async function acrossReload<T>(page: Page, read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= 3 || !String(error).includes(NAVIGATED)) throw error;
      await page.waitForLoadState('domcontentloaded');
    }
  }
}

/** `<meta name="e2e-build">` de la coquille affichée ; `null` hors des builds A et B. */
export async function shellLabel(page: Page): Promise<string | null> {
  return acrossReload(page, () =>
    page.evaluate(() => document.querySelector('meta[name="e2e-build"]')?.getAttribute('content') ?? null),
  );
}

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const rel = (f: string) => relative(SRC, f).replaceAll('\\', '/');
const code = (f: string) => /\.(ts|tsx)$/.test(f);

/** Écrans et composants : Dexie seulement derrière `repos/` (01 §2 et §3). */
const isScreen = (path: string) =>
  path.startsWith('features/') ||
  path.startsWith('ui/') ||
  path === 'App.tsx' ||
  (path.startsWith('sw/') && path.endsWith('.tsx'));

const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? '');
}

describe('architecture', () => {
  const files = [...walk(SRC)].filter(code);

  it('features/, ui/, App.tsx et src/sw/**/*.tsx n’importent ni dexie ni local-db/', () => {
    const screens = files.filter((f) => isScreen(rel(f)));
    expect(screens.length).toBeGreaterThan(5);
    for (const file of screens) {
      for (const spec of imports(file)) {
        expect(spec, rel(file)).not.toBe('dexie');
        expect(spec, rel(file)).not.toMatch(/(^|\/)local-db(\/|$)/);
      }
    }
  });

  it('aucun navigator.onLine dans le code de src/ (R-SYN-30, commentaires exclus)', () => {
    for (const file of files) {
      expect(withoutComments(readFileSync(file, 'utf8')), rel(file)).not.toContain('navigator.onLine');
    }
    expect(withoutComments('// navigator.onLine\n/* navigator.onLine */ x')).not.toContain('navigator');
    expect(withoutComments('const a = navigator.onLine;')).toContain('navigator.onLine');
  });

  it('le motif détecte bien un import interdit', () => {
    const sample = "import { getMeta } from '../../local-db/meta';\nimport Dexie from 'dexie';";
    const found = [...sample.matchAll(IMPORT)].map((m) => m[1]);
    expect(found).toEqual(['../../local-db/meta', 'dexie']);
  });
});

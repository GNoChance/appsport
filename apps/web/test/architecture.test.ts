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

/** `import … from 'x'`, `export … from 'x'`, `import('x')` et import pour effet de bord `import 'x'`. */
const IMPORT =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

/** Toute lecture de `onLine` : `navigator.onLine`, `navigator?.onLine`, `['onLine']`, déstructuration. */
const ON_LINE = /\bonLine\b/;

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const specifiers = (text: string): string[] =>
  [...text.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');

const imports = (file: string): string[] => specifiers(withoutComments(readFileSync(file, 'utf8')));

describe('architecture', () => {
  const files = [...walk(SRC)].filter(code);

  it('features/, ui/, App.tsx et src/sw/**/*.tsx n’importent ni dexie ni local-db/', () => {
    const screens = files.filter((f) => isScreen(rel(f)));
    expect(screens.length).toBeGreaterThan(5);
    for (const file of screens) {
      for (const spec of imports(file)) {
        expect(spec, rel(file)).not.toMatch(/^dexie(\/|$)/);
        expect(spec, rel(file)).not.toMatch(/(^|\/)local-db(\/|$)/);
      }
    }
  });

  it('aucune lecture de onLine dans le code de src/ (R-SYN-30, commentaires exclus)', () => {
    for (const file of files) {
      expect(withoutComments(readFileSync(file, 'utf8')), rel(file)).not.toMatch(ON_LINE);
    }
  });

  it('le motif onLine voit toutes les formes, pas les commentaires', () => {
    for (const sample of [
      'const a = navigator.onLine;',
      'const a = navigator?.onLine;',
      "const a = navigator['onLine'];",
      'const { onLine } = navigator;',
    ]) {
      expect(withoutComments(sample), sample).toMatch(ON_LINE);
    }
    expect(withoutComments('// navigator.onLine\n/* navigator.onLine */ x')).not.toMatch(ON_LINE);
    expect('const online = true; window.ononline = f;').not.toMatch(ON_LINE);
  });

  it('le motif détecte bien un import interdit, effet de bord compris', () => {
    const sample = [
      "import { getMeta } from '../../local-db/meta';",
      "import Dexie from 'dexie';",
      "import 'dexie';",
      "export { x } from './local-db/db';",
      "const m = import('dexie');",
    ].join('\n');
    expect(specifiers(sample)).toEqual(['../../local-db/meta', 'dexie', 'dexie', './local-db/db', 'dexie']);
  });
});

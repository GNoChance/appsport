import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

type Pkg = Record<string, unknown>;
const root = resolve(import.meta.dirname, '../../../..');
const readPkg = (dir: string): Pkg => JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8'));

function runeDeps(dir: string, field: 'dependencies' | 'devDependencies' = 'dependencies'): string[] {
  const deps = (readPkg(dir)[field] ?? {}) as Record<string, string>;
  return Object.keys(deps)
    .filter((name) => name.startsWith('@rune/'))
    .sort();
}

it('respecte le graphe de dépendances entre paquets', () => {
  expect(runeDeps('packages/contracts')).toEqual([]);
  expect(runeDeps('packages/domain')).toEqual(['@rune/contracts']);
  expect(runeDeps('apps/server')).toEqual(['@rune/contracts', '@rune/domain']);
  expect(runeDeps('apps/web', 'dependencies')).toEqual(['@rune/contracts', '@rune/domain']);
  expect(runeDeps('apps/web', 'devDependencies')).toEqual(['@rune/server']);
});

it('fige le gestionnaire de paquets et la version de Node', () => {
  const rootPkg = readPkg('.') as { packageManager: string; engines: { node: string } };
  expect(rootPkg.packageManager.startsWith('pnpm@10.')).toBe(true);
  expect(rootPkg.engines.node).toBe('>=24.7');
});

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP_RESOURCES } from '../src/help-resources';

const REPO = resolve(import.meta.dirname, '../../..');
const SKIPPED = new Set(['node_modules', 'dist', '.e2e-data', '.superpowers']);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

describe('HELP_RESOURCES', () => {
  it("liste les ressources dans l'ordre", () => {
    expect(HELP_RESOURCES.map((r) => r.id)).toEqual([
      'emergency',
      'pain',
      'eating_disorder',
      'doping',
      'pregnancy',
      'distress',
    ]);
  });

  it('porte les numéros vérifiés, seule la détresse a des horaires', () => {
    const phone = Object.fromEntries(HELP_RESOURCES.map((r) => [r.id, r.phone]));
    expect(phone).toEqual({
      emergency: '15 / 112',
      pain: null,
      eating_disorder: '09 69 325 900',
      doping: '0 800 15 2000',
      pregnancy: null,
      distress: '3114',
    });
    for (const r of HELP_RESOURCES) expect(r.verifiedOn).toBe('2026-10-06');
    expect(HELP_RESOURCES.filter((r) => r.hours !== null).map((r) => r.id)).toEqual(['distress']);
  });

  it("l'ancien numéro TCA n'apparaît dans aucun fichier de apps/, packages/, data/", () => {
    const old = ['0810', '037', '037'].join(' ');
    const hits: string[] = [];
    for (const top of ['apps', 'packages', 'data']) {
      for (const file of walk(join(REPO, top))) {
        if (readFileSync(file).toString('utf8').includes(old)) hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});

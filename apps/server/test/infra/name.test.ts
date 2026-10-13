import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePassword } from '@rune/domain';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** L'ancien nom de code, recomposé pour que ce fichier ne le contienne pas lui-même. */
const OLD_NAME = ['app', 'sport'].join('');

/**
 * Les deux seules traces permises, au caractère près : l'entrée de `RESERVED_USERNAMES` (le pseudo
 * reste réservé) et le nom de fichier historique de la spec principale, cité par les docs.
 */
const ALLOWED = [`'admin', 'rune', '${OLD_NAME}', 'systeme'`, `2026-10-06-${OLD_NAME}-design`];

/** Historique : ces dossiers gardent l'ancien nom de code. */
const HISTORY = ['docs/superpowers/', 'docs/research/'];

/** Retire les traces permises, puis cherche l'ancien nom sans tenir compte de la casse. */
function mentionsOldName(text: string): boolean {
  const rest = ALLOWED.reduce((acc, allowed) => acc.split(allowed).join(''), text);
  return rest.toLowerCase().includes(OLD_NAME);
}

/** Fichiers suivis par git hors historique, dans leur état de la copie de travail. */
function trackedFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return listed.split('\0').filter((rel) => {
    if (!rel || HISTORY.some((dir) => rel.startsWith(dir))) return false;
    return statSync(join(ROOT, rel), { throwIfNoEntry: false })?.isFile() ?? false;
  });
}

describe("tout s'appelle Rune", () => {
  it("aucun chemin suivi ne porte l'ancien nom de code", () => {
    const files = trackedFiles();
    expect(files).toContain('package.json');
    expect(files.filter(mentionsOldName)).toEqual([]);
  });

  it("aucun fichier texte suivi ne contient l'ancien nom de code", () => {
    const hits = trackedFiles().filter((rel) => {
      const bytes = readFileSync(join(ROOT, rel));
      return !bytes.includes(0) && mentionsOldName(bytes.toString('utf8'));
    });
    expect(hits).toEqual([]);
  });

  it("P1 donne l'adresse définitive https://rune.<tailnet>.ts.net, à APP_ORIGIN et RUNE_URL compris", () => {
    const p1 = readFileSync(join(ROOT, 'docs/exploitation/P1-installation.md'), 'utf8');
    // Les deux lignes qui pilotent l'hôte : l'origine que vérifie le serveur, l'adresse que sonde rune-alive.
    expect(p1).toMatch(/^\s*APP_ORIGIN=https:\/\/rune\.<tailnet>\.ts\.net$/m);
    expect(p1).toMatch(/^\s*RUNE_URL=https:\/\/rune\.<tailnet>\.ts\.net$/m);
    // Toute machine du tailnet que nomme la procédure est `rune` : ni « prune », ni « runes ».
    const hosts = [...p1.matchAll(/(?<![\w.-])([\w.-]+)\.<tailnet>\.ts\.net/g)].map((m) => m[1]);
    expect(hosts.length).toBeGreaterThan(0);
    expect(new Set(hosts)).toEqual(new Set(['rune']));
  });

  it('R-MDP-3 refuse un mot de passe qui contient « rune », sans tenir compte de la casse', () => {
    const ctx = { username: 'lea', role: 'member' as const, commonPasswords: new Set<string>() };
    expect(validatePassword('MaRune2026!!', ctx)).toEqual({ ok: false, reason: 'contains_app_name' });
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCssBlocks } from '../support/css-blocks';

const FILE = resolve(import.meta.dirname, '../../src/features/admin/admin.module.css');
const source = () => readFileSync(FILE, 'utf8');

/** Déclarations des règles dont la liste de sélecteurs contient `selector`, dans ce contexte, fusionnées. */
const rule = (selector: string, media: string | null = null) =>
  new Map(
    parseCssBlocks(source())
      .filter((b) => b.media === media && b.selector.split(', ').includes(selector))
      .flatMap((b) => [...b.declarations]),
  );

describe('admin.module.css : jetons, cibles tactiles et mouvement (spec refonte §4, §7)', () => {
  it('aucune couleur écrite en dur : chaque couleur vient de tokens.css, juste dans les 5 thèmes', () => {
    const css = source().replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi) ?? [];
    expect(literals).toEqual([]);
    expect(css).not.toMatch(/var\(--color-/);
  });

  it('cibles de 44 px : sous-navigation, « Actions pour … », « Fermer » de la feuille, boutons compacts', () => {
    expect(rule('.nav a').get('min-height')).toBe('44px');
    for (const selector of ['.moreButton', '.closeButton']) {
      expect(rule(selector).get('width'), selector).toBe('44px');
      expect(rule(selector).get('height'), selector).toBe('44px');
    }
    expect(rule('.compact').get('min-height')).toBe('44px');
  });

  it('les barres de disque se remplissent sur la courbe unique, et plus du tout sous mouvement réduit', () => {
    const animation = rule('.barFill').get('animation') ?? '';
    expect(animation).toContain('var(--dur-screen)');
    expect(animation).toContain('var(--ease)');
    expect(rule('.barFill', '(prefers-reduced-motion: reduce)').get('animation')).toBe('none');
  });
});

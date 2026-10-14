import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { svgToJsx } from '../../scripts/svg-to-tsx.mjs';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/svg-to-tsx.mjs');

/** Une variante convertie depuis un SVG en ligne, sous un nom de fichier d'essai. */
const convert = (svg: string) => svgToJsx(svg, 'essai.svg', { fnName: 'essai', variant: 'E' });

describe('svg-to-tsx.mjs : ce qu’il refuse (règle P4, CSP default-src self)', () => {
  it('un élément <style> fait échouer la conversion', () => {
    expect(() => convert('<svg viewBox="0 0 1 1"><style></style></svg>')).toThrow(/<style> refusé/);
    expect(() => convert('<svg viewBox="0 0 1 1"><style>.a{fill:red}</style></svg>')).toThrow(/essai\.svg/);
  });

  it('un attribut style fait échouer la conversion', () => {
    expect(() => convert('<svg viewBox="0 0 1 1"><path style="fill:red" d="M0 0" /></svg>')).toThrow(
      /attribut style refusé/,
    );
  });

  it('un attribut d’événement fait échouer la conversion, sur la racine comme dans le dessin', () => {
    expect(() => convert('<svg viewBox="0 0 1 1" onload="x()"><path d="M0 0" /></svg>')).toThrow(
      /attribut onload refusé/,
    );
    expect(() => convert('<svg viewBox="0 0 1 1"><path onClick="x()" d="M0 0" /></svg>')).toThrow(
      /attribut onClick refusé/,
    );
  });

  it('un lien (href, xlink:href) ou un attribut à espace de noms fait échouer la conversion', () => {
    expect(() => convert('<svg viewBox="0 0 1 1"><path xlink:href="#a" d="M0 0" /></svg>')).toThrow(
      /attribut xlink:href refusé/,
    );
    expect(() => convert('<svg viewBox="0 0 1 1"><path href="#a" d="M0 0" /></svg>')).toThrow(
      /attribut href refusé/,
    );
    expect(() => convert('<svg viewBox="0 0 1 1"><path xml:space="x" d="M0 0" /></svg>')).toThrow(
      /attribut xml:space refusé/,
    );
  });

  // biome-ignore lint/suspicious/noTemplateCurlyInString: valeur piégée qu'une source SVG pourrait contenir
  it.each(['${x}', '`x`', '{x}', 'a\\b', 'a<b', 'a>b'])(
    'une valeur « %s » fait échouer la conversion',
    (value) => {
      expect(() => convert(`<svg viewBox="0 0 1 1"><path fill="${value}" d="M0 0" /></svg>`)).toThrow(
        /valeur de fill refusée/,
      );
    },
  );

  it('un élément hors du dessin (script, image, foreignObject, use) fait échouer la conversion', () => {
    for (const element of ['script', 'image', 'foreignObject', 'use']) {
      expect(() => convert(`<svg viewBox="0 0 1 1"><${element} /></svg>`), element).toThrow(
        new RegExp(`<${element}> refusé`),
      );
    }
  });
});

describe('svg-to-tsx.mjs : ce qu’il produit', () => {
  it('ids et url(#…) préfixés, attributs en camelCase, aucun style ni événement', () => {
    const out = convert(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10">',
        '<defs><linearGradient id="g"><stop offset="0" stop-color="red" /></linearGradient></defs>',
        '<path d="M0 0" fill="url(#g)" stroke-width="2" />',
        '</svg>',
      ].join(''),
    );
    // biome-ignore lint/suspicious/noTemplateCurlyInString: le texte TSX généré, littéral voulu
    expect(out).toContain('id={`${p}-g`}');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: le texte TSX généré, littéral voulu
    expect(out).toContain('fill={`url(#${p}-g)`}');
    expect(out).toContain('strokeWidth="2"');
    expect(out).toContain('stopColor="red"');
    expect(out).toContain('data-variant="E"');
    expect(out).not.toMatch(/xmlns|width="10"|style|\son[A-Z]/);
  });

  // Lance biome une fois par fichier généré : plus lent qu'un test de rendu, d'où le délai plus large.
  it('les fichiers versionnés sont exactement ce que le script génère depuis docs/brand (--check)', {
    timeout: 60_000,
  }, () => {
    const output = execFileSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    expect(output).toContain('à jour');
  });
});

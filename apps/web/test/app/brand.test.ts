import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';
import { RuneMark, RuneWordmark } from '../../src/ui/Logo';

// Marque Rune (spec refonte §3) : logo « Rang brisé » de docs/brand/, nom et couleurs de l'appli installée.

const WEB = resolve(import.meta.dirname, '../..');
const BRAND = resolve(WEB, '../../docs/brand');
const LOGO_SOURCE = join(WEB, 'src/ui/Logo.tsx');

/** Fond nuit du logo : --bg du thème sombre (tokens.css) et fond de l'icône maskable. */
const NIGHT = '#070A12';

/** Éléments sous `svg` dans l'ordre du document, sans le titre ni les simples groupes de mise en couleur. */
function drawing(svg: Element): Element[] {
  return [...svg.querySelectorAll('*')].filter((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'title') return false;
    const attrs = [...el.attributes].map((a) => a.name);
    return !(tag === 'g' && attrs.every((name) => name === 'style'));
  });
}

/**
 * Dessin normalisé : balise et attributs (noms en minuscules, triés), sans `id` ni `style` ; chaque
 * `url(#…)` devient le rang de sa cible parmi les définitions, pour comparer deux jeux d'identifiants.
 */
function normalized(svg: Element): string[] {
  const elements = drawing(svg);
  const defs = elements.filter((el) => el.id).map((el) => el.id);
  return elements.map((el) => {
    const attrs = [...el.attributes]
      .filter((a) => a.name !== 'id' && a.name !== 'style')
      .map((a) => {
        const value = a.value.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#def${defs.indexOf(id)})`);
        return `${a.name.toLowerCase()}=${value}`;
      })
      .sort();
    return [el.tagName.toLowerCase(), ...attrs].join(' ');
  });
}

/** Fichier SVG de docs/brand/, analysé comme l'est un SVG en ligne. */
function brandSvg(file: string): Element {
  const host = document.createElement('div');
  host.innerHTML = readFileSync(join(BRAND, file), 'utf8');
  const svg = host.querySelector('svg');
  if (!svg) throw new Error(`${file} : aucun svg`);
  return svg;
}

const svgOf = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('aucun svg rendu');
  return svg;
};

describe('appli installée', () => {
  const manifest = JSON.parse(readFileSync(join(WEB, 'public/manifest.webmanifest'), 'utf8'));

  it('manifeste : « Rune », fond nuit du logo, icônes 192, 512 et maskable 512 présentes', () => {
    expect(manifest).toMatchObject({
      name: 'Rune',
      short_name: 'Rune',
      theme_color: NIGHT,
      background_color: NIGHT,
    });
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map(({ sizes, purpose }) => `${sizes} ${purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
    for (const { src } of icons) expect(existsSync(join(WEB, 'public', src)), src).toBe(true);
  });
});

describe('RuneMark', () => {
  it('avec un titre : svg role="img" nommé par ce titre', () => {
    render(createElement(RuneMark, { title: 'Rune' }));
    const mark = screen.getByRole('img', { name: 'Rune' });
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(mark.getAttribute('aria-hidden')).toBeNull();
  });

  it('sans titre : décoratif, masqué aux lecteurs d’écran, sans aucun id', () => {
    const { container } = render(createElement(RuneMark));
    const svg = svgOf(container);
    expect(screen.queryByRole('img')).toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('taille : carrée, 28 px par défaut (en-tête des maquettes) ou celle donnée', () => {
    const { container, rerender } = render(createElement(RuneMark));
    expect([svgOf(container).getAttribute('width'), svgOf(container).getAttribute('height')]).toEqual([
      '28',
      '28',
    ]);
    rerender(createElement(RuneMark, { size: 92 }));
    expect([svgOf(container).getAttribute('width'), svgOf(container).getAttribute('height')]).toEqual([
      '92',
      '92',
    ]);
    expect(svgOf(container).getAttribute('viewBox')).toBe('0 0 512 512');
  });

  it('sans lueur : le dessin de rune-mark-mono.svg, en currentColor, sans dégradé ni filtre', () => {
    const { container } = render(createElement(RuneMark, { title: 'Rune' }));
    const svg = svgOf(container);
    expect(normalized(svg)).toEqual(normalized(brandSvg('rune-mark-mono.svg')));
    expect(svg.querySelector('linearGradient, radialGradient, filter')).toBeNull();
  });

  it('sans lueur : cadre et repères suivent --rune-mark-frame (repli currentColor), la rune suit currentColor', () => {
    const { container } = render(createElement(RuneMark));
    const [frame, ticks, rune] = [...svgOf(container).querySelectorAll('path')];
    for (const part of [frame, ticks]) {
      expect(part?.closest('g')?.getAttribute('style')).toMatch(
        /^color:\s*var\(--rune-mark-frame,\s*currentColor\);?$/,
      );
    }
    expect(rune?.closest('g')).toBeNull();
    expect(rune?.getAttribute('fill')).toBe('currentColor');
  });

  it('avec lueur : le dessin de rune-mark.svg, dégradés et lueur compris', () => {
    const { container } = render(createElement(RuneMark, { glow: true, title: 'Rune' }));
    expect(normalized(svgOf(container))).toEqual(normalized(brandSvg('rune-mark.svg')));
  });

  it('deux marques avec lueur : aucun id en double, chaque url(#…) vise sa propre marque', () => {
    const { container } = render(
      createElement(
        Fragment,
        null,
        createElement(RuneMark, { glow: true, title: 'Rune' }),
        createElement(RuneMark, { glow: true, title: 'Logo de Rune' }),
      ),
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Rune' })).not.toBe(
      screen.getByRole('img', { name: 'Logo de Rune' }),
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids).toHaveLength(8); // par marque : titre, 2 dégradés, 1 filtre
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    for (const svg of container.querySelectorAll('svg')) {
      const own = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
      const refs = [...svg.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(own.has(ref ?? ''), ref).toBe(true);
    }
  });

  it('SVG écrit en JSX : aucun dangerouslySetInnerHTML', () => {
    expect(readFileSync(LOGO_SOURCE, 'utf8')).not.toContain('dangerouslySetInnerHTML');
  });
});

describe('RuneWordmark', () => {
  /** Le mot, rendu dans un parent en 10 px (1 em = 10 px) qui pose `parentStyle`. */
  function wordIn(parentStyle: Record<string, string>): HTMLElement {
    render(
      createElement('div', { style: { fontSize: '10px', ...parentStyle } }, createElement(RuneWordmark)),
    );
    return screen.getByText('RUNE');
  }

  it('le mot « RUNE » en police d’affichage, espacé de 0,22 em, centré sur ses lettres', () => {
    const word = wordIn({});
    expect(word.style.fontFamily).toBe('var(--font-display)');
    expect(word.style.fontWeight).toBe('700');
    expect(getComputedStyle(word).letterSpacing).toBe('2.2px');
    // L'espacement qui suit le E final est retiré : rien ne dépasse à droite du mot.
    expect(getComputedStyle(word).marginInlineEnd).toBe('calc(-1 * 0.22em)');
  });

  it('--rune-wordmark-tracking règle l’espacement et la marge qui le compense (0,3 em de la connexion, A01)', () => {
    const word = getComputedStyle(wordIn({ '--rune-wordmark-tracking': '0.3em' }));
    expect(word.letterSpacing).toBe('3px');
    expect(word.marginInlineEnd).toBe('calc(-1 * 0.3em)');
  });
});

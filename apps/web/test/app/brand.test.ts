import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { createElement, Fragment, useId } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RuneMark, RuneWordmark } from '../../src/ui/Logo';

// Marque Rune (spec refonte §3) : logo « Rang brisé » de docs/brand/, nom et couleurs de l'appli installée.

const WEB = resolve(import.meta.dirname, '../..');
const BRAND = resolve(WEB, '../../docs/brand');
const LOGO_SOURCE = join(WEB, 'src/ui/Logo.tsx');

/** Fond nuit du logo : --bg du thème sombre (tokens.css) et fond de l'icône maskable. */
const NIGHT = '#070A12';

/** Style du groupe qui met cadre et repères de la marque mono à `--rune-mark-frame`. */
const FRAME_COLOR_STYLE = /^color:\s*var\(--rune-mark-frame,\s*currentColor\);?$/;

/** Ce groupe de mise en couleur, absent des fichiers de docs/brand : un `g` dont ce style est le seul attribut. */
const isFrameColorGroup = (el: Element): boolean =>
  el.tagName.toLowerCase() === 'g' &&
  el.attributes.length === 1 &&
  FRAME_COLOR_STYLE.test(el.getAttribute('style') ?? '');

/** Éléments sous `svg` dans l'ordre du document, sans le titre ni le groupe de mise en couleur. */
function drawing(svg: Element): Element[] {
  return [...svg.querySelectorAll('*')].filter(
    (el) => el.tagName.toLowerCase() !== 'title' && !isFrameColorGroup(el),
  );
}

/** Place dans l'arbre : balises des ancêtres depuis le svg, sans le groupe de mise en couleur. */
function lineage(el: Element, svg: Element): string {
  const tags: string[] = [];
  for (let parent = el.parentElement; parent && parent !== svg; parent = parent.parentElement) {
    if (!isFrameColorGroup(parent)) tags.unshift(parent.tagName.toLowerCase());
  }
  return ['svg', ...tags].join('>');
}

/**
 * Dessin normalisé : place dans l'arbre, balise et attributs (noms en minuscules, triés, `style` compris),
 * sans `id` ; chaque `url(#…)` devient le rang de sa cible parmi les définitions, pour comparer deux jeux
 * d'identifiants.
 */
function normalized(svg: Element): string[] {
  const elements = drawing(svg);
  const defs = elements.filter((el) => el.id).map((el) => el.id);
  return elements.map((el) => {
    const attrs = [...el.attributes]
      .filter((a) => a.name !== 'id')
      .map((a) => {
        const value = a.value.replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#def${defs.indexOf(id)})`);
        return `${a.name.toLowerCase()}=${value}`;
      })
      .sort();
    return [lineage(el, svg), el.tagName.toLowerCase(), ...attrs].join(' ');
  });
}

/** Cibles `#…` d'une marque : ses `url(#…)` et l'id de son titre (`aria-labelledby`). */
function references(svg: Element): string[] {
  const values = [svg, ...svg.querySelectorAll('*')].flatMap((el) =>
    [...el.attributes].map((a) => (a.name === 'aria-labelledby' ? `url(#${a.value})` : a.value)),
  );
  return values.flatMap((value) => [...value.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] ?? ''));
}

/**
 * Identifiants des marques rendues : `perMark` ids par marque, tous distincts et dans [A-Za-z0-9_-] ;
 * chaque référence d'une marque vise un id de cette même marque.
 */
function expectOwnIds(container: Element, perMark: number): void {
  const svgs = [...container.querySelectorAll('svg')];
  const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
  expect(ids).toHaveLength(svgs.length * perMark);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  for (const svg of svgs) {
    const own = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
    const refs = references(svg);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(own.has(ref), ref).toBe(true);
  }
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
      expect(part?.closest('g')?.getAttribute('style')).toMatch(FRAME_COLOR_STYLE);
    }
    expect(rune?.closest('g')).toBeNull();
    expect(rune?.getAttribute('fill')).toBe('currentColor');
  });

  it('avec lueur : le dessin de rune-mark.svg, dégradés et lueur compris', () => {
    const { container } = render(createElement(RuneMark, { glow: true, title: 'Rune' }));
    expect(normalized(svgOf(container))).toEqual(normalized(brandSvg('rune-mark.svg')));
  });

  // Par marque : 2 dégradés et 1 filtre, plus l'id du titre quand elle en a un.
  it.each([
    { cas: 'sans titre (décoratives)', titles: [undefined, undefined], perMark: 3 },
    { cas: 'au même titre', titles: ['Rune', 'Rune'], perMark: 4 },
    { cas: 'à titres différents', titles: ['Rune', 'Logo de Rune'], perMark: 4 },
  ])(
    'deux marques avec lueur $cas : ids distincts, chaque url(#…) vise sa propre marque',
    ({ titles, perMark }) => {
      const { container } = render(
        createElement(
          Fragment,
          null,
          ...titles.map((title, key) => createElement(RuneMark, { key, glow: true, title })),
        ),
      );
      expect(container.querySelectorAll('svg')).toHaveLength(2);
      expectOwnIds(container, perMark);
    },
  );

  it('useId à caractères interdits (identifierPrefix) : ids réduits à [A-Za-z0-9_-], références intactes', () => {
    // React 19.3 rend déjà des useId sûrs (_r_0_) : ce préfixe y glisse un deux-points et des guillemets
    // français, pour que l'assainissement de Logo.tsx soit réellement éprouvé (la sonde le vérifie).
    let raw = '';
    function Probe() {
      raw = useId();
      return null;
    }
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host, { identifierPrefix: 'p:«»' });
    try {
      act(() => {
        root.render(
          createElement(
            Fragment,
            null,
            createElement(Probe),
            createElement(RuneMark, { glow: true, title: 'Rune' }),
            createElement(RuneMark, { glow: true, title: 'Rune' }),
          ),
        );
      });
      expect(raw).not.toMatch(/^[A-Za-z0-9_-]+$/);
      expectOwnIds(host, 4);
      expect(screen.getAllByRole('img', { name: 'Rune' })).toHaveLength(2);
    } finally {
      act(() => root.unmount());
      host.remove();
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

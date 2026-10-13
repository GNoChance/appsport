import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  readThemeChoice,
  THEME_CHOICES,
  type ThemeChoice,
  useThemeChoice,
  writeThemeChoice,
} from '../../src/ui/theme/theme';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const WEB = resolve(import.meta.dirname, '../..');
const SRC = join(WEB, 'src');
const THEME_DIR = join(SRC, 'ui/theme');
const read = (path: string) => readFileSync(path, 'utf8');
const tokensBlocks = () => parseCssBlocks(read(join(THEME_DIR, 'tokens.css')));

const KEY = 'rune.theme';
const DARK = '(prefers-color-scheme: dark)';
const html = () => document.documentElement;
const themeColors = () =>
  [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content'));

/** `prefers-color-scheme` du téléphone, réglable pendant le test. */
function stubColorScheme(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const query = {
    matches: dark,
    media: DARK,
    addEventListener: (_type: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeEventListener: (_type: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', (q: string) =>
    q === DARK
      ? query
      : { ...query, matches: false, media: q, addEventListener() {}, removeEventListener() {} },
  );
  return {
    set(next: boolean) {
      query.matches = next;
      for (const l of [...listeners]) l({ matches: next });
    },
    listeners: () => listeners.size,
  };
}

/** Comme index.html : une balise theme-color dans le head. */
function resetDocument() {
  html().removeAttribute('data-theme');
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#000000';
  document.head.append(meta);
}

beforeEach(() => {
  localStorage.clear();
  stubColorScheme(false);
  resetDocument();
});

afterEach(() => {
  applyTheme('clair'); // détache l'écoute du mode Auto d'un test à l'autre
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('choix de l’apparence, gardé sur l’appareil', () => {
  it('THEME_CHOICES : Auto puis les 4 thèmes', () => {
    expect(THEME_CHOICES).toEqual(['auto', 'clair', 'sombre', 'carnet', 'nuit']);
  });

  it('readThemeChoice : « auto » sans rien en stockage', () => {
    expect(readThemeChoice()).toBe('auto');
  });

  it('readThemeChoice : « auto » quand localStorage.getItem lève (stockage bloqué)', () => {
    const getItem = vi.fn(() => {
      throw new DOMException('Accès refusé', 'SecurityError');
    });
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn(), removeItem: vi.fn() });
    expect(readThemeChoice()).toBe('auto');
    expect(getItem).toHaveBeenCalledWith(KEY);
  });

  it('readThemeChoice : une valeur inconnue en stockage vaut « auto »', () => {
    localStorage.setItem(KEY, 'fluo');
    expect(readThemeChoice()).toBe('auto');
  });

  it('writeThemeChoice garde chaque choix sous la clé rune.theme, relu tel quel', () => {
    for (const choice of THEME_CHOICES) {
      writeThemeChoice(choice);
      expect(localStorage.getItem(KEY)).toBe(choice);
      expect(readThemeChoice()).toBe(choice);
    }
  });

  it('writeThemeChoice ne lève pas quand le stockage refuse l’écriture', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota dépassé', 'QuotaExceededError');
      },
    });
    expect(() => writeThemeChoice('carnet')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('pose data-theme pour un thème forcé, le retire pour Auto', () => {
    applyTheme('clair');
    expect(html().getAttribute('data-theme')).toBe('clair');
    applyTheme('nuit');
    expect(html().getAttribute('data-theme')).toBe('nuit');
    applyTheme('auto');
    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('agit sur la racine donnée', () => {
    const root = document.createElement('div');
    applyTheme('carnet', root);
    expect(root.getAttribute('data-theme')).toBe('carnet');
    expect(html().hasAttribute('data-theme')).toBe(false);
  });

  it('theme-color : #F1F3F7 en clair, #070A12 en sombre', () => {
    applyTheme('clair');
    expect(themeColors()).toEqual(['#F1F3F7']);
    applyTheme('sombre');
    expect(themeColors()).toEqual(['#070A12']);
  });

  it('theme-color de chaque thème forcé = son --bg dans tokens.css', () => {
    const blocks = tokensBlocks();
    const bgOf = (choice: Exclude<ThemeChoice, 'auto'>) =>
      declarationsOf(blocks, choice === 'clair' ? ':root' : `:root[data-theme="${choice}"]`)?.get('--bg');
    for (const choice of ['clair', 'sombre', 'carnet', 'nuit'] as const) {
      applyTheme(choice);
      const bg = bgOf(choice);
      expect(bg, `--bg du thème ${choice}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(themeColors()[0]?.toUpperCase(), choice).toBe(bg?.toUpperCase());
    }
  });

  it('met à jour chaque balise theme-color, et en crée une si la page n’en a pas', () => {
    const second = document.createElement('meta');
    second.name = 'theme-color';
    second.media = DARK;
    document.head.append(second);
    applyTheme('sombre');
    expect(themeColors()).toEqual(['#070A12', '#070A12']);
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove();
    applyTheme('clair');
    expect(themeColors()).toEqual(['#F1F3F7']);
  });

  it('Auto : theme-color suit le réglage du téléphone à l’appel puis à chaque changement', () => {
    const scheme = stubColorScheme(true);
    applyTheme('auto');
    expect(themeColors()).toEqual(['#070A12']);
    scheme.set(false);
    expect(themeColors()).toEqual(['#F1F3F7']);
    scheme.set(true);
    expect(themeColors()).toEqual(['#070A12']);
  });

  it('un thème forcé cesse de suivre le téléphone ; un second Auto n’empile pas d’écoute', () => {
    const scheme = stubColorScheme(false);
    applyTheme('auto');
    applyTheme('auto');
    expect(scheme.listeners()).toBe(1);
    applyTheme('carnet');
    expect(scheme.listeners()).toBe(0);
    scheme.set(true);
    expect(themeColors()).toEqual(['#F2ECDF']);
    expect(html().getAttribute('data-theme')).toBe('carnet');
  });
});

describe('useThemeChoice', () => {
  it('rend le thème appliqué, « auto » par défaut', () => {
    const { result } = renderHook(() => useThemeChoice());
    expect(result.current[0]).toBe('auto');
  });

  it('le réglage garde le choix, l’applique et met à jour chaque composant abonné', () => {
    const first = renderHook(() => useThemeChoice());
    const second = renderHook(() => useThemeChoice());
    act(() => first.result.current[1]('carnet'));
    expect(localStorage.getItem(KEY)).toBe('carnet');
    expect(html().getAttribute('data-theme')).toBe('carnet');
    expect(first.result.current[0]).toBe('carnet');
    expect(second.result.current[0]).toBe('carnet');
    act(() => second.result.current[1]('auto'));
    expect(localStorage.getItem(KEY)).toBe('auto');
    expect(html().hasAttribute('data-theme')).toBe(false);
    expect(first.result.current[0]).toBe('auto');
  });

  it('suit un thème appliqué au démarrage (main.tsx), même sans appel au réglage', () => {
    localStorage.setItem(KEY, 'nuit');
    applyTheme(readThemeChoice());
    const { result } = renderHook(() => useThemeChoice());
    expect(result.current[0]).toBe('nuit');
  });
});

describe('tokens.css', () => {
  const COLOR_TOKENS = [
    '--bg',
    '--surface',
    '--surface-strong',
    '--border',
    '--text',
    '--text-muted',
    '--accent',
    '--accent-text',
    '--accent-2',
    '--danger',
    '--success',
    '--warning-text',
    '--warning-bg',
    '--field-bg',
    '--field-border',
    '--focus',
  ];

  it('sous prefers-color-scheme: dark, seul :root:not([data-theme]) est redéfini (un thème forcé l’emporte)', () => {
    const inMedia = tokensBlocks().filter((b) => b.media !== null);
    expect(inMedia.map((b) => [b.media, b.selector])).toEqual([[DARK, ':root:not([data-theme])']]);
  });

  it('un bloc par thème forcé, hors media query', () => {
    const blocks = tokensBlocks();
    for (const choice of ['clair', 'sombre', 'carnet', 'nuit']) {
      expect(declarationsOf(blocks, `:root[data-theme="${choice}"]`), choice).not.toBeNull();
    }
  });

  it(':root (clair) déclare tous les jetons imposés, rayons 18 et 14 px, titres en --font-display', () => {
    const root = declarationsOf(tokensBlocks(), ':root');
    for (const token of [...COLOR_TOKENS, '--font-display', '--font-body', '--font-title']) {
      expect(root?.get(token), token).toBeTruthy();
    }
    expect(root?.get('--radius-card')).toBe('18px');
    expect(root?.get('--radius-control')).toBe('14px');
    expect(root?.get('--font-display')).toMatch(/^"Chakra Petch",/);
    expect(root?.get('--font-body')).toMatch(/^"Barlow",/);
    expect(root?.get('--font-title')).toBe('var(--font-display)');
  });

  it('Auto en sombre et Sombre forcé ont exactement les mêmes couleurs', () => {
    const blocks = tokensBlocks();
    const auto = declarationsOf(blocks, ':root:not([data-theme])', DARK);
    const sombre = declarationsOf(blocks, ':root[data-theme="sombre"]');
    for (const token of COLOR_TOKENS) {
      expect(auto?.get(token), token).toBeTruthy();
      expect(auto?.get(token), token).toBe(sombre?.get(token));
    }
  });

  it('carnet et nuit redéfinissent toutes les couleurs ; titres du Carnet en Newsreader', () => {
    const blocks = tokensBlocks();
    for (const choice of ['carnet', 'nuit']) {
      const theme = declarationsOf(blocks, `:root[data-theme="${choice}"]`);
      for (const token of COLOR_TOKENS) expect(theme?.get(token), `${token} (${choice})`).toBeTruthy();
    }
    expect(declarationsOf(blocks, ':root[data-theme="carnet"]')?.get('--font-title')).toMatch(
      /^"Newsreader",/,
    );
  });
});

describe('feuilles de style de src/', () => {
  function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(full);
      else if (entry.isFile()) yield full;
    }
  }
  const files = [...walk(SRC)];
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const rel = (f: string) => relative(SRC, f).replaceAll('\\', '/');
  const declared = (css: string) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  it('chaque var(--…) lue a une définition : jetons, même fichier ou propriété posée par un composant', () => {
    expect(cssFiles.length).toBeGreaterThan(5);
    const tokens = declared(read(join(THEME_DIR, 'tokens.css')));
    const fromComponents = new Set(
      files
        .filter((f) => /\.tsx?$/.test(f))
        .flatMap((f) => [...read(f).matchAll(/['"](--[\w-]+)['"]/g)].map((m) => m[1])),
    );
    for (const file of cssFiles) {
      const css = read(file);
      const local = declared(css);
      // Une variable avec repli (`var(--x, 0)`) n'est jamais indéfinie.
      for (const [, name] of css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
        const known = tokens.has(name) || local.has(name) || fromComponents.has(name);
        expect(known, `${rel(file)} lit ${name}, défini nulle part`).toBe(true);
      }
    }
  });

  it('les jetons n’ont qu’une source : aucune autre feuille ne déclare de variable sur :root', () => {
    for (const file of cssFiles.filter((f) => rel(f) !== 'ui/theme/tokens.css')) {
      const rootBlocks = parseCssBlocks(read(file)).filter((b) => /:root/.test(b.selector));
      const vars = rootBlocks.flatMap((b) => [...b.declarations.keys()].filter((k) => k.startsWith('--')));
      expect(vars, rel(file)).toEqual([]);
    }
  });
});

describe('polices embarquées', () => {
  const faces = () =>
    parseCssBlocks(read(join(THEME_DIR, 'fonts.css')))
      .filter((b) => b.selector === '@font-face')
      .map((b) => b.declarations);

  it('Chakra Petch 600/700, Barlow 400/500/600, Newsreader 600, rien d’autre', () => {
    const list = faces().map((f) => `${f.get('font-family')} ${f.get('font-weight')}`);
    expect(list).toEqual([
      '"Chakra Petch" 600',
      '"Chakra Petch" 700',
      '"Barlow" 400',
      '"Barlow" 500',
      '"Barlow" 600',
      '"Newsreader" 600',
    ]);
  });

  it('chaque police : sous-ensemble latin en woff2 seul, du paquet Fontsource, font-display swap', () => {
    const require = createRequire(join(WEB, 'package.json'));
    for (const face of faces()) {
      expect(face.get('font-display')).toBe('swap');
      expect(face.get('font-style')).toBe('normal');
      const src = face.get('src') ?? '';
      const match =
        /^url\("(@fontsource\/([\w-]+)\/files\/\2-latin-(\d{3})-normal\.woff2)"\) format\("woff2"\)$/.exec(
          src,
        );
      expect(match, src).not.toBeNull();
      expect(match?.[3]).toBe(face.get('font-weight'));
      expect(() => require.resolve(match?.[1] ?? ''), src).not.toThrow();
    }
  });
});

describe('main.tsx', () => {
  it('charge jetons et polices et applique le thème gardé avant createRoot', () => {
    const main = read(join(SRC, 'main.tsx'));
    expect(main).toMatch(/^import '\.\/ui\/theme\/tokens\.css';$/m);
    expect(main).toMatch(/^import '\.\/ui\/theme\/fonts\.css';$/m);
    const apply = main.indexOf('applyTheme(readThemeChoice());');
    expect(apply).toBeGreaterThan(-1);
    expect(apply).toBeLessThan(main.indexOf('createRoot('));
  });
});

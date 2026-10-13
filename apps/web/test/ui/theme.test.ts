import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}
const srcFiles = () => [...walk(SRC)];
/** Chemin depuis src/, en barres obliques. */
const rel = (f: string) => relative(SRC, f).replaceAll('\\', '/');

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

/** Une balise theme-color dans le head (index.html en a une par schéma de couleurs : test dédié plus bas). */
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

  it('stockage bloqué dès l’accès à localStorage (SecurityError) : « auto », aucune levée, le réglage applique', () => {
    // Navigateur réel (cookies bloqués) : c'est la lecture de `localStorage` elle-même qui lève.
    const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    if (!own) throw new Error('localStorage absent de globalThis');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Accès refusé', 'SecurityError');
      },
    });
    try {
      expect(() => globalThis.localStorage).toThrow(DOMException);
      expect(readThemeChoice()).toBe('auto');
      expect(() => writeThemeChoice('nuit')).not.toThrow();
      const { result } = renderHook(() => useThemeChoice());
      act(() => result.current[1]('nuit'));
      expect(html().getAttribute('data-theme')).toBe('nuit');
      expect(themeColors()).toEqual(['#05070D']);
      expect(result.current[0]).toBe('nuit');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', own);
    }
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

  it('une autre racine (aperçu) ne reçoit que l’attribut : la page garde sa barre et suit encore le téléphone', () => {
    const scheme = stubColorScheme(true);
    applyTheme('auto');
    const preview = document.createElement('div');
    applyTheme('carnet', preview);
    expect(preview.getAttribute('data-theme')).toBe('carnet');
    expect(html().hasAttribute('data-theme')).toBe(false);
    expect(themeColors()).toEqual(['#070A12']);
    expect(scheme.listeners()).toBe(1);
    applyTheme('auto', preview);
    expect(preview.hasAttribute('data-theme')).toBe(false);
    expect(scheme.listeners()).toBe(1);
    scheme.set(false);
    expect(themeColors()).toEqual(['#F1F3F7']);
  });

  it('une autre racine n’ajoute ni écoute du téléphone ni changement de barre, même en partant d’un thème forcé', () => {
    const scheme = stubColorScheme(true);
    applyTheme('nuit');
    applyTheme('auto', document.createElement('div'));
    expect(scheme.listeners()).toBe(0);
    expect(themeColors()).toEqual(['#05070D']);
    expect(html().getAttribute('data-theme')).toBe('nuit');
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

  it('Auto sans matchMedia : couleur du thème clair, aucune levée', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => applyTheme('auto')).not.toThrow();
    expect(html().hasAttribute('data-theme')).toBe(false);
    expect(themeColors()).toEqual(['#F1F3F7']);
    expect(() => applyTheme('sombre')).not.toThrow();
    expect(themeColors()).toEqual(['#070A12']);
  });

  it('Auto avec une media query sans addEventListener (ancien Safari) : réglage lu à l’appel, aucune levée', () => {
    for (const [dark, color] of [
      [false, '#F1F3F7'],
      [true, '#070A12'],
    ] as const) {
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q === DARK && dark,
        media: q,
        addListener() {},
        removeListener() {},
      }));
      expect(() => applyTheme('auto'), `téléphone sombre : ${dark}`).not.toThrow();
      expect(themeColors(), `téléphone sombre : ${dark}`).toEqual([color]);
      expect(() => applyTheme('carnet')).not.toThrow();
      expect(themeColors()).toEqual(['#F2ECDF']);
    }
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

describe('autres onglets ouverts', () => {
  /** Ce que reçoit cette page quand un autre onglet de Rune écrit dans le stockage. */
  const fromOtherTab = (key: string | null) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    });

  it('un autre onglet choisit un thème : cette page l’applique aussi, et ses composants suivent', () => {
    applyTheme(readThemeChoice()); // démarrage, comme main.tsx
    const { result } = renderHook(() => useThemeChoice());
    localStorage.setItem(KEY, 'nuit');
    fromOtherTab(KEY);
    expect(html().getAttribute('data-theme')).toBe('nuit');
    expect(themeColors()).toEqual(['#05070D']);
    expect(result.current[0]).toBe('nuit');
  });

  it('un autre onglet vide le stockage : retour à Auto', () => {
    localStorage.setItem(KEY, 'carnet');
    applyTheme(readThemeChoice());
    const { result } = renderHook(() => useThemeChoice());
    localStorage.clear();
    fromOtherTab(null);
    expect(html().hasAttribute('data-theme')).toBe(false);
    expect(result.current[0]).toBe('auto');
  });

  it('une autre clé ne touche pas au thème ; une seule écoute malgré plusieurs applyTheme', () => {
    applyTheme('carnet');
    applyTheme('auto');
    applyTheme('carnet');
    const getItem = vi.fn((key: string) => (key === KEY ? 'nuit' : null));
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn(), removeItem: vi.fn() });
    fromOtherTab('rune.autre');
    expect(getItem).not.toHaveBeenCalled();
    expect(html().getAttribute('data-theme')).toBe('carnet');
    fromOtherTab(KEY);
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(html().getAttribute('data-theme')).toBe('nuit');
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

  it('un thème clair forcé refuse l’assombrissement automatique du navigateur ; Auto reste « light »', () => {
    const blocks = tokensBlocks();
    expect(declarationsOf(blocks, ':root')?.get('color-scheme')).toBe('light');
    for (const choice of ['clair', 'carnet']) {
      const theme = declarationsOf(blocks, `:root[data-theme="${choice}"]`);
      expect(theme?.get('color-scheme'), choice).toBe('only light');
    }
  });

  it('champs et boutons gardent 14 px dans chaque thème ; seules les cartes changent en Carnet et Salle de nuit', () => {
    const blocks = tokensBlocks();
    const root = declarationsOf(blocks, ':root');
    const themes: [string, string | null][] = [
      ...['clair', 'sombre', 'carnet', 'nuit'].map((c): [string, null] => [`:root[data-theme="${c}"]`, null]),
      [':root:not([data-theme])', DARK],
    ];
    for (const [selector, media] of themes) {
      const effective = new Map([...(root ?? []), ...(declarationsOf(blocks, selector, media) ?? [])]);
      expect(effective.get('--radius-control'), selector).toBe('14px');
    }
    expect(declarationsOf(blocks, ':root[data-theme="carnet"]')?.get('--radius-card')).toBe('4px');
    expect(declarationsOf(blocks, ':root[data-theme="nuit"]')?.get('--radius-card')).toBe('12px');
  });

  it('pont --color-* : chaque variable du socle pointe vers son jeton, sur :root seulement', () => {
    // Retirer la ligne ici aussi quand un écran refait ne la lit plus et qu'elle disparaît de tokens.css.
    const BRIDGE = {
      '--color-bg': 'var(--bg)',
      '--color-surface': 'var(--surface)',
      '--color-text': 'var(--text)',
      '--color-muted': 'var(--text-muted)',
      '--color-border': 'var(--border)',
      '--color-primary': 'var(--accent)',
      '--color-primary-text': 'var(--accent-text)',
      '--color-danger': 'var(--danger)',
      '--color-info-bg': 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
      '--color-warning-bg': 'var(--warning-bg)',
      '--radius': 'var(--radius-control)',
    };
    const isBridge = (name: string) => name.startsWith('--color-') || name === '--radius';
    const blocks = tokensBlocks();
    const root = [...(declarationsOf(blocks, ':root') ?? [])];
    expect(Object.fromEntries(root.filter(([name]) => isBridge(name)))).toEqual(BRIDGE);
    // Redéfini dans un thème, le pont ne suivrait plus ses jetons.
    for (const block of blocks.filter((b) => b.selector !== ':root' || b.media !== null)) {
      const names = [...block.declarations.keys()].filter(isBridge);
      expect(names, `${block.selector} ${block.media ?? ''}`).toEqual([]);
    }
  });
});

describe('feuilles de style de src/', () => {
  const files = srcFiles();
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const declared = (css: string) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  /** Seules feuilles qui déclarent des variables sur :root : jetons de thème, puis mouvement (Task 4). */
  const TOKENS = 'ui/theme/tokens.css';
  const MOTION = 'ui/motion.css';
  const rootVars = (file: string) =>
    parseCssBlocks(read(file))
      .filter((b) => /:root/.test(b.selector))
      .flatMap((b) => [...b.declarations.keys()].filter((k) => k.startsWith('--')));

  it('chaque var(--…) lue a une définition : jetons, mouvement, même fichier ou propriété posée par un composant', () => {
    expect(cssFiles.length).toBeGreaterThan(5);
    // tokens.css toujours ; motion.css dès que Task 4 le crée.
    const sources = [TOKENS, ...(existsSync(join(SRC, MOTION)) ? [MOTION] : [])];
    const tokens = new Set(sources.flatMap((source) => [...declared(read(join(SRC, source)))]));
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

  it('les jetons n’ont qu’une source : hors tokens.css, seul motion.css déclare sur :root, sans jeton de thème', () => {
    const themeTokens = declared(read(join(SRC, TOKENS)));
    expect(themeTokens.has('--bg')).toBe(true);
    for (const file of cssFiles.filter((f) => rel(f) !== TOKENS)) {
      const vars = rootVars(file);
      // motion.css garde ses propres variables (--ease, --dur-*), jamais un jeton de thème.
      const forbidden = rel(file) === MOTION ? vars.filter((v) => themeTokens.has(v)) : vars;
      expect(forbidden, rel(file)).toEqual([]);
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

  it('seul ui/theme/fonts.css cite @fontsource (une feuille Fontsource ajouterait sous-ensembles et .woff)', () => {
    // Le build (6 woff2 latins émis et précachés, rien d'autre) est vérifié par e2e/theme.spec.ts.
    const citing = [...srcFiles(), join(WEB, 'index.html')]
      .filter((f) => read(f).includes('@fontsource'))
      .map(rel);
    expect(citing).toEqual(['ui/theme/fonts.css']);
  });
});

describe('main.tsx', () => {
  it('charge jetons et polices et applique le thème gardé avant createRoot, au premier niveau', () => {
    const main = read(join(SRC, 'main.tsx'));
    expect(main).toMatch(/^import '\.\/ui\/theme\/tokens\.css';$/m);
    expect(main).toMatch(/^import '\.\/ui\/theme\/fonts\.css';$/m);
    // Ligne entière, sans retrait : ni commentée, ni dans une fonction appelée plus tard.
    const apply = /^applyTheme\(readThemeChoice\(\)\);$/m.exec(main);
    const render = /^createRoot\(/m.exec(main);
    expect(apply, 'appel de premier niveau').not.toBeNull();
    expect(render, 'rendu de premier niveau').not.toBeNull();
    expect(apply?.index).toBeLessThan(render?.index ?? -1);
  });
});

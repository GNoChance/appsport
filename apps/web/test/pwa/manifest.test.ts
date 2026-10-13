import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const WEB = resolve(import.meta.dirname, '../..');
const PUBLIC = join(WEB, 'public');
/** Fond nuit du logo (--bg du thème sombre), opaque. */
const NIGHT = [0x07, 0x0a, 0x12, 0xff];
/** Fond du badge de rune-icon.svg dans ses coins : dernier arrêt de son dégradé radial (#04060B), opaque. */
const BADGE_CORNER = [0x04, 0x06, 0x0b, 0xff];
/**
 * Écart toléré, canal par canal, autour de la nuit : le fond du badge près de son bord s'y fond (au plus 7, en bleu,
 * pour #04060B) ; le liseré cyan à 14 % s'en écarte d'une trentaine.
 */
const NEAR_NIGHT = 8;
const TRANSPARENT = 0;

interface Png {
  width: number;
  height: number;
  /** [R, V, B, A] ; A vaut 255 pour un PNG sans canal alpha. */
  pixel(x: number, y: number): number[];
}

/** Prédicteur de Paeth (filtre 4 du format PNG). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * PNG 8 bits RVB ou RVBA, non entrelacé, tel que l'écrit le Chromium de scripts/render-icons.mjs : taille lue
 * dans l'IHDR, lignes défiltrées (les 5 filtres du format).
 */
function readPng(name: string): Png {
  const bytes = readFileSync(join(PUBLIC, 'icons', name));
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.toString('latin1', 12, 16)).toBe('IHDR');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const [depth, colorType, , , interlace] = bytes.subarray(24, 29);
  expect({ depth, interlace }, name).toEqual({ depth: 8, interlace: 0 });
  expect([2, 6], name).toContain(colorType);
  const channels = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT')
      idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  expect(raw.length, name).toBe(height * (1 + stride));
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (1 + stride)];
    expect([0, 1, 2, 3, 4], name).toContain(filter);
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (1 + stride) + 1 + i] ?? 0;
      const a = i >= channels ? (data[y * stride + i - channels] ?? 0) : 0;
      const b = y > 0 ? (data[(y - 1) * stride + i] ?? 0) : 0;
      const c = i >= channels && y > 0 ? (data[(y - 1) * stride + i - channels] ?? 0) : 0;
      const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter ?? 0] ?? 0;
      data[y * stride + i] = (x + predicted) & 0xff;
    }
  }
  return {
    width,
    height,
    pixel: (x, y) => {
      const at = (y * width + x) * channels;
      const rgb = [...data.subarray(at, at + 3)];
      return channels === 4 ? [...rgb, data[at + 3] ?? 0] : [...rgb, 0xff];
    },
  };
}

/** Chaque pixel de l'image, avec ses coordonnées. */
function* pixels(png: Png): Generator<[number, number, number[]]> {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) yield [x, y, png.pixel(x, y)];
  }
}

/**
 * Pixels retenus par `keep` qui ne se fondent pas dans la nuit (un canal à plus de NEAR_NIGHT) : leur nombre et
 * les trois premiers, « (x, y) R,V,B,A ».
 */
function offNight(png: Png, keep: (x: number, y: number) => boolean): { count: number; first: string[] } {
  const off: string[] = [];
  for (const [x, y, p] of pixels(png)) {
    if (keep(x, y) && p.some((v, i) => Math.abs(v - (NIGHT[i] ?? 0)) > NEAR_NIGHT))
      off.push(`(${x}, ${y}) ${p}`);
  }
  return { count: off.length, first: off.slice(0, 3) };
}

/** Rune glacée de rune-icon.svg au centre de l'icône : bleu glacé opaque (dégradé #F2FDFF → #5ED8FF). */
function expectIceRuneAtCenter(png: Png, name: string): void {
  const c = Math.floor(png.width / 2);
  const [r = 0, g = 0, b = 0, a = 0] = png.pixel(c, c);
  expect({ name, a, iceBlue: b >= 220 && g >= 180 && r < g }).toEqual({ name, a: 0xff, iceBlue: true });
}

describe('manifeste PWA', () => {
  const m = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8'));

  it('identité, affichage, portée et couleurs', () => {
    expect(m).toMatchObject({
      name: 'Rune',
      short_name: 'Rune',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'fr',
    });
    // Orientation libre (WCAG 2.1 SC 1.3.4, arbitrage du propriétaire du 2026-10-08) : aucun verrou.
    expect(m).not.toHaveProperty('orientation');
    // Identité de l'appli installée fixée, indépendante de start_url (R-PWA-7).
    expect(m.id).toBe('/');
    // Fond nuit du logo pour l'écran de lancement et la barre de l'appli installée (spec refonte §3).
    expect(m).toMatchObject({
      description: 'Suivi de musculation entre proches',
      dir: 'ltr',
      background_color: '#070A12',
      theme_color: '#070A12',
    });
  });

  it('icônes 192 et 512 « any », 512 « maskable » ; les 5 PNG ont la bonne taille (IHDR)', () => {
    expect(m.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
    for (const [name, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon-180.png', 180],
      ['favicon-32.png', 32],
    ] as const) {
      const png = readPng(name);
      expect([png.width, png.height], name).toEqual([size, size]);
    }
  });

  it('« any » et onglet : le badge de rune-icon.svg, coins arrondis transparents, rune glacée au centre', () => {
    for (const name of ['icon-192.png', 'icon-512.png', 'favicon-32.png']) {
      const png = readPng(name);
      const last = png.width - 1;
      const corners = [png.pixel(0, 0), png.pixel(last, 0), png.pixel(0, last), png.pixel(last, last)];
      expect(
        corners.map((p) => p[3]),
        name,
      ).toEqual([TRANSPARENT, TRANSPARENT, TRANSPARENT, TRANSPARENT]);
      const c = Math.floor(png.width / 2);
      expect(png.pixel(c, c)[3], name).toBe(0xff);
      if (png.width > 32) expectIceRuneAtCenter(png, name);
    }
  });

  it('maskable : opaque, badge au centre, marge de 10 % en #070A12 tout autour', () => {
    const png = readPng('icon-maskable-512.png');
    const band = Math.floor(0.1 * png.width);
    const count = { notOpaque: 0, bandNotNight: 0 };
    for (const [x, y, p] of pixels(png)) {
      if (p[3] !== 0xff) count.notOpaque++;
      const inBand = x < band || y < band || x >= png.width - band || y >= png.height - band;
      if (inBand && p.join() !== NIGHT.join()) count.bandNotNight++;
    }
    expect(count).toEqual({ notOpaque: 0, bandNotNight: 0 });
    expectIceRuneAtCenter(png, 'icon-maskable-512.png');
  });

  it('maskable : sur le cercle sûr (rayon 40 %) et au-delà, rien que la nuit ; badge sans liseré, à coins carrés', () => {
    const png = readPng('icon-maskable-512.png');
    const c = png.width / 2;
    const safe = 0.4 * png.width;
    // Le système coupe sur ce cercle (masque rond) ou plus loin : le liseré cyan du badge y tracerait des arcs.
    expect(offNight(png, (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c) >= safe - 0.5)).toEqual({
      count: 0,
      first: [],
    });
    // Au ras de chaque coin du badge (carré de 80 %, de 51,2 à 460,8 px) : son fond, pas la nuit de la marge.
    // Des coins arrondis y dessineraient une tuile dans la tuile sous un masque arrondi.
    const [near, far] = [Math.ceil(0.1 * png.width), png.width - 1 - Math.ceil(0.1 * png.width)];
    for (const [x, y] of [
      [near, near],
      [far, near],
      [near, far],
      [far, far],
    ] as const) {
      expect(png.pixel(x, y), `(${x}, ${y})`).toEqual(BADGE_CORNER);
    }
  });

  it('Apple : opaque (iOS noircit la transparence), badge plein cadre sans liseré, coins carrés, rune glacée au centre', () => {
    const png = readPng('apple-touch-icon-180.png');
    let notOpaque = 0;
    for (const [, , p] of pixels(png)) if (p[3] !== 0xff) notOpaque++;
    expect(notOpaque).toBe(0);
    // iOS arrondit lui-même les coins : le long du bord (5 %), le liseré cyan du badge dessinerait un cadre.
    const band = Math.ceil(0.05 * png.width);
    const inBand = (x: number, y: number) =>
      x < band || y < band || x >= png.width - band || y >= png.height - band;
    expect(offNight(png, inBand)).toEqual({ count: 0, first: [] });
    // Coins carrés : le fond du badge va jusqu'au coin, la forme finale est celle du masque d'iOS.
    const last = png.width - 1;
    for (const [x, y] of [
      [0, 0],
      [last, 0],
      [0, last],
      [last, last],
    ] as const) {
      expect(png.pixel(x, y), `(${x}, ${y})`).toEqual(BADGE_CORNER);
    }
    expectIceRuneAtCenter(png, 'apple-touch-icon-180.png');
  });

  it('index.html : titre « Rune », manifeste, icône de l’onglet, icône Apple et couleur du thème', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    expect(html).toContain('<title>Rune</title>');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    // Icône déjà en précache : pas de requête /favicon.ico (404 journalisé), même hors ligne.
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">');
    // Avant le script, la barre suit le téléphone comme Auto (thème par défaut) : --bg du clair et du sombre.
    // main.tsx applique ensuite le thème gardé à chacune de ces balises (ui/theme/theme.ts).
    const themeColors = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map((t) => t[0]);
    expect(themeColors).toEqual([
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F3F7">',
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#070A12">',
    ]);
  });
});

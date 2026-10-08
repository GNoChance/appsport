import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const WEB = resolve(import.meta.dirname, '../..');
const PUBLIC = join(WEB, 'public');
const TEAL = [0x0f, 0x76, 0x6e];
const WHITE = [0xff, 0xff, 0xff];

interface Png {
  width: number;
  height: number;
  pixel(x: number, y: number): number[];
}

/** PNG RVB 8 bits sans filtre, tel que l'écrit scripts/make-icons.mjs ; taille lue dans l'IHDR. */
function readPng(name: string): Png {
  const bytes = readFileSync(join(PUBLIC, 'icons', name));
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.toString('latin1', 12, 16)).toBe('IHDR');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect([bytes[24], bytes[25]]).toEqual([8, 2]);
  const idat: Buffer[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT')
      idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 3;
  expect(raw.length).toBe(height * stride);
  const filters = new Set<number | undefined>();
  for (let y = 0; y < height; y++) filters.add(raw[y * stride]);
  expect([...filters]).toEqual([0]);
  return {
    width,
    height,
    pixel: (x, y) => [...raw.subarray(y * stride + 1 + x * 3, y * stride + 4 + x * 3)],
  };
}

describe('manifeste PWA', () => {
  const m = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8'));

  it('identité, affichage, portée et couleurs', () => {
    expect(m).toMatchObject({
      name: 'appsport',
      short_name: 'appsport',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'fr',
    });
    // Identité de l'appli installée fixée, indépendante de start_url (R-PWA-7).
    expect(m.id).toBe('/');
    expect(m).toMatchObject({
      description: 'Suivi de musculation entre proches',
      dir: 'ltr',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#0f766e',
    });
  });

  it('icônes 192 et 512 « any », 512 « maskable » ; les 4 PNG ont la bonne taille (IHDR)', () => {
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
    ] as const) {
      const png = readPng(name);
      expect([png.width, png.height], name).toEqual([size, size]);
    }
  });

  it('haltère blanc sur fond #0f766e, contenu dans la zone sûre de 80 % pour l’icône maskable', () => {
    for (const name of [
      'icon-192.png',
      'icon-512.png',
      'apple-touch-icon-180.png',
      'icon-maskable-512.png',
    ]) {
      const png = readPng(name);
      const c = png.width / 2;
      expect(png.pixel(0, 0), name).toEqual(TEAL);
      expect(png.pixel(png.width - 1, png.height - 1), name).toEqual(TEAL);
      expect(png.pixel(Math.floor(c), Math.floor(c)), name).toEqual(WHITE);
    }
    const maskable = readPng('icon-maskable-512.png');
    const center = maskable.width / 2;
    const radius = 0.4 * maskable.width;
    const count = { white: 0, otherColor: 0, whiteOutsideSafeZone: 0 };
    for (let y = 0; y < maskable.height; y++) {
      for (let x = 0; x < maskable.width; x++) {
        const p = maskable.pixel(x, y).join();
        if (p === WHITE.join()) {
          count.white++;
          if (Math.hypot(x + 0.5 - center, y + 0.5 - center) > radius) count.whiteOutsideSafeZone++;
        } else if (p !== TEAL.join()) count.otherColor++;
      }
    }
    expect(count.white).toBeGreaterThan(0);
    expect(count).toMatchObject({ otherColor: 0, whiteOutsideSafeZone: 0 });
  });

  it('index.html relie le manifeste, l’icône de l’onglet, l’icône Apple et la couleur du thème', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    // Icône déjà en précache : pas de requête /favicon.ico (404 journalisé), même hors ligne.
    expect(html).toContain('<link rel="icon" type="image/png" href="/icons/icon-192.png">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">');
    expect(html).toContain('<meta name="theme-color" content="#0f766e">');
  });
});

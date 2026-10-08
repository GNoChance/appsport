// Usage : node apps/web/scripts/make-icons.mjs
// Génère les icônes PNG de la PWA dans apps/web/public/icons/ (fichiers versionnés), avec Node seul :
// fond #0f766e, haltère blanc de trois rectangles (la barre, qui dépasse, et deux disques), PNG RVB 8 bits.
// L'icône maskable garde l'haltère dans la zone sûre : le cercle centré de diamètre 80 % du côté.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const BACKGROUND = [0x0f, 0x76, 0x6e];
const FOREGROUND = [0xff, 0xff, 0xff];

// Rectangles [x0, y0, x1, y1] sur un carré unité ; symétriques autour du centre (0,5 ; 0,5).
const DUMBBELL = [
  [0.14, 0.455, 0.86, 0.545],
  [0.25, 0.27, 0.38, 0.73],
  [0.62, 0.27, 0.75, 0.73],
];

// Échelle 0,85 pour la maskable : le point blanc le plus éloigné, au bout de la barre, reste à 0,31 du côté
// du centre, sous le rayon de 0,4 de la zone sûre.
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.85 },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 1 },
];

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function renderIcon(size, scale) {
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(size * stride);
  const paint = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) raw.set(color, y * stride + 1 + x * 3);
    }
  };
  paint(0, 0, size, size, BACKGROUND);
  // Bornes arrondies depuis le bord le plus proche : deux rectangles symétriques le restent au pixel près.
  const low = (v) => Math.round((0.5 + (v - 0.5) * scale) * size);
  const high = (v) => size - Math.round((0.5 - (v - 0.5) * scale) * size);
  for (const [x0, y0, x1, y1] of DUMBBELL) paint(low(x0), low(y0), high(x1), high(y1), FOREGROUND);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const { file, size, scale } of ICONS) {
  writeFileSync(join(outDir, file), renderIcon(size, scale));
  console.log(`${file} : ${size}×${size}`);
}

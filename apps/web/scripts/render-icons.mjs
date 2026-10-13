// Usage : node apps/web/scripts/render-icons.mjs
// Génère les icônes PNG de l'appli dans apps/web/public/icons/ (fichiers versionnés) depuis le logo
// docs/brand/rune-icon.svg, rendu par le Chromium de Playwright déjà installé pour les E2E
// (`pnpm --filter @rune/web exec playwright install chromium` s'il manque).
// - « any » 192 et 512, onglet 32 : le badge tel quel, coins arrondis transparents ;
// - maskable 512 et Apple 180, que le système découpe lui-même : badge sans son liseré, à coins carrés ;
//   - maskable : réduit à 80 % au centre, marge de 10 % sur le fond nuit #070A12, opaque ;
//   - Apple : plein cadre, opaque (iOS noircit la transparence, puis arrondit lui-même les coins).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Fond nuit du logo : --bg du thème sombre, theme_color et background_color du manifeste. */
const NIGHT = '#070A12';

const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, background: NIGHT, padding: 0.1, osMask: true },
  { file: 'apple-touch-icon-180.png', size: 180, background: NIGHT, osMask: true },
  { file: 'favicon-32.png', size: 32 },
];

const here = fileURLToPath(new URL('.', import.meta.url));
const source = join(here, '..', '..', '..', 'docs', 'brand', 'rune-icon.svg');
const outDir = join(here, '..', 'public', 'icons');
const badge = readFileSync(source, 'utf8');

/**
 * Badge d'une icône que le système découpe à sa forme (masque rond ou arrondi) : sans le liseré cyan (le rect
 * `fill="none"`), qui tracerait des arcs sous un masque rond et une tuile dans la tuile sous un masque arrondi,
 * et avec un fond à coins carrés. Échoue si le dessin de rune-icon.svg n'a plus ce fond et ce liseré.
 */
function forOsMask(svg) {
  const rects = svg.match(/<rect\b[^>]*>/g) ?? [];
  const rims = rects.filter((rect) => /\bfill="none"/.test(rect));
  const backgrounds = rects.filter((rect) => !rims.includes(rect));
  if (rects.length !== 2 || rims.length !== 1 || backgrounds.length !== 1) {
    throw new Error(`${source} : fond et liseré du badge introuvables`);
  }
  const [rim, background] = [rims[0], backgrounds[0]];
  const square = background.replace(/\b(rx|ry)="[^"]*"/g, '$1="0"');
  return svg.replace(rim, '').replace(background, square);
}

/** Page qui ne montre que le badge, à `padding` du bord, sur `background` (transparent sans fond). */
function page({ background, padding = 0, osMask = false }) {
  const logo = `data:image/svg+xml;base64,${Buffer.from(osMask ? forOsMask(badge) : badge).toString('base64')}`;
  const inset = `${padding * 100}%`;
  const side = `${(1 - 2 * padding) * 100}%`;
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: 100%; height: 100%; background: ${background ?? 'transparent'}; }
    img { position: absolute; left: ${inset}; top: ${inset}; width: ${side}; height: ${side}; }
  </style></head><body><img alt="" src="${logo}"></body></html>`;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const tab = await browser.newPage({
      viewport: { width: icon.size, height: icon.size },
      deviceScaleFactor: 1,
    });
    await tab.setContent(page(icon));
    await tab.locator('img').evaluate((img) => img.decode());
    const png = await tab.screenshot({
      type: 'png',
      omitBackground: icon.background === undefined,
      clip: { x: 0, y: 0, width: icon.size, height: icon.size },
    });
    writeFileSync(join(outDir, icon.file), png);
    console.log(`${icon.file} : ${icon.size}×${icon.size}`);
    await tab.close();
  }
} finally {
  await browser.close();
}

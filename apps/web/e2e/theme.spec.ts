import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PRECACHE_GLOBAL, type PrecacheManifest } from '../src/sw/precache-manifest';
import { expect, test } from './support/fixtures';

// Spec refonte §4 : apparence gardée sur l'appareil (clé rune.theme), posée par main.tsx avant le premier
// rendu ; polices embarquées : sous-ensemble latin en woff2 seulement, servi par notre serveur et précaché.

const KEY = 'rune.theme';

/** Fond de la page et theme-color : le --bg de chaque thème (tokens.css). */
const CLAIR = { background: 'rgb(241, 243, 247)', themeColor: '#F1F3F7' };
const SOMBRE = { background: 'rgb(7, 10, 18)', themeColor: '#070A12' };
const CARNET = { background: 'rgb(242, 236, 223)', themeColor: '#F2ECDF' };
const NUIT = { background: 'rgb(5, 7, 13)', themeColor: '#05070D' };

/** Les six faces de ui/theme/fonts.css et leur fichier Fontsource (nom émis par Vite, sans l'empreinte). */
const FACES = [
  { family: 'Chakra Petch', weight: '600', file: 'chakra-petch-latin-600-normal' },
  { family: 'Chakra Petch', weight: '700', file: 'chakra-petch-latin-700-normal' },
  { family: 'Barlow', weight: '400', file: 'barlow-latin-400-normal' },
  { family: 'Barlow', weight: '500', file: 'barlow-latin-500-normal' },
  { family: 'Barlow', weight: '600', file: 'barlow-latin-600-normal' },
  { family: 'Newsreader', weight: '600', file: 'newsreader-latin-600-normal' },
];
const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;
const sorted = (list: string[]) => [...list].sort();

test('apparence : un thème forcé l’emporte sur le téléphone, Auto suit sa media query', async ({
  server,
  page,
}) => {
  /** Thème posé sur <html>, fond de la page et theme-color, lus dans la page. */
  const look = () =>
    page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      background: getComputedStyle(document.body).backgroundColor,
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    }));
  /** Choix gardé (null : aucun, donc Auto), puis rechargement : main.tsx l'applique au démarrage. */
  const reopenWith = async (choice: string | null) => {
    await page.evaluate(
      ([key, value]) => {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      },
      [KEY, choice] as const,
    );
    await page.reload();
  };

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${server.url}/login`);

  await test.step('téléphone sombre, Clair forcé : la page est claire', async () => {
    await reopenWith('clair');
    await expect.poll(look).toEqual({ theme: 'clair', ...CLAIR });
  });

  await test.step('téléphone sombre, Auto : la page est sombre', async () => {
    await reopenWith(null);
    await expect.poll(look).toEqual({ theme: null, ...SOMBRE });
  });

  await test.step('Auto : le téléphone passe en clair, la page suit sans rechargement', async () => {
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(look).toEqual({ theme: null, ...CLAIR });
  });

  await test.step('téléphone clair, Sombre forcé : la page est sombre', async () => {
    await reopenWith('sombre');
    await expect.poll(look).toEqual({ theme: 'sombre', ...SOMBRE });
  });

  await test.step('Carnet puis Nuit', async () => {
    await reopenWith('carnet');
    await expect.poll(look).toEqual({ theme: 'carnet', ...CARNET });
    await reopenWith('nuit');
    await expect.poll(look).toEqual({ theme: 'nuit', ...NUIT });
  });
});

test('polices : les six woff2 latins seuls, émis, précachés et chargés depuis notre serveur', async ({
  server,
  page,
}) => {
  await test.step('build : aucun autre fichier de police, chacun dans le manifeste de précache', async () => {
    const files = (await readdir(server.publicDir, { recursive: true })).map((f) => f.replaceAll('\\', '/'));
    const fonts = sorted(files.filter((f) => FONT_FILE.test(f)));
    expect(fonts, 'fichiers de police du build').toHaveLength(FACES.length);
    for (const { file } of FACES) {
      const emitted = fonts.filter((f) => f.startsWith(`assets/${file}-`) && f.endsWith('.woff2'));
      expect(emitted, file).toHaveLength(1);
    }
    const firstLine = (await readFile(join(server.publicDir, 'sw.js'), 'utf8')).split('\n', 1)[0] ?? '';
    const prefix = `self.${PRECACHE_GLOBAL} = `;
    expect(firstLine.startsWith(prefix), 'ligne du manifeste de précache').toBe(true);
    const manifest = JSON.parse(firstLine.slice(prefix.length, -1)) as PrecacheManifest;
    const precached = sorted(manifest.files.filter((f) => FONT_FILE.test(f)));
    expect(precached).toEqual(fonts.map((f) => `/${f}`));
  });

  await test.step('navigateur : chaque face se charge, aucune autre n’est déclarée', async () => {
    await page.goto(`${server.url}/login`);
    const faces = await page.evaluate(
      async (wanted) => {
        await Promise.all(wanted.map((font) => document.fonts.load(font)));
        return [...document.fonts].map(
          (f) => `${f.family.replace(/^["']|["']$/g, '')} ${f.weight} ${f.style} ${f.display} ${f.status}`,
        );
      },
      FACES.map(({ family, weight }) => `${weight} 16px "${family}"`),
    );
    expect(sorted(faces)).toEqual(
      sorted(FACES.map(({ family, weight }) => `${family} ${weight} normal swap loaded`)),
    );
  });
});

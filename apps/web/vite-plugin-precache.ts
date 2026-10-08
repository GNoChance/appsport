import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { PRECACHE_GLOBAL, type PrecacheManifest } from './src/sw/precache-manifest';

// Mini-plugin du service worker maison (ADR 0001) : manifeste de précache et `dist/sw.js`.

export interface PrecacheFile {
  /** Chemin servi, absolu depuis la racine du site (`/assets/index-abc123.js`). */
  path: string;
  content: Uint8Array;
}

const byPath = (a: PrecacheFile, b: PrecacheFile): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** 12 hex, indépendant de l'ordre ; chemin et taille délimitent chaque fichier. */
export function computeBuildHash(files: readonly PrecacheFile[]): string {
  const h = createHash('sha256');
  for (const f of [...files].sort(byPath)) {
    h.update(f.path);
    h.update('\0');
    h.update(String(f.content.byteLength));
    h.update('\0');
    h.update(f.content);
  }
  return h.digest('hex').slice(0, 12);
}

/** Fichiers de la coquille dans `distDir`, triés par chemin, sans `/sw.js` (le SW lui-même) ni `*.map`. */
export async function listPrecacheFiles(distDir: string): Promise<PrecacheFile[]> {
  const files: PrecacheFile[] = [];
  for (const entry of await readdir(distDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath, entry.name);
    const path = `/${relative(distDir, full).split(sep).join('/')}`;
    if (path === '/sw.js' || path.endsWith('.map')) continue;
    files.push({ path, content: await readFile(full) });
  }
  return files.sort(byPath);
}

const LOCAL_DB_VERSION_RE = /export const LOCAL_DB_VERSION = (\d+);/;

/** Version Dexie du build, lue dans le source : la configuration Vite n'importe pas Dexie. */
export async function readLocalDbVersion(dbModulePath: string): Promise<number> {
  const match = LOCAL_DB_VERSION_RE.exec(await readFile(dbModulePath, 'utf8'));
  if (!match?.[1]) throw new Error(`LOCAL_DB_VERSION introuvable dans ${dbModulePath}`);
  return Number(match[1]);
}

/**
 * Le code du SW dans une fonction ouverte par "use strict" : sous la ligne du manifeste, la directive
 * qu'esbuild place en tête du script n'en serait plus une, et tout le SW tournerait en mode non strict.
 * Le saut de ligne avant `})();` le protège d'un commentaire de fin de ligne.
 */
function strictBody(swCode: string): string {
  return `(()=>{"use strict";${swCode.replace(/^"use strict";/, '').trimEnd()}\n})();\n`;
}

/** Écrit `distDir/sw.js` : le manifeste sur la première ligne, puis le code du SW, en mode strict. */
export async function generateServiceWorker(o: {
  distDir: string;
  swCode: string;
  localDbVersion: number;
}): Promise<PrecacheManifest> {
  const files = await listPrecacheFiles(o.distDir);
  const manifest: PrecacheManifest = {
    buildHash: computeBuildHash(files),
    files: files.map((f) => f.path),
    localDbVersion: o.localDbVersion,
  };
  const header = `self.${PRECACHE_GLOBAL} = ${JSON.stringify(manifest)};`;
  await writeFile(join(o.distDir, 'sw.js'), `${header}\n${strictBody(o.swCode)}`);
  return manifest;
}

/** Un seul script classique (iife), sans import ni export, que le manifeste précède dans `sw.js`. */
export async function bundleServiceWorker(entry: string): Promise<string> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    minify: true,
    write: false,
    logLevel: 'warning',
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error(`esbuild n'a rien produit pour ${entry}`);
  return output.text;
}

/** Après l'écriture du bundle (public/ déjà copié dans dist) : compile le SW et écrit `dist/sw.js`. */
export function precachePlugin(opts: { swEntry?: string } = {}): Plugin {
  let root = process.cwd();
  let outDir = resolve(root, 'dist');
  return {
    name: 'appsport-precache',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        const localDbVersion = await readLocalDbVersion(resolve(root, 'src/local-db/db.ts'));
        const swCode = await bundleServiceWorker(resolve(root, opts.swEntry ?? 'src/sw/sw.ts'));
        await generateServiceWorker({ distDir: outDir, swCode, localDbVersion });
      },
    },
  };
}

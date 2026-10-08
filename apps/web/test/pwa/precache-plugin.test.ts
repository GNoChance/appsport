// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_DB_VERSION } from '../../src/local-db/db';
import {
  ILLUSTRATIONS_CACHE,
  PRECACHE_GLOBAL,
  type PrecacheManifest,
  SHELL_CACHE_PREFIX,
} from '../../src/sw/precache-manifest';
import {
  bundleServiceWorker,
  computeBuildHash,
  generateServiceWorker,
  listPrecacheFiles,
  precachePlugin,
  readLocalDbVersion,
} from '../../vite-plugin-precache';

const DB_TS = resolve(import.meta.dirname, '../../src/local-db/db.ts');
const SW_CODE = '(()=>{self.addEventListener("install",()=>{})})();\n';
const FILES = ['/assets/index-abc123.js', '/icons/icon-192.png', '/index.html', '/manifest.webmanifest'];
const enc = (s: string) => new TextEncoder().encode(s);

let tmp: string;
let dist: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'appsport-precache-'));
  dist = join(tmp, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await mkdir(join(dist, 'icons'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>appsport</title>');
  await writeFile(join(dist, 'assets/index-abc123.js'), 'console.log(1);');
  await writeFile(join(dist, 'assets/index-abc123.js.map'), '{"version":3}');
  await writeFile(join(dist, 'manifest.webmanifest'), '{"name":"appsport"}');
  await writeFile(join(dist, 'icons/icon-192.png'), new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(join(dist, 'sw.js'), 'ancien service worker');
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const generate = (localDbVersion = 1) =>
  generateServiceWorker({ distDir: dist, swCode: SW_CODE, localDbVersion });

describe('generateServiceWorker', () => {
  it('écrit dist/sw.js : manifeste trié sur la première ligne, puis le code du SW', async () => {
    const m = await generate();
    expect(m.files).toEqual(FILES);
    expect(m.buildHash).toMatch(/^[0-9a-f]{12}$/);
    expect(m.localDbVersion).toBe(1);
    const sw = await readFile(join(dist, 'sw.js'), 'utf8');
    expect(sw.split('\n')[0]).toBe(`self.__APPSPORT_PRECACHE__ = ${JSON.stringify(m)};`);
    expect(sw.slice(sw.indexOf('\n') + 1)).toBe(SW_CODE);
    expect(PRECACHE_GLOBAL).toBe('__APPSPORT_PRECACHE__');
  });

  it('régénération : même buildHash ; un octet changé : buildHash différent', async () => {
    const first = await generate();
    expect((await generate()).buildHash).toBe(first.buildHash);
    await writeFile(join(dist, 'assets/index-abc123.js.map'), '{"version":3,"autre":1}');
    expect((await generate()).buildHash).toBe(first.buildHash);
    await writeFile(join(dist, 'assets/index-abc123.js'), 'console.log(2);');
    expect((await generate()).buildHash).not.toBe(first.buildHash);
  });

  it('porte la version de la base locale passée', async () => {
    expect((await generate(7)).localDbVersion).toBe(7);
  });
});

describe('listPrecacheFiles', () => {
  it('liste dist sans sw.js ni .map, triée, avec les octets de chaque fichier', async () => {
    const files = await listPrecacheFiles(dist);
    expect(files.map((f) => f.path)).toEqual(FILES);
    const index = files.find((f) => f.path === '/index.html');
    expect(new TextDecoder().decode(index?.content)).toBe('<!doctype html><title>appsport</title>');
  });
});

describe('computeBuildHash', () => {
  it("12 hex, indépendant de l'ordre, sensible aux frontières entre fichiers", () => {
    const a = [
      { path: '/a', content: enc('ab') },
      { path: '/b', content: enc('') },
    ];
    const b = [
      { path: '/a', content: enc('a') },
      { path: '/b', content: enc('b') },
    ];
    expect(computeBuildHash(a)).toMatch(/^[0-9a-f]{12}$/);
    expect(computeBuildHash([...a].reverse())).toBe(computeBuildHash(a));
    expect(computeBuildHash(a)).not.toBe(computeBuildHash(b));
    expect(computeBuildHash([{ path: '/ab', content: enc('') }])).not.toBe(
      computeBuildHash([{ path: '/a', content: enc('b') }]),
    );
  });
});

describe('readLocalDbVersion', () => {
  it('lit LOCAL_DB_VERSION dans src/local-db/db.ts', async () => {
    expect(await readLocalDbVersion(DB_TS)).toBe(LOCAL_DB_VERSION);
  });

  it('fichier sans le motif : rejette', async () => {
    const file = join(tmp, 'db.ts');
    await writeFile(file, 'export const LOCAL_DB_VERSION = AUTRE;\n');
    await expect(readLocalDbVersion(file)).rejects.toThrow(/LOCAL_DB_VERSION/);
  });
});

describe('constantes de cache', () => {
  it('shell-<buildHash> et illustrations-v1', () => {
    expect([SHELL_CACHE_PREFIX, ILLUSTRATIONS_CACHE]).toEqual(['shell-', 'illustrations-v1']);
  });
});

describe('bundleServiceWorker', () => {
  it('un seul script iife minifié, imports résolus, sans export', async () => {
    await writeFile(join(tmp, 'marker.ts'), "export const MARKER: string = 'MARQUEUR_SW';\n");
    await writeFile(
      join(tmp, 'sw.ts'),
      "import { MARKER } from './marker';\n(globalThis as { marker?: string }).marker = MARKER;\nexport {};\n",
    );
    const code = await bundleServiceWorker(join(tmp, 'sw.ts'));
    expect(code).toContain('MARQUEUR_SW');
    expect(code).not.toMatch(/\bexport\b/);
    expect(code).not.toMatch(/\bimport\b/);
  });
});

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const handlerOf = (hook: unknown): Hook =>
  (typeof hook === 'function' ? hook : (hook as { handler: Hook }).handler) as Hook;

describe('precachePlugin', () => {
  it('nommé appsport-precache, appliqué au build seulement', () => {
    expect(precachePlugin()).toMatchObject({ name: 'appsport-precache', apply: 'build' });
  });

  it('après écriture du bundle : sw.js depuis src/sw/sw.ts et LOCAL_DB_VERSION de src/local-db/db.ts', async () => {
    await mkdir(join(tmp, 'src/local-db'), { recursive: true });
    await mkdir(join(tmp, 'src/sw'));
    await writeFile(join(tmp, 'src/local-db/db.ts'), 'export const LOCAL_DB_VERSION = 3;\n');
    await writeFile(
      join(tmp, 'src/sw/sw.ts'),
      "(globalThis as { m?: string }).m = 'MARQUEUR_SW';\nexport {};\n",
    );
    const plugin = precachePlugin();
    await handlerOf(plugin.configResolved).call({}, { root: tmp, build: { outDir: 'dist' } });
    await handlerOf(plugin.writeBundle).call({}, { dir: dist }, {});
    const sw = await readFile(join(dist, 'sw.js'), 'utf8');
    const [first = '', ...rest] = sw.split('\n');
    const m = JSON.parse(first.slice('self.__APPSPORT_PRECACHE__ = '.length, -1)) as PrecacheManifest;
    expect(m).toMatchObject({ files: FILES, localDbVersion: 3 });
    expect(rest.join('\n')).toContain('MARQUEUR_SW');
  });
});

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/http/security-headers';
import { cacheControlFor, ILLUSTRATION_CSP, IMMUTABLE_CACHE, resolveUnder } from '../../src/static';
import { createTestContext, type TestContext, type TestRequestInit } from '../support';

const INDEX = '<!doctype html><html lang="fr"><head><title>appsport</title></head></html>';
const SW = 'self.__APPSPORT_PRECACHE__ = {};\n';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect x="1" y="1" width="2" height="2"/>'.repeat(40)}</svg>`;
const HASH8 = createHash('sha256').update(SVG).digest('hex').slice(0, 8);
const ILLUSTRATION = `/illustrations/squat-start.${HASH8}.svg`;
const GLOBAL_CSP = SECURITY_HEADERS['Content-Security-Policy'];

let root: string;
let publicDir: string;
let contentDir: string;
let ctx: TestContext | undefined;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'appsport-static-'));
  publicDir = join(root, 'web', 'public');
  contentDir = join(root, 'web', 'content');
  mkdirSync(join(publicDir, 'assets'), { recursive: true });
  mkdirSync(join(contentDir, 'illustrations', 'files'), { recursive: true });
  mkdirSync(join(root, 'empty'));
  writeFileSync(join(publicDir, 'index.html'), INDEX);
  writeFileSync(join(publicDir, 'sw.js'), SW);
  writeFileSync(join(publicDir, 'manifest.webmanifest'), '{"name":"appsport"}');
  writeFileSync(join(publicDir, 'assets', 'index-abc123.js'), 'console.log(1);');
  writeFileSync(join(contentDir, 'illustrations', 'files', 'squat-start.svg'), SVG);
  // Cibles des tentatives de traversée : servies si le chemin sortait de publicDir ou du dossier des fichiers.
  writeFileSync(join(root, 'package.json'), '{"secret":true}');
  writeFileSync(join(contentDir, 'secret.svg'), SVG);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));
afterEach(() => {
  ctx?.close();
  ctx = undefined;
});

async function open(dirs: { publicDir?: string; contentDir?: string } = {}): Promise<TestContext> {
  ctx = await createTestContext({ config: { publicDir, contentDir, ...dirs } });
  return ctx;
}

async function get(path: string, init: TestRequestInit = {}): Promise<Response> {
  return (ctx ?? (await open())).request(path, init);
}

/** En-têtes de T6 sur toute réponse ; seule la CSP peut venir de la route. */
function expectSecurityHeaders(res: Response, csp = GLOBAL_CSP): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(res.headers.get(name), name).toBe(name === 'Content-Security-Policy' ? csp : value);
  }
}

async function expectIndex(res: Response, path: string): Promise<void> {
  expect(res.status, path).toBe(200);
  expect(res.headers.get('Content-Type'), path).toBe('text/html; charset=utf-8');
  expect(res.headers.get('Cache-Control'), path).toBe('no-cache');
  expectSecurityHeaders(res);
  expect(await res.text(), path).toBe(INDEX);
}

/** Un 404 ne porte aucun Cache-Control : un fichier absent un instant (déploiement) n'est jamais figé un an. */
async function expectNotFound(res: Response, path: string): Promise<void> {
  expect(res.status, path).toBe(404);
  expect(await res.json(), path).toEqual({ error: 'not_found' });
  expect(res.headers.get('Cache-Control'), path).toBeNull();
  expectSecurityHeaders(res);
}

describe('mountWebApp : fichiers de publicDir', () => {
  it("'/' et '/index.html' : index.html en HTML UTF-8, no-cache, en-têtes de T6", async () => {
    for (const path of ['/', '/index.html']) await expectIndex(await get(path), path);
  });

  it('sw.js et manifest.webmanifest : type MIME et no-cache', async () => {
    const sw = await get('/sw.js');
    expect(sw.status).toBe(200);
    expect(sw.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
    expect(sw.headers.get('Cache-Control')).toBe('no-cache');
    expect(await sw.text()).toBe(SW);
    expectSecurityHeaders(sw);
    const manifest = await get('/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get('Content-Type')).toBe('application/manifest+json');
    expect(manifest.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('fichier haché de /assets : immuable', async () => {
    const res = await get('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe(IMMUTABLE_CACHE);
    expect(await res.text()).toBe('console.log(1);');
    expectSecurityHeaders(res);
  });

  it('repli SPA : un chemin sans extension sert index.html en no-cache', async () => {
    for (const path of ['/profile/places/abc', '/invite', '/admin/members', '/admin/members/']) {
      await expectIndex(await get(path), path);
    }
  });

  it('404 not_found : fichier absent avec extension, chemin qui ne peut pas désigner un fichier', async () => {
    for (const path of [
      '/assets/missing-zzz.js',
      // %2f n'est pas décodé (decodeURI de Hono) : nom de fichier littéral et absent, pas une traversée.
      '/..%2f..%2fpackage.json',
      // %5c devient « \ », séparateur sous Windows seulement : la traversée est couverte par resolveUnder (win32).
      '/..%5c..%5cpackage.json',
      // Octet nul refusé avant stat, qui lèverait ERR_INVALID_ARG_VALUE (500).
      '/a%00.js',
      // ENOTDIR et ENAMETOOLONG sous Linux (ENOENT sous Windows) : un fichier absent, pas un 500.
      '/index.html/x.js',
      `/${'a'.repeat(300)}.js`,
      // Barre finale : un dossier, jamais un fichier (sinon servi en application/octet-stream).
      '/index.html/',
      '/assets/index-abc123.js/',
    ]) {
      await expectNotFound(await get(path), path);
    }
  });

  it('/api : 404 not_found en GET et en POST, jamais index.html ; /api/health répond', async () => {
    await expectNotFound(await get('/api/nope'), 'GET /api/nope');
    await expectNotFound(await get('/api/nope', { method: 'POST', json: {} }), 'POST /api/nope');
    const health = await get('/api/health');
    expect(health.status).toBe(200);
    expect(health.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(await health.json()).toMatchObject({ status: 'ok' });
  });

  it('publicDir sans index.html : 404 au lieu du repli SPA', async () => {
    await open({ publicDir: join(root, 'empty') });
    for (const path of ['/profile', '/']) await expectNotFound(await get(path), path);
  });
});

describe('mountWebApp : illustrations', () => {
  it('<id>.<hash8>.<ext> : SVG immuable, nosniff et CSP propre aux illustrations', async () => {
    const res = await get(ILLUSTRATION);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toBe(IMMUTABLE_CACHE);
    expect(res.headers.get('Content-Encoding')).toBeNull();
    expectSecurityHeaders(res, ILLUSTRATION_CSP);
    expect(await res.text()).toBe(SVG);
  });

  it('compressée en gzip si le client l’accepte', async () => {
    const res = await get(ILLUSTRATION, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Encoding')).toBe('gzip');
    expect(res.headers.get('Vary')).toMatch(/Accept-Encoding/);
    expect(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')).toBe(SVG);
  });

  it('404 : empreinte fausse, fichier absent, traversée, nom sans empreinte', async () => {
    // La cible des traversées a bien l'empreinte HASH8 : seule la validation du nom peut la refuser.
    const secret = readFileSync(join(contentDir, 'secret.svg'));
    expect(createHash('sha256').update(secret).digest('hex').slice(0, 8)).toBe(HASH8);
    for (const path of [
      '/illustrations/squat-start.00000000.svg',
      '/illustrations/absent.12345678.svg',
      '/illustrations/..%2f..%2fsecret.svg',
      // Le paramètre décodé vaut ../../secret.<HASH8>.svg (ou ..\..\…) : contentDir/secret.svg s'il passait.
      `/illustrations/..%2f..%2fsecret.${HASH8}.svg`,
      `/illustrations/..%5c..%5csecret.${HASH8}.svg`,
      '/illustrations/squat-start.svg',
    ]) {
      await expectNotFound(await get(path), path);
    }
  });

  it('une URL d’illustration sert toujours les octets de son empreinte (empreintes en mémoire)', async () => {
    const dir = join(root, 'content-mutable');
    mkdirSync(join(dir, 'illustrations', 'files'), { recursive: true });
    const file = join(dir, 'illustrations', 'files', 'squat-start.svg');
    writeFileSync(file, SVG);
    await open({ contentDir: dir });
    expect(await (await get(ILLUSTRATION)).text()).toBe(SVG);
    writeFileSync(file, `${SVG}<!-- modifié -->`);
    const again = await get(ILLUSTRATION);
    expect(again.status).toBe(200);
    expect(await again.text()).toBe(SVG);
  });
});

describe('resolveUnder', () => {
  it('posix : fichier sous la racine ; traversée, préfixe voisin, octet nul et barre finale refusés', () => {
    const root = '/srv/public';
    expect(resolveUnder(root, '/index.html', posix)).toBe('/srv/public/index.html');
    expect(resolveUnder(root, '/assets/index-abc123.js', posix)).toBe('/srv/public/assets/index-abc123.js');
    for (const path of ['/../package.json', '/../public-evil/x.js', '/a\0b.js', '/index.html/', '/assets/']) {
      expect(resolveUnder(root, path, posix), JSON.stringify(path)).toBeNull();
    }
  });

  it('win32 : « \\ » sépare aussi les segments, la traversée reste refusée', () => {
    const root = 'C:\\srv\\public';
    expect(resolveUnder(root, '/assets/index-abc123.js', win32)).toBe(
      'C:\\srv\\public\\assets\\index-abc123.js',
    );
    for (const path of ['/..\\..\\x', '/..\\package.json', '/..\\public-evil\\x.js', '/a\0b.js']) {
      expect(resolveUnder(root, path, win32), JSON.stringify(path)).toBeNull();
    }
  });
});

describe('cacheControlFor', () => {
  it('/assets/… immuable, tout le reste no-cache', () => {
    expect(cacheControlFor('/assets/index-abc123.js')).toBe(IMMUTABLE_CACHE);
    expect(IMMUTABLE_CACHE).toBe('public, max-age=31536000, immutable');
    for (const path of ['/index.html', '/sw.js', '/manifest.webmanifest', '/icons/icon-192.png', '/assets']) {
      expect(cacheControlFor(path), path).toBe('no-cache');
    }
  });

  it("CSP des illustrations : rien d'autre que les styles en ligne", () => {
    expect(ILLUSTRATION_CSP).toBe("default-src 'none'; style-src 'unsafe-inline'");
  });
});

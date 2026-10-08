import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, type PlatformPath, posix, resolve, sep } from 'node:path';
import { ILLUSTRATION_FILE_RE } from '@appsport/contracts';
import type { Context, Hono } from 'hono';
import { compress } from 'hono/compress';
import { getMimeType } from 'hono/utils/mime';
import type { AppEnv } from './app-env';
import type { AppDeps } from './deps';

/** CSP des illustrations (04 §12) : un SVG ouvert seul n'exécute rien et ne charge rien. */
export const ILLUSTRATION_CSP = "default-src 'none'; style-src 'unsafe-inline'";
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** R-PWA-1 : fichiers hachés par Vite sous /assets immuables ; index.html, sw.js, manifeste, icônes revalidés. */
export function cacheControlFor(pathname: string): string {
  return pathname.startsWith('/assets/') ? IMMUTABLE_CACHE : 'no-cache';
}

const ILLUSTRATION_TYPES = { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };

/** Octets d'un fichier lu en entier (`readFile`), tels que `c.body` les accepte. */
type Bytes = Uint8Array<ArrayBuffer>;

/** Fichier absent, ou chemin qui ne peut pas en désigner un (segment qui est un fichier, nom trop long). */
const MISSING = new Set(['ENOENT', 'ENOTDIR', 'ENAMETOOLONG']);

async function readIfFile(path: string): Promise<Bytes | null> {
  try {
    return (await stat(path)).isFile() ? await readFile(path) : null;
  } catch (error) {
    if (MISSING.has((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw error;
  }
}

/**
 * Fichier que `pathname` désigne sous `root` (chemin déjà résolu), ou null : octet nul, barre finale (un
 * dossier, jamais un fichier) ou chemin résolu hors de `root`. `path` : les tests passent aussi `win32`, où
 * `\` sépare les segments comme `/`.
 */
export function resolveUnder(
  root: string,
  pathname: string,
  path: Pick<PlatformPath, 'resolve' | 'sep'> = { resolve, sep },
): string | null {
  if (pathname.includes('\0') || pathname.endsWith('/')) return null;
  const full = path.resolve(root, `.${pathname}`);
  return full.startsWith(root + path.sep) ? full : null;
}

/** `pathname` résolu sous `root` (resolveUnder), puis lu s'il désigne un fichier. */
async function readUnder(root: string, pathname: string): Promise<Bytes | null> {
  const full = resolveUnder(root, pathname);
  return full ? readIfFile(full) : null;
}

function sendPublicFile(c: Context<AppEnv>, pathname: string, body: Bytes): Response {
  return c.body(body, 200, {
    'Content-Type': getMimeType(pathname) ?? 'application/octet-stream',
    'Cache-Control': cacheControlFor(pathname),
  });
}

const isApi = (path: string) => path === '/api' || path.startsWith('/api/');

/**
 * Monté en dernier : illustrations de `contentDir`, puis la PWA de `publicDir` avec repli SPA. Ce qui n'est
 * pas servi passe à la suite (`next()`) jusqu'au 404 `not_found` de l'appli : /api/* n'est jamais pris par
 * le repli SPA, et une route ajoutée après coup (tests) reste joignable. Les en-têtes de sécurité (T6)
 * s'ajoutent à chaque réponse ; la CSP des illustrations est gardée.
 */
export function mountWebApp(app: Hono<AppEnv>, deps: AppDeps): void {
  const filesDir = join(deps.config.contentDir, 'illustrations', 'files');
  // Empreinte et octets lus une seule fois par fichier : une URL immuable sert toujours les mêmes octets.
  const illustrations = new Map<string, { hash8: string; body: Bytes }>();

  app.get('/illustrations/:file', compress(), async (c) => {
    const match = ILLUSTRATION_FILE_RE.exec(c.req.param('file'));
    if (!match) return c.notFound();
    const [, id, hash8, ext] = match;
    const name = `${id}.${ext}`;
    let known = illustrations.get(name);
    if (!known) {
      const body = await readIfFile(join(filesDir, name));
      if (!body) return c.notFound();
      known = { hash8: createHash('sha256').update(body).digest('hex').slice(0, 8), body };
      illustrations.set(name, known);
    }
    if (known.hash8 !== hash8) return c.notFound();
    return c.body(known.body, 200, {
      'Content-Type': ILLUSTRATION_TYPES[ext as keyof typeof ILLUSTRATION_TYPES],
      'Content-Length': String(known.body.byteLength),
      'Cache-Control': IMMUTABLE_CACHE,
      'Content-Security-Policy': ILLUSTRATION_CSP,
    });
  });

  const root = resolve(deps.config.publicDir);
  app.get('*', async (c, next) => {
    if (isApi(c.req.path)) return next();
    const pathname = c.req.path === '/' ? '/index.html' : c.req.path;
    const body = await readUnder(root, pathname);
    if (body) return sendPublicFile(c, pathname, body);
    // Repli SPA : une route de l'appli (sans extension) reçoit index.html ; un fichier absent reste un 404.
    if (posix.extname(pathname) !== '') return next();
    const index = await readUnder(root, '/index.html');
    return index ? sendPublicFile(c, '/index.html', index) : next();
  });
}

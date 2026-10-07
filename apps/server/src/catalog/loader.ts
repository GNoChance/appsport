import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type CatalogBundle, IllustrationRef } from '@appsport/contracts';
import { z } from 'zod';
import { getServerMeta } from '../db/server-meta';
import type { AppDeps } from '../deps';
import type { StartupTask } from '../startup';

export class CatalogLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogLoadError';
  }
}

const loaded = new WeakMap<AppDeps, CatalogBundle>();

/** Dernier catalogue chargé avec succès pour ces dépendances, sinon null. */
export function getLoadedCatalog(deps: AppDeps): CatalogBundle | null {
  return loaded.get(deps) ?? null;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

async function readJson(path: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) throw error;
    throw new CatalogLoadError(`fichier illisible : ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new CatalogLoadError(`JSON invalide : ${path}`);
  }
}

async function readManifest(dir: string): Promise<IllustrationRef[]> {
  let json: unknown;
  try {
    json = await readJson(join(dir, 'illustrations', 'manifest.json'));
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const parsed = z.array(IllustrationRef).safeParse(json);
  if (!parsed.success) throw new CatalogLoadError('manifeste des illustrations invalide');
  return parsed.data;
}

async function readPrograms(dir: string): Promise<unknown[]> {
  let names: string[];
  try {
    names = await readdir(join(dir, 'programs'));
  } catch (error) {
    if (isMissing(error)) return [];
    throw new CatalogLoadError('dossier programs illisible');
  }
  const files = names.filter((n) => n.endsWith('.json')).sort();
  return Promise.all(files.map((n) => readJson(join(dir, 'programs', n))));
}

/** Sérialisation canonique : clés triées récursivement, sans espaces. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Lit le contenu, calcule la version et ne touche à server_meta que si elle change. */
export async function loadCatalog(deps: AppDeps): Promise<CatalogBundle> {
  const dir = deps.config.contentDir;
  const content = {
    adviceSheets: [] as unknown[],
    exercises: [] as unknown[],
    illustrations: await readManifest(dir),
    programTemplates: await readPrograms(dir),
  };
  const version = createHash('sha256').update(canonical(content)).digest('hex');
  const meta = await getServerMeta(deps.db);
  if (meta.catalogVersion !== version) {
    await deps.db
      .updateTable('serverMeta')
      .set({ catalogVersion: version, catalogUpdatedAt: deps.clock.now().toISOString() })
      .where('id', '=', 1)
      .execute();
  }
  const bundle: CatalogBundle = { version, ...content };
  loaded.set(deps, bundle);
  return bundle;
}

export const CATALOG_STARTUP_TASK: StartupTask = {
  name: 'catalog',
  async run(deps) {
    try {
      await loadCatalog(deps);
    } catch (error) {
      deps.logger.error('catalog_invalid', { event: error instanceof Error ? error.name : 'unknown' });
    }
  },
};

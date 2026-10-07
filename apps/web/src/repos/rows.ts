import type { z } from 'zod';
import type { AppServices } from '../app-services';
import type { AppDb, MirrorRow } from '../local-db/db';
import { getMeta } from '../local-db/meta';

/**
 * Colonne JSON d'un miroir : le pull l'a déjà décodée (`COLUMN_CODECS`), on ne fait que valider
 * l'objet ; texte, valeur absente ou objet invalide → null.
 */
export function parseJsonColumn<T>(v: unknown, schema: z.ZodType<T>): T | null {
  if (typeof v !== 'object' || v === null) return null;
  const parsed = schema.safeParse(v);
  return parsed.success ? parsed.data : null;
}

/** Ligne non supprimée (tombstone exclu). */
export function isLive(row: MirrorRow): boolean {
  return row.deletedAt == null;
}

/** `v` s'il fait partie de `values`, sinon null (valeur de miroir inattendue). */
export function oneOf<T>(values: readonly T[], v: unknown): T | null {
  return values.includes(v as T) ? (v as T) : null;
}

export const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export async function currentUserId(db: AppDb): Promise<string | null> {
  return (await getMeta(db, 'userId')) ?? null;
}

/** Lignes vivantes d'un miroir appartenant à `ownerId`. */
export async function ownedRows(db: AppDb, entity: string, ownerId: string | null): Promise<MirrorRow[]> {
  if (ownerId === null) return [];
  return db
    .mirror(entity)
    .filter((r) => isLive(r) && r.ownerId === ownerId)
    .toArray();
}

/**
 * Écriture de classe E : l'API d'abord (hors ligne → NetworkRequiredError, rien d'écrit en local),
 * puis `apply` sur la réponse (meta.me par exemple), puis un pull qui ramène les lignes serveur.
 */
export async function sendThenPull<T = void>(
  s: AppServices,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; schema?: z.ZodType<T>; apply?: (result: T) => Promise<void> } = {},
): Promise<T> {
  const result = await s.api.send(method, path, opts.body, opts.schema);
  await opts.apply?.(result);
  await s.sync.pullNow();
  return result;
}

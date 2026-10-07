import { z } from 'zod';

export const SYNC_PUSH_MAX = 200;
export const SYNC_PULL_LIMIT = 500;
export const SYNC_TIMEOUT_MS = 4000;
export const EPOCH_RESEND_DAYS = 60;
export const TOMBSTONE_TTL_DAYS = 90;
export const APPLIED_OP_TTL_MONTHS = 12;
export const SYNC_RETRY_MIN_MS = 2000;
export const SYNC_RETRY_MAX_MS = 300_000;
export const SYNC_INTERVAL_MS = 60_000;
export const SYNC_DEBOUNCE_MS = 2000;
export const COACH_FLUSH_MS = 4000;

/** Même motif que `isUuidV7` (domain) : contracts n'importe pas domain. */
export const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const UuidV7 = z.string().regex(UUID_V7_RE);
export type UuidV7 = z.infer<typeof UuidV7>;

export const OpKind = z.enum(['create', 'patch', 'delete', 'restore_upsert']);
export type OpKind = z.infer<typeof OpKind>;

/** `fields` en camelCase. */
export const SyncOp = z.object({
  opId: UuidV7,
  userId: z.string().min(1),
  entity: z.string().min(1),
  id: z.string().min(1).max(200),
  kind: OpKind,
  fields: z.record(z.string(), z.unknown()),
  clientTs: z.iso.datetime(),
  protocol: z.number().int().min(1),
  attempts: z.number().int().min(0),
  serverRevSeen: z.number().int().nullable().optional(),
});
export type SyncOp = z.infer<typeof SyncOp>;

export const RejectionCode = z.enum([
  'validation',
  'forbidden',
  'parent_rejected',
  'stale_revision',
  'unknown_entity',
  'protocol',
]);
export type RejectionCode = z.infer<typeof RejectionCode>;

export const PushRequest = z.object({ ops: z.array(SyncOp).max(SYNC_PUSH_MAX) });
export type PushRequest = z.infer<typeof PushRequest>;

/** Corps reçu par la route : chaque op est validée ensuite, une à une. */
export const PushEnvelope = z.object({
  ops: z.array(z.looseObject({ opId: z.string().min(1) })).max(SYNC_PUSH_MAX),
});
export type PushEnvelope = z.infer<typeof PushEnvelope>;

export const PushResult = z.object({
  opId: z.string(),
  status: z.enum(['applied', 'applied_partial', 'duplicate', 'rejected']),
  /** Avec status 'duplicate' : issue de la première application (code et dropped repris aussi). */
  originalStatus: z.enum(['applied', 'applied_partial', 'rejected']).optional(),
  rev: z.number().int().optional(),
  code: RejectionCode.optional(),
  droppedFields: z.array(z.string()).optional(),
  dropped: z.boolean().optional(),
});
export type PushResult = z.infer<typeof PushResult>;

export const PushResponse = z.object({ results: z.array(PushResult) });
export type PushResponse = z.infer<typeof PushResponse>;

/** `row` en camelCase, avec id et deletedAt, sans secret. */
export const PulledRow = z.object({
  entity: z.string(),
  rev: z.number().int(),
  row: z.record(z.string(), z.unknown()),
});
export type PulledRow = z.infer<typeof PulledRow>;

export const PullResponse = z.object({
  rows: z.array(PulledRow),
  nextWatermark: z.string(),
  hasMore: z.boolean(),
  catalogVersion: z.string().nullable(),
});
export type PullResponse = z.infer<typeof PullResponse>;

export const PullQuery = z.object({
  since: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(SYNC_PULL_LIMIT).default(SYNC_PULL_LIMIT),
});
export type PullQuery = z.infer<typeof PullQuery>;

/** Watermark opaque `<server_epoch>:<rev>`. */
export function encodeWatermark(epoch: string, rev: number): string {
  return `${epoch}:${rev}`;
}

export function decodeWatermark(w: string): { epoch: string; rev: number } | null {
  const sep = w.lastIndexOf(':');
  if (sep <= 0) return null;
  const revText = w.slice(sep + 1);
  if (!/^\d+$/.test(revText)) return null;
  const rev = Number(revText);
  if (!Number.isSafeInteger(rev)) return null;
  return { epoch: w.slice(0, sep), rev };
}

/** Décodage d'une colonne SQLite vers la valeur du miroir ; `null` reste `null`. */
export type ColumnCodec = 'boolean' | 'json';

/** Colonnes `x IN (0,1)` (boolean) et `json_valid(x)` (json) des tables miroirs. */
export const COLUMN_CODECS: Readonly<Record<string, Readonly<Record<string, ColumnCodec>>>> = {
  training_profile: { cautious_mode: 'boolean' },
  health_screening: { caution: 'boolean' },
  limitation: { active: 'boolean' },
  gym: { load_settings: 'json' },
  place: { is_primary: 'boolean', visible_at_gym: 'boolean', load_settings: 'json' },
  sync_rejection: { detail_json: 'json' },
};

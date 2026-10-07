import {
  type EntityRule,
  type EntityRulesMap,
  EPOCH_HEADER,
  EPOCH_RESEND_DAYS,
  entityRules,
  PROTOCOL_HEADER,
  PullResponse,
  PushResponse,
  type PushResult,
  SYNC_DEBOUNCE_MS,
  SYNC_PROTOCOL,
  SYNC_PUSH_MAX,
  SYNC_RETRY_MAX_MS,
  SYNC_RETRY_MIN_MS,
  SYNC_TIMEOUT_MS,
  snakeToCamel,
} from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import Dexie from 'dexie';
import { z } from 'zod';
import { stripC2Fields } from '../local-db/c2';
import { localHealthConsentActive } from '../local-db/consent';
import { type AppDb, type DeadletterEntry, mirrorStoreNames, type OutboxOp } from '../local-db/db';
import { deleteMeta, getMeta, setMeta } from '../local-db/meta';
import { clearMirrors, purgeHealthData, wipeUserData } from '../local-db/wipe';
import { applyPulledRows } from './apply-pull';
import { refreshCatalog } from './catalog';
import { pendingCount } from './outbox';
import { convertOutboxOp } from './protocol-converters';
import { fetchWithTimeout, OfflineError, type SyncTransport } from './transport';
import { installSyncTriggers } from './triggers';

export type ConnectionState =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'unauthenticated'
  | 'protocol_unsupported'
  | 'account_deleted';
export type SyncTrigger =
  | 'launch'
  | 'foreground'
  | 'online'
  | 'set_logged'
  | 'interval'
  | 'coach'
  | 'mutation'
  | 'manual';

export interface SyncState {
  connection: ConnectionState;
  pending: number;
  rejected: number;
  lastPullOkAt: string | null;
  syncing: boolean;
  serverEpoch: string | null;
}

export interface SyncEngine {
  syncNow(t: SyncTrigger): Promise<void>;
  pullNow(): Promise<void>;
  flushBefore(ms: number): Promise<void>;
  getState(): SyncState;
  subscribe(fn: (s: SyncState) => void): () => void;
  start(): void;
  stop(): void;
}

export interface SyncEngineDeps {
  db: AppDb;
  transport: SyncTransport;
  now?: () => number;
  newOpId?: () => string;
  onAccountDeleted?: () => void;
  timeoutMs?: number;
  rules?: EntityRulesMap;
  triggers?: (e: SyncEngine) => () => void;
}

/** Attente avant la reprise n° `failures` : 2 s doublées à chaque échec, 5 min au plus. */
export function retryDelayMs(failures: number): number {
  return Math.min(SYNC_RETRY_MAX_MS, SYNC_RETRY_MIN_MS * 2 ** (Math.max(1, failures) - 1));
}

const DAY_MS = 86_400_000;

/** Fin de cycle sans échec : utilisateur changé ou moteur arrêté. */
class CycleEnd extends Error {}
/** Réponse portant une autre époque que celle du cycle (en-tête lu avant le corps). */
class EpochChanged extends Error {}
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `http_${status}`);
  }
}

async function httpError(res: Response): Promise<HttpError> {
  let code: string | null = null;
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      code = body.error;
    }
  } catch {
    // corps absent ou illisible : seul le statut reste
  }
  return new HttpError(res.status, code);
}

const MeConsents = z.looseObject({
  consents: z.looseObject({ health: z.looseObject({ active: z.boolean() }) }),
});

type CycleKind = 'full' | 'pull';
interface Cycle {
  userId: string;
  epoch: string | null;
}

/**
 * Moteur de synchro client : un seul cycle en vol (health → époque → push → pull → catalogue),
 * décisions prises sur `error` et jamais sur le seul statut, l'en-tête d'époque d'abord.
 */
export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { db, transport } = deps;
  const rules = deps.rules ?? entityRules;
  const now = deps.now ?? Date.now;
  const newOpId =
    deps.newOpId ?? createMonotonicUuidV7(now, (n) => crypto.getRandomValues(new Uint8Array(n)));
  const timeoutMs = deps.timeoutMs ?? SYNC_TIMEOUT_MS;
  const nowIso = () => new Date(now()).toISOString();
  const ruleOf = (entity: string): EntityRule | undefined =>
    Object.hasOwn(rules, entity) ? rules[entity] : undefined;
  const hasMirror = (entity: string) => db.mirrorNames.includes(entity);

  let state: SyncState = {
    connection: 'unknown',
    pending: 0,
    rejected: 0,
    lastPullOkAt: null,
    syncing: false,
    serverEpoch: null,
  };
  const listeners = new Set<(s: SyncState) => void>();
  let lastUserId: string | null = null;
  let failures = 0;
  let started = false;
  let stopped = false;
  let uninstall: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let debounceWaiters: (() => void)[] = [];
  let running: Promise<void> | null = null;
  let next: { kind: CycleKind; promise: Promise<void> } | null = null;

  function setState(patch: Partial<SyncState>): void {
    const updated = { ...state, ...patch };
    const keys = Object.keys(updated) as (keyof SyncState)[];
    if (keys.every((k) => updated[k] === state[k])) return;
    state = updated;
    for (const fn of listeners) fn(state);
  }

  async function rejectedCount(userId: string): Promise<number> {
    const opIds = new Set((await db.deadletter.where('userId').equals(userId).toArray()).map((d) => d.opId));
    if (hasMirror('sync_rejection')) {
      for (const r of await db.mirror('sync_rejection').toArray()) {
        if (
          r.ownerId === userId &&
          r.dismissedAt == null &&
          r.deletedAt == null &&
          typeof r.opId === 'string'
        ) {
          opIds.add(r.opId);
        }
      }
    }
    return opIds.size;
  }

  async function refreshState(): Promise<void> {
    const userId = await getMeta(db, 'userId');
    setState({
      pending: userId ? await pendingCount(db, userId) : 0,
      rejected: userId ? await rejectedCount(userId) : 0,
      lastPullOkAt: (await getMeta(db, 'lastPullOkAt')) ?? null,
      serverEpoch: (await getMeta(db, 'serverEpoch')) ?? null,
    });
  }

  // ---- HTTP ----

  async function request(
    cycle: Cycle,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = { [PROTOCOL_HEADER]: String(SYNC_PROTOCOL) };
    const init: RequestInit = { method, headers };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    const res = await fetchWithTimeout(transport, path, init, timeoutMs);
    const epoch = res.headers.get(EPOCH_HEADER);
    if (cycle.epoch !== null && epoch !== null && epoch !== cycle.epoch) throw new EpochChanged();
    return res;
  }

  async function okJson(res: Response): Promise<unknown> {
    if (!res.ok) throw await httpError(res);
    return res.json();
  }

  async function assertCurrent(cycle: Cycle): Promise<void> {
    if (stopped || (await getMeta(db, 'userId')) !== cycle.userId) throw new CycleEnd();
  }

  async function sendPush(cycle: Cycle, ops: OutboxOp[]): Promise<PushResult[]> {
    const res = await request(cycle, 'POST', '/api/sync/push', { ops });
    return PushResponse.parse(await okJson(res)).results;
  }

  const effectiveStatus = (r: PushResult) =>
    r.status === 'duplicate' ? (r.originalStatus ?? 'applied') : r.status;

  const deadletterOf = (op: OutboxOp, code: string | undefined): DeadletterEntry => ({
    opId: op.opId,
    userId: op.userId,
    entity: op.entity,
    id: op.id,
    code: code ?? 'unknown',
    detail: { kind: op.kind, fieldNames: Object.keys(op.fields).sort() },
    receivedAt: nowIso(),
  });

  // ---- 2. Époque ----

  function depth(entity: string, guard = 0): number {
    const parent = ruleOf(entity)?.parent;
    return parent && guard < 16 ? 1 + depth(parent.entity, guard + 1) : 0;
  }

  /** a. restore_upsert des lignes J récentes, parents d'abord, jamais dans l'outbox. */
  async function resendJournal(cycle: Cycle): Promise<void> {
    const consent = await localHealthConsentActive(db);
    const since = now() - EPOCH_RESEND_DAYS * DAY_MS;
    const candidates: { entity: string; id: string; fields: Record<string, unknown>; seen: number | null }[] =
      [];
    for (const entity of mirrorStoreNames(db)) {
      const rule = ruleOf(entity);
      if (rule?.syncClass !== 'J' || entity === 'sync_rejection') continue;
      if (!consent && rule.category === 'C2') continue;
      for (const row of await db.mirror(entity).toArray()) {
        if (row.ownerId !== cycle.userId || typeof row.updatedAt !== 'string') continue;
        if (!(Date.parse(row.updatedAt) >= since)) continue;
        let fields: Record<string, unknown> = {};
        for (const column of rule.clientWritable) {
          const key = snakeToCamel(column);
          if (Object.hasOwn(row, key) && row[key] !== undefined) fields[key] = row[key];
        }
        if (!consent) fields = stripC2Fields(rule, fields).fields;
        fields.deletedAt = row.deletedAt ?? null;
        candidates.push({ entity, id: row.id, fields, seen: row.serverRevSeen ?? null });
      }
    }
    candidates.sort(
      (a, b) =>
        depth(a.entity) - depth(b.entity) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
        (a.entity < b.entity ? -1 : a.entity > b.entity ? 1 : 0),
    );
    const ops: OutboxOp[] = candidates.map((c) => ({
      opId: newOpId(),
      userId: cycle.userId,
      entity: c.entity,
      id: c.id,
      kind: 'restore_upsert',
      fields: c.fields,
      clientTs: nowIso(),
      protocol: SYNC_PROTOCOL,
      attempts: 0,
      serverRevSeen: c.seen,
    }));
    for (let i = 0; i < ops.length; i += SYNC_PUSH_MAX) {
      await assertCurrent(cycle);
      const batch = ops.slice(i, i + SYNC_PUSH_MAX);
      const byId = new Map(batch.map((o) => [o.opId, o]));
      const results = await sendPush(cycle, batch);
      // Un renvoi rejeté va en deadletter : ce n'est pas un échec du cycle.
      const dead = results.flatMap((r) => {
        const op = byId.get(r.opId);
        return op && effectiveStatus(r) === 'rejected' ? [deadletterOf(op, r.code)] : [];
      });
      if (dead.length > 0) await db.deadletter.bulkPut(dead);
    }
  }

  /** b. R-SYN-28 : renvoi d'un retrait d'accord santé perdu par une restauration. */
  async function replayWithdrawal(cycle: Cycle): Promise<void> {
    if (!hasMirror('consent_event')) return;
    const last = await db
      .mirror('consent_event')
      .where('[type+createdAt]')
      .between(['health', Dexie.minKey], ['health', Dexie.maxKey])
      .last();
    if (last?.action !== 'withdraw' || typeof last.createdAt !== 'string') return;
    const me = MeConsents.parse(await okJson(await request(cycle, 'GET', '/api/me')));
    if (!me.consents.health.active) return;
    const res = await request(cycle, 'POST', '/api/me/consents/health/replay-withdraw', {
      withdrawnAt: last.createdAt,
    });
    if (res.ok) return;
    const error = await httpError(res);
    if (error.code !== 'conflict') throw error;
  }

  async function handleEpoch(cycle: Cycle): Promise<void> {
    if (cycle.epoch === null) return;
    const local = await getMeta(db, 'serverEpoch');
    if (local === cycle.epoch) return;
    if (local !== undefined) {
      // Outbox en pause jusqu'à la fin du renvoi ; un échec ici laisse l'époque locale inchangée.
      await resendJournal(cycle);
      await replayWithdrawal(cycle);
    }
    await assertCurrent(cycle);
    const epoch = cycle.epoch;
    await db.transaction('rw', db.meta, async () => {
      await setMeta(db, 'serverEpoch', epoch);
      if (local !== undefined) await deleteMeta(db, 'watermark');
    });
  }

  // ---- 3. Push ----

  async function applyPushResults(batch: OutboxOp[], results: PushResult[]): Promise<void> {
    const byId = new Map(batch.map((o) => [o.opId, o]));
    const stores = [...new Set(batch.map((o) => o.entity))].filter(hasMirror).map((e) => db.mirror(e));
    await db.transaction('rw', [db.outbox, db.deadletter, db.meta, ...stores], async () => {
      const rejected: OutboxOp[] = [];
      for (const r of results) {
        const op = byId.get(r.opId);
        if (!op) continue;
        byId.delete(r.opId);
        await db.outbox.delete(op.opId);
        if (effectiveStatus(r) === 'rejected') {
          await db.deadletter.put(deadletterOf(op, r.code));
          rejected.push(op);
          continue;
        }
        if (!hasMirror(op.entity)) continue;
        const mirror = db.mirror(op.entity);
        if (r.dropped) {
          await mirror.delete(op.id);
          continue;
        }
        const row = await mirror.get(op.id);
        if (!row) continue;
        const updated = { ...row };
        if (r.rev !== undefined) updated.serverRevSeen = r.rev;
        for (const field of r.droppedFields ?? []) updated[field] = null;
        await mirror.put(updated);
      }
      let refetch = false;
      for (const op of rejected) {
        const row = hasMirror(op.entity) ? await db.mirror(op.entity).get(op.id) : undefined;
        const others = await db.outbox.where('[entity+id]').equals([op.entity, op.id]).count();
        if (row && row.serverRevSeen == null && others === 0) await db.mirror(op.entity).delete(op.id);
        else refetch = true;
      }
      if (refetch) await deleteMeta(db, 'watermark');
    });
  }

  async function push(cycle: Cycle): Promise<void> {
    const opIds = (await db.outbox.where('userId').equals(cycle.userId).primaryKeys()).sort();
    for (let i = 0; i < opIds.length; i += SYNC_PUSH_MAX) {
      await assertCurrent(cycle);
      const keys = opIds.slice(i, i + SYNC_PUSH_MAX);
      const batch = await db.transaction('rw', db.outbox, async () => {
        const ops = (await db.outbox.bulkGet(keys)).filter((o): o is OutboxOp => o !== undefined);
        const bumped = ops.map((o) => ({ ...o, attempts: o.attempts + 1 }));
        await db.outbox.bulkPut(bumped);
        return bumped;
      });
      if (batch.length === 0) continue;
      const results = await sendPush(
        cycle,
        batch.map((o) => convertOutboxOp(o)),
      );
      await applyPushResults(batch, results);
    }
  }

  // ---- 4. Pull ----

  async function dropUnreceived(received: Map<string, Set<string>>, watermark: string): Promise<void> {
    const stores = mirrorStoreNames(db);
    await db.transaction('rw', [db.outbox, db.meta, ...stores.map((s) => db.mirror(s))], async () => {
      for (const store of stores) {
        const got = received.get(store) ?? new Set<string>();
        const stale: string[] = [];
        for (const id of await db.mirror(store).toCollection().primaryKeys()) {
          if (got.has(id)) continue;
          if ((await db.outbox.where('[entity+id]').equals([store, id]).count()) === 0) stale.push(id);
        }
        await db.mirror(store).bulkDelete(stale);
      }
      await setMeta(db, 'watermark', watermark);
    });
  }

  async function pull(cycle: Cycle): Promise<void> {
    let since = (await getMeta(db, 'watermark')) ?? null;
    let full = since === null;
    let expiredHandled = false;
    const received = new Map<string, Set<string>>();
    for (;;) {
      await assertCurrent(cycle);
      const path = since === null ? '/api/sync/pull' : `/api/sync/pull?since=${encodeURIComponent(since)}`;
      const res = await request(cycle, 'GET', path);
      if (!res.ok) {
        const error = await httpError(res);
        if (error.code === 'watermark_expired' && since !== null && !expiredHandled) {
          // Miroirs vidés, outbox intacte, un seul pull complet.
          expiredHandled = true;
          await clearMirrors(db);
          await deleteMeta(db, 'watermark');
          since = null;
          full = true;
          received.clear();
          continue;
        }
        throw error;
      }
      const page = PullResponse.parse(await res.json());
      await assertCurrent(cycle);
      await applyPulledRows(db, page.rows);
      if (full) {
        for (const { entity, row } of page.rows) {
          const ids = received.get(entity) ?? new Set<string>();
          ids.add(String(row.id));
          received.set(entity, ids);
        }
      } else {
        await setMeta(db, 'watermark', page.nextWatermark);
      }
      if (page.catalogVersion !== null) await setMeta(db, 'serverCatalogVersion', page.catalogVersion);
      const healthConsentPulled = page.rows.some(
        (r) => r.entity === 'consent_event' && r.row.type === 'health',
      );
      if (healthConsentPulled && !(await localHealthConsentActive(db))) await purgeHealthData(db, rules);
      since = page.nextWatermark;
      if (!page.hasMore) break;
    }
    if (full && since !== null) await dropUnreceived(received, since);
    await setMeta(db, 'lastPullOkAt', nowIso());
  }

  // ---- 5. Catalogue ----

  async function syncCatalog(): Promise<void> {
    const serverVersion = await getMeta(db, 'serverCatalogVersion');
    if (serverVersion === undefined || serverVersion === (await getMeta(db, 'catalogVersion'))) return;
    try {
      await refreshCatalog(db, transport);
    } catch {
      // catalogue réessayé au prochain cycle
    }
  }

  // ---- Cycle ----

  function scheduleRetry(): void {
    failures += 1;
    if (!started || stopped) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void enqueue('full');
    }, retryDelayMs(failures));
  }

  async function handleFailure(error: unknown): Promise<void> {
    if (error instanceof CycleEnd) return;
    if (error instanceof OfflineError) {
      setState({ connection: 'offline' });
      scheduleRetry();
      return;
    }
    if (error instanceof HttpError) {
      switch (error.code) {
        case 'unauthenticated':
          setState({ connection: 'unauthenticated' });
          return;
        case 'password_change_required':
          return;
        case 'account_deleted':
          await wipeUserData(db, { keepOutbox: false });
          setState({ connection: 'account_deleted' });
          deps.onAccountDeleted?.();
          return;
        case 'protocol_unsupported':
          setState({ connection: 'protocol_unsupported' });
          return;
      }
    }
    scheduleRetry();
  }

  /** Un cycle ; 'epoch_changed' quand une réponse a porté une autre époque que celle du cycle. */
  async function runCycle(kind: CycleKind, isRerun: boolean): Promise<'done' | 'epoch_changed'> {
    const userId = await getMeta(db, 'userId');
    if (!userId || stopped) return 'done';
    if (userId !== lastUserId) {
      lastUserId = userId;
      failures = 0;
      setState({ connection: 'unknown' });
    }
    const cycle: Cycle = { userId, epoch: null };
    try {
      const health = await request(cycle, 'GET', '/api/health');
      const body = (await okJson(health)) as { epoch?: unknown } | null;
      cycle.epoch = health.headers.get(EPOCH_HEADER) ?? (typeof body?.epoch === 'string' ? body.epoch : null);
      failures = 0;
      setState({ connection: 'online' });
      await handleEpoch(cycle);
      if (kind === 'full') await push(cycle);
      await pull(cycle);
      await syncCatalog();
      return 'done';
    } catch (error) {
      if (error instanceof EpochChanged && !isRerun) return 'epoch_changed';
      await handleFailure(error);
      return 'done';
    }
  }

  async function runSlot(kind: CycleKind): Promise<void> {
    try {
      // Au plus un cycle immédiat de plus quand l'époque a changé en cours de cycle.
      if ((await runCycle(kind, false)) === 'epoch_changed') await runCycle(kind, true);
    } finally {
      await refreshState();
    }
  }

  function launch(kind: CycleKind): Promise<void> {
    if (stopped) {
      setState({ syncing: false });
      return Promise.resolve();
    }
    clearTimeout(retryTimer);
    retryTimer = undefined;
    setState({ syncing: true });
    const promise = runSlot(kind)
      .catch(() => {})
      .finally(() => {
        running = null;
        if (!next) setState({ syncing: false });
      });
    running = promise;
    return promise;
  }

  /** File unique : un cycle en vol, au plus un autre programmé (complet s'il est demandé une fois). */
  function enqueue(kind: CycleKind): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!running) return launch(kind);
    if (next) {
      if (kind === 'full') next.kind = 'full';
      return next.promise;
    }
    const queued: { kind: CycleKind; promise: Promise<void> } = { kind, promise: Promise.resolve() };
    queued.promise = running.then(() => {
      next = null;
      return launch(queued.kind);
    });
    next = queued;
    return queued.promise;
  }

  function debounced(): Promise<void> {
    if (stopped) return Promise.resolve();
    clearTimeout(debounceTimer);
    const done = new Promise<void>((resolve) => debounceWaiters.push(resolve));
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      const waiters = debounceWaiters;
      debounceWaiters = [];
      void enqueue('full').then(() => {
        for (const w of waiters) w();
      });
    }, SYNC_DEBOUNCE_MS);
    return done;
  }

  const engine: SyncEngine = {
    syncNow(trigger) {
      return trigger === 'set_logged' ? debounced() : enqueue('full');
    },
    pullNow() {
      return enqueue('pull');
    },
    async flushBefore(ms) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const delay = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
      try {
        await Promise.race([engine.syncNow('coach'), delay]);
      } finally {
        clearTimeout(timer);
      }
    },
    getState() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    start() {
      if (started) return;
      started = true;
      stopped = false;
      uninstall = (deps.triggers ?? installSyncTriggers)(engine);
      void engine.syncNow('launch');
    },
    stop() {
      stopped = true;
      started = false;
      uninstall?.();
      uninstall = null;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
      const waiters = debounceWaiters;
      debounceWaiters = [];
      for (const w of waiters) w();
    },
  };
  return engine;
}

import {
  type EntityRulesMap,
  EPOCH_HEADER,
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
} from '@appsport/contracts';
import { createMonotonicUuidV7 } from '@appsport/domain';
import { localHealthConsentActive } from '../local-db/consent';
import { type AppDb, mirrorStoreNames, type OutboxOp } from '../local-db/db';
import { deleteMeta, getMeta, setMeta } from '../local-db/meta';
import { clearMirrors, purgeHealthData, wipeUserData } from '../local-db/wipe';
import { applyPulledRows } from './apply-pull';
import { refreshCatalog } from './catalog';
import { type EpochIo, handleEpoch } from './epoch';
import { pendingCount } from './outbox';
import { convertOutboxOp } from './protocol-converters';
import { applyPushResults } from './push-results';
import {
  fetchJsonWithTimeout,
  HttpError,
  httpErrorOf,
  type JsonReply,
  OfflineError,
  type SyncTransport,
} from './transport';
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

/** Fin de cycle sans échec : utilisateur changé, ou cycle d'avant un stop(). */
class CycleEnd extends Error {}
/** Réponse portant une autre époque que celle du cycle (en-tête lu avant le corps). */
class EpochChanged extends Error {}

type CycleKind = 'full' | 'pull';
interface Cycle {
  userId: string;
  epoch: string | null;
  /** Génération du moteur au lancement : un stop() la fait avancer. */
  generation: number;
}
interface Queued {
  kind: CycleKind;
  promise: Promise<void>;
  resolve: () => void;
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
  let generation = 0;
  let uninstall: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let debounceWaiters: (() => void)[] = [];
  let running = false;
  let next: Queued | null = null;

  function setState(patch: Partial<SyncState>): void {
    const updated = { ...state, ...patch };
    const keys = Object.keys(updated) as (keyof SyncState)[];
    if (keys.every((k) => updated[k] === state[k])) return;
    state = updated;
    for (const fn of listeners) fn(state);
  }

  async function rejectedCount(userId: string): Promise<number> {
    const opIds = new Set((await db.deadletter.where('userId').equals(userId).toArray()).map((d) => d.opId));
    if (db.mirrorNames.includes('sync_rejection')) {
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

  /** Requête de synchro ; l'échéance couvre la lecture du corps, l'époque est lue avant lui. */
  function request(cycle: Cycle, method: 'GET' | 'POST', path: string, body?: unknown): Promise<JsonReply> {
    const headers: Record<string, string> = { [PROTOCOL_HEADER]: String(SYNC_PROTOCOL) };
    const init: RequestInit = { method, headers };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    return fetchJsonWithTimeout(transport, path, init, timeoutMs, (res) => {
      const epoch = res.headers.get(EPOCH_HEADER);
      if (cycle.epoch !== null && epoch !== null && epoch !== cycle.epoch) throw new EpochChanged();
    });
  }

  function okBody(reply: JsonReply): unknown {
    if (!reply.res.ok) throw httpErrorOf(reply);
    return reply.body;
  }

  async function isCurrent(cycle: Cycle): Promise<boolean> {
    return cycle.generation === generation && (await getMeta(db, 'userId')) === cycle.userId;
  }

  async function assertCurrent(cycle: Cycle): Promise<void> {
    if (!(await isCurrent(cycle))) throw new CycleEnd();
  }

  async function sendPush(cycle: Cycle, ops: OutboxOp[]): Promise<PushResult[]> {
    return PushResponse.parse(okBody(await request(cycle, 'POST', '/api/sync/push', { ops }))).results;
  }

  const epochIo = (cycle: Cycle): EpochIo => ({
    db,
    rules,
    userId: cycle.userId,
    now,
    newOpId,
    assertCurrent: () => assertCurrent(cycle),
    sendPush: (ops) => sendPush(cycle, ops),
    request: (method, path, body) => request(cycle, method, path, body),
  });

  // ---- 3. Push ----

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
      // Utilisateur changé pendant la requête : rien n'est appliqué.
      await assertCurrent(cycle);
      await applyPushResults(db, batch, results, nowIso());
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
      const reply = await request(cycle, 'GET', path);
      if (!reply.res.ok) {
        const error = httpErrorOf(reply);
        if (error.code === 'watermark_expired' && since !== null && !expiredHandled) {
          await assertCurrent(cycle);
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
      const page = PullResponse.parse(reply.body);
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

  async function handleFailure(cycle: Cycle, error: unknown): Promise<void> {
    if (error instanceof CycleEnd) return;
    // Utilisateur changé ou moteur arrêté pendant la requête : la réponse ne le concerne plus.
    if (!(await isCurrent(cycle))) return;
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
  async function runCycle(kind: CycleKind, isRerun: boolean, gen: number): Promise<'done' | 'epoch_changed'> {
    const userId = await getMeta(db, 'userId');
    if (!userId || gen !== generation) return 'done';
    if (userId !== lastUserId) {
      lastUserId = userId;
      failures = 0;
      setState({ connection: 'unknown' });
    }
    const cycle: Cycle = { userId, epoch: null, generation: gen };
    try {
      const health = await request(cycle, 'GET', '/api/health');
      const body = okBody(health) as { epoch?: unknown } | null;
      cycle.epoch =
        health.res.headers.get(EPOCH_HEADER) ?? (typeof body?.epoch === 'string' ? body.epoch : null);
      await assertCurrent(cycle);
      setState({ connection: 'online' });
      await handleEpoch(epochIo(cycle), cycle.epoch);
      if (kind === 'full') await push(cycle);
      await pull(cycle);
      await syncCatalog();
      // Seul un cycle réussi de bout en bout remet les reprises à zéro.
      failures = 0;
      return 'done';
    } catch (error) {
      if (error instanceof EpochChanged && !isRerun) return 'epoch_changed';
      await handleFailure(cycle, error);
      return 'done';
    }
  }

  async function runSlot(kind: CycleKind, gen: number): Promise<void> {
    try {
      // Au plus un cycle immédiat de plus quand l'époque a changé en cours de cycle.
      if ((await runCycle(kind, false, gen)) === 'epoch_changed') await runCycle(kind, true, gen);
    } finally {
      await refreshState();
    }
  }

  /**
   * Lance un cycle. À sa fin, le cycle programmé démarre de façon synchrone, avant que les
   * appelants qui attendaient ne reprennent la main : aucun créneau où deux cycles partiraient.
   */
  function launch(kind: CycleKind): Promise<void> {
    running = true;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    setState({ syncing: true });
    return runSlot(kind, generation)
      .catch(() => {})
      .finally(() => {
        const queued = next;
        next = null;
        if (queued && !stopped) {
          void launch(queued.kind).then(queued.resolve);
          return;
        }
        running = false;
        setState({ syncing: false });
        queued?.resolve();
      });
  }

  /** File unique : un cycle en vol, au plus un autre programmé (complet s'il est demandé une fois). */
  function enqueue(kind: CycleKind): Promise<void> {
    if (stopped) return Promise.resolve();
    if (next) {
      if (kind === 'full') next.kind = 'full';
      return next.promise;
    }
    if (!running) return launch(kind);
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    next = { kind, promise, resolve };
    return promise;
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
      // Le cycle en vol s'arrête à sa prochaine vérification et n'agit plus sur sa réponse.
      generation += 1;
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

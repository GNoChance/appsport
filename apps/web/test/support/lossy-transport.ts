import type { SyncTransport } from '../../src/sync/transport';

export interface LossyOptions {
  seed: number;
  dropRate: number;
  dupRate: number;
  maxDelayMs: number;
  reorder: boolean;
}

export interface LossyStats {
  /** Pertes : requêtes perdues avant le serveur + réponses perdues après lui. */
  dropped: number;
  droppedRequests: number;
  droppedResponses: number;
  /** Réponses perdues par chemin : un push dont la réponse est perdue a été appliqué. */
  droppedResponsesByPath: Record<string, number>;
  duplicated: number;
  replayedLate: number;
}

/** Générateur pseudo-aléatoire déterministe sur 32 bits, valeurs dans [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Octets pseudo-aléatoires déterministes (générateurs UUIDv7 des tests). */
export function seededBytes(seed: number): (n: number) => Uint8Array {
  const rand = mulberry32(seed);
  return (n) => Uint8Array.from({ length: n }, () => Math.floor(rand() * 256));
}

/** Copie rejouable plus tard : sans le signal de l'échéance d'origine, déjà levé à ce moment-là. */
function detached(init: RequestInit): RequestInit {
  const { signal: _signal, ...rest } = init;
  return rest;
}

/**
 * Réseau dégradé et déterministe (graine `seed`) autour de `inner`. À chaque appel : retard réel
 * `rand() * maxDelayMs` ; si `reorder` et un doublon attend, il est rejoué tardivement (réponse
 * ignorée) ; perte (`dropRate`) : une fois sur deux sans appel (requête perdue), sinon après l'appel
 * (réponse perdue) ; doublon (`dupRate`) : mis en attente si `reorder`, sinon deux appels et la
 * première réponse ; sinon l'appel tel quel. `heal()` remet taux et retard à 0 et vide la file.
 */
export function lossyTransport(
  inner: SyncTransport,
  opts: LossyOptions,
): SyncTransport & { heal(): void; stats: LossyStats } {
  const rand = mulberry32(opts.seed);
  let { dropRate, dupRate, maxDelayMs } = opts;
  const waiting: { path: string; init: RequestInit }[] = [];
  const stats: LossyStats = {
    dropped: 0,
    droppedRequests: 0,
    droppedResponses: 0,
    droppedResponsesByPath: {},
    duplicated: 0,
    replayedLate: 0,
  };

  return {
    stats,
    heal() {
      dropRate = 0;
      dupRate = 0;
      maxDelayMs = 0;
      waiting.length = 0;
    },
    async fetch(path, init) {
      const delay = rand() * maxDelayMs;
      if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      const late = opts.reorder ? waiting.shift() : undefined;
      if (late) {
        stats.replayedLate += 1;
        try {
          await (await inner.fetch(late.path, late.init)).text();
        } catch {
          // réponse d'un rejeu tardif ignorée
        }
      }
      if (rand() < dropRate) {
        stats.dropped += 1;
        if (rand() < 0.5) {
          stats.droppedRequests += 1;
          throw new TypeError('lossy: request dropped');
        }
        await inner.fetch(path, init);
        stats.droppedResponses += 1;
        stats.droppedResponsesByPath[path] = (stats.droppedResponsesByPath[path] ?? 0) + 1;
        throw new TypeError('lossy: response dropped');
      }
      if (rand() < dupRate) {
        stats.duplicated += 1;
        if (opts.reorder) {
          waiting.push({ path, init: detached(init) });
          return inner.fetch(path, init);
        }
        const first = await inner.fetch(path, init);
        await inner.fetch(path, detached(init));
        return first;
      }
      return inner.fetch(path, init);
    },
  };
}

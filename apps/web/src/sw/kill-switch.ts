import { HealthResponse } from '@appsport/contracts';
import { fetchJsonWithTimeout, type SyncTransport } from '../sync/transport';
import { ILLUSTRATIONS_CACHE_PREFIX, SHELL_CACHE_PREFIX } from './precache-manifest';
import type { SwContainerLike } from './register';

/** Navigateur que l'interrupteur d'urgence touche ; le vrai par défaut, factice dans les tests. */
export interface KillSwitchEnv {
  serviceWorker?: Pick<SwContainerLike, 'getRegistrations'>;
  caches?: CacheStorage;
  reload?: () => void;
}

/** `navigator.serviceWorker`, absent d'un contexte non sécurisé ou d'un navigateur sans SW. */
export function browserServiceWorker(): ServiceWorkerContainer | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator.serviceWorker ?? undefined);
}

/** Cache Storage de la page, absent hors contexte sécurisé. */
export function browserCaches(): CacheStorage | undefined {
  return typeof caches === 'undefined' ? undefined : caches;
}

/**
 * Sonde `/api/health` du démarrage (R-PWA-6) : en `SYNC_TIMEOUT_MS` au plus, corps compris. Le JSON est
 * lu quel que soit le statut : un 503 (base en panne) porte encore `swKill`. `null` sans réponse ou
 * hors contrat.
 */
export async function probeHealth(transport: SyncTransport): Promise<HealthResponse | null> {
  try {
    const { body } = await fetchJsonWithTimeout(transport, '/api/health', { method: 'GET', cache: 'no-store' });
    const parsed = HealthResponse.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const doomedCache = (name: string) =>
  name.startsWith(SHELL_CACHE_PREFIX) || name.startsWith(ILLUSTRATIONS_CACHE_PREFIX);

/** Résultats tenus : un désenregistrement ou une suppression refusés n'arrêtent pas les autres. */
async function anyDone(tasks: readonly Promise<boolean>[]): Promise<boolean> {
  const results = await Promise.allSettled(tasks);
  return results.some((r) => r.status === 'fulfilled' && r.value);
}

/**
 * Interrupteur d'urgence côté page (R-PWA-6), au démarrage : si `swKill`, désenregistre tout SW, vide les
 * caches `shell-*` et `illustrations-*` (ni le marqueur `appsport-meta`, ni un cache inconnu, ni jamais
 * IndexedDB), puis recharge la page depuis le réseau. Recharge une seule fois et seulement si quelque chose
 * a été retiré : le SW a pu faire le ménage avant (T36), et la page rechargée ne trouve plus rien, ce qui
 * évite la boucle. Rend `true` si la page est rechargée.
 */
export async function applyKillSwitchIfNeeded(health: HealthResponse, env: KillSwitchEnv = {}): Promise<boolean> {
  if (!health.swKill) return false;
  const serviceWorker = env.serviceWorker ?? browserServiceWorker();
  const storage = env.caches ?? browserCaches();
  const reload = env.reload ?? (() => window.location.reload());

  const registrations = serviceWorker ? await serviceWorker.getRegistrations().catch(() => []) : [];
  const unregistered = await anyDone(registrations.map((r) => r.unregister()));
  const names = storage ? await storage.keys().catch(() => []) : [];
  const deleted = storage ? await anyDone(names.filter(doomedCache).map((n) => storage.delete(n))) : false;

  if (!unregistered && !deleted) return false;
  reload();
  return true;
}

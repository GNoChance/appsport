import { SYNC_PROTOCOL, SyncOp } from '@appsport/contracts';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import type { OutboxOp } from '../../src/local-db/db';
import type { SwStatus } from '../../src/sw/protocol';

// Outils PWA des E2E : appli installée, service worker, caches et base locale lus depuis la page.

const LOCAL_DB_NAME = 'appsport';
const SW_SKIP_REASON = 'WebKit sous Windows : la CI Linux fait foi';

/** Appli installée (R-ARR-1) : `display-mode: standalone` et `navigator.standalone`, avant tout script de la page. */
export async function emulateStandalone(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      if (!/display-mode:\s*standalone/.test(query)) return original(query);
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    };
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  });
}

/**
 * Service worker exigé (R-TST-1) : sans lui, erreur en CI ; ailleurs le test est sauté (WebKit sous
 * Windows n'a pas de SW, la CI Linux fait foi).
 */
export async function requireServiceWorker(page: Page): Promise<void> {
  if (await page.evaluate(() => 'serviceWorker' in navigator)) return;
  if (process.env.CI)
    throw new Error('Service worker indisponible dans ce navigateur : exigé en CI (R-TST-1).');
  test.skip(true, SW_SKIP_REASON);
}

export async function waitForController(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
}

/** `GET_STATUS` au SW qui contrôle la page ; `null` sans contrôleur ou sans réponse en 1 s. */
export async function swStatus(page: Page): Promise<SwStatus | null> {
  return page.evaluate(
    () =>
      new Promise<SwStatus | null>((resolve) => {
        const controller = navigator.serviceWorker?.controller;
        if (!controller) {
          resolve(null);
          return;
        }
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), 1000);
        channel.port1.onmessage = (event: MessageEvent) => {
          clearTimeout(timer);
          resolve(event.data as SwStatus);
        };
        controller.postMessage({ type: 'GET_STATUS' }, [channel.port2]);
      }),
  );
}

export async function waitForWaitingWorker(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting != null))
    .toBe(true);
}

export async function registrationCount(page: Page): Promise<number> {
  return page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
}

export async function cacheNames(page: Page): Promise<string[]> {
  return page.evaluate(() => caches.keys());
}

type IdbAction =
  | { op: 'getAll'; store: string }
  | { op: 'get'; store: string; key: string }
  | { op: 'put'; store: string; value: unknown }
  | { op: 'version' };

/** Accès direct à la base Dexie de la page (IndexedDB natif, version courante, sans montée de version). */
function idb(page: Page, action: IdbAction): Promise<unknown> {
  return page.evaluate(
    ({ name, action }) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (action.op === 'version') {
            db.close();
            resolve(db.version);
            return;
          }
          const tx = db.transaction(action.store, action.op === 'put' ? 'readwrite' : 'readonly');
          const store = tx.objectStore(action.store);
          const request =
            action.op === 'getAll'
              ? store.getAll()
              : action.op === 'get'
                ? store.get(action.key)
                : store.put(action.value);
          let result: unknown;
          request.onsuccess = () => {
            result = request.result;
          };
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { name: LOCAL_DB_NAME, action },
  );
}

export async function idbGetAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]> {
  return (await idb(page, { op: 'getAll', store })) as T[];
}

export async function idbPut(page: Page, store: string, value: unknown): Promise<void> {
  await idb(page, { op: 'put', store, value });
}

/** Version IndexedDB : Dexie stocke `LOCAL_DB_VERSION * 10`. */
export async function idbVersion(page: Page): Promise<number> {
  return (await idb(page, { op: 'version' })) as number;
}

/** Valeur de `meta` (`{ key, value }`) ; `undefined` si la clé est absente. */
export async function metaValue(page: Page, key: string): Promise<unknown> {
  const row = (await idb(page, { op: 'get', store: 'meta', key })) as { value: unknown } | undefined;
  return row?.value;
}

/** Retour au premier plan (`visibilitychange`, page visible) : déclencheur de synchro (R-SYN-29). */
export async function triggerForeground(page: Page): Promise<void> {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

const FAKE_TS = '2026-10-06T10:00:00.000Z';

/** UUIDv7 fixe : horodatage de FAKE_TS, `tag` (4 bits) et `n` pour distinguer les identifiants. */
function fakeUuidV7(tag: number, n: number): string {
  const ms = Date.parse(FAKE_TS).toString(16).padStart(12, '0');
  const tail = n.toString(16).padStart(12, '0');
  return `${ms.slice(0, 8)}-${ms.slice(8)}-7000-${(0x8000 | tag).toString(16)}-${tail}`;
}

/**
 * Opération d'outbox factice et valide (SyncOp) : patch de `sync_rejection` qui ne pose que `dismissedAt`,
 * seule écriture client de la classe J au socle ; `n` distingue les opérations.
 */
export function fakeOutboxOp(userId: string, n = 1): OutboxOp {
  return SyncOp.parse({
    opId: fakeUuidV7(0, n),
    userId,
    entity: 'sync_rejection',
    id: fakeUuidV7(1, n),
    kind: 'patch',
    fields: { dismissedAt: FAKE_TS },
    clientTs: FAKE_TS,
    protocol: SYNC_PROTOCOL,
    attempts: 0,
  });
}

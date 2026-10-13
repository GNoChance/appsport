import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { createFakeApi, type FakeApi, type FakeReply } from './fake-api';

export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
export const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
export const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Mode d'affichage de la page : appli installée (`standalone`) ou onglet de navigateur. */
export function stubDisplayMode(standalone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

export function stubUserAgent(userAgent: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

/**
 * Adresse de la page avec son fragment, comme à l'ouverture d'un lien d'invitation ; rend la
 * longueur de l'historique, pour vérifier que l'effacement du fragment n'y ajoute rien.
 */
export function openUrl(path: string): number {
  window.history.replaceState(null, '', path);
  return window.history.length;
}

/** Fragment effacé de l'adresse par remplacement : ni dans l'adresse, ni dans un nouvel historique. */
export function fragmentCleared(historyLength: number): boolean {
  return (
    window.location.hash === '' &&
    !window.location.href.includes('#') &&
    window.history.length === historyLength
  );
}

export function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

export function click(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

/** Laisse passer `turns` tours de boucle (requêtes, Dexie, rendus) : ce qui devait arriver est arrivé. */
export async function settle(turns = 50): Promise<void> {
  await act(async () => {
    for (let i = 0; i < turns; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

export const EMPTY_PULL = { rows: [], nextWatermark: 'e1:0', hasMore: false, catalogVersion: null };

export interface LostSessionApi extends FakeApi {
  /** La session est rouverte (connexion, création, réinitialisation réussie) : tout répond. */
  open(): void;
}

/**
 * Serveur pour lequel la session de l'appareil est perdue jusqu'à `open()` : `unauthenticated`
 * (/api/health répond, /api/me, push et pull en 401) ou `account_deleted` (tout en 410).
 */
export function lostSessionApi(lost: 'unauthenticated' | 'account_deleted'): LostSessionApi {
  let opened = false;
  const refused: FakeReply = { status: lost === 'unauthenticated' ? 401 : 410, body: { error: lost } };
  const api = createFakeApi()
    .on('GET', '/api/health', () =>
      opened || lost === 'unauthenticated' ? { status: 200, body: {} } : refused,
    )
    .on('GET', '/api/me', () => (opened ? { status: 404, body: { error: 'not_found' } } : refused))
    .on('POST', '/api/sync/push', (req) => {
      if (!opened) return refused;
      const ops = (req.body as { ops: { opId: string }[] }).ops;
      return {
        status: 200,
        body: { results: ops.map((o) => ({ opId: o.opId, status: 'applied', rev: 1 })) },
      };
    })
    .on('GET', '/api/sync/pull', () => (opened ? { status: 200, body: EMPTY_PULL } : refused));
  return Object.assign(api, {
    open() {
      opened = true;
    },
  });
}

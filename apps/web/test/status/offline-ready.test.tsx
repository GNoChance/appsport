import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfflineReadyIndicator } from '../../src/features/status/OfflineReadyIndicator';
import { setMeta } from '../../src/local-db/meta';
import { createTestLocalDb } from '../support/local-db';
import { DEFAULT_NOW, renderApp, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

async function dbWith(pullAgoMs: number | null) {
  const db = createTestLocalDb();
  await setMeta(db, 'catalogVersion', 'cat-1');
  await setMeta(db, 'serverCatalogVersion', 'cat-1');
  if (pullAgoMs !== null) await setMeta(db, 'lastPullOkAt', iso(DEFAULT_NOW - pullAgoMs));
  return db;
}

const indicator = () => screen.getByTestId('offline-ready');
const stateIs = (s: string) => () => indicator().getAttribute('data-state') === s;

describe('OfflineReadyIndicator', () => {
  it('pull il y a 1 h : « Prêt hors ligne »', async () => {
    await renderWithServices(<OfflineReadyIndicator />, { db: await dbWith(HOUR) });
    await until(stateIs('ready'));
    expect(indicator().textContent).toContain('Prêt hors ligne');
  });

  it('pull il y a 25 h : pas prêt, faute de synchronisation récente', async () => {
    await renderWithServices(<OfflineReadyIndicator />, { db: await dbWith(25 * HOUR) });
    await until(
      () => indicator().textContent?.includes('Pas de synchronisation depuis plus de 24 h') ?? false,
    );
    expect(indicator().getAttribute('data-state')).toBe('not-ready');
    expect(indicator().textContent).toContain('Pas encore prêt hors ligne');
  });

  it('SW absent : « Appli pas encore enregistrée sur l’appareil »', async () => {
    await renderWithServices(<OfflineReadyIndicator />, { db: await dbWith(HOUR), swStatus: null });
    await until(
      () => indicator().textContent?.includes("Appli pas encore enregistrée sur l'appareil") ?? false,
    );
    expect(indicator().getAttribute('data-state')).toBe('not-ready');
    expect(indicator().textContent).toContain('Illustrations à télécharger');
  });

  it('catalogue en retard : « Catalogue à télécharger »', async () => {
    const db = await dbWith(HOUR);
    await setMeta(db, 'serverCatalogVersion', 'cat-2');
    await renderWithServices(<OfflineReadyIndicator />, { db });
    await until(() => indicator().textContent?.includes('Catalogue à télécharger') ?? false);
  });

  it('recalculé à chaque état de synchro', async () => {
    const db = await dbWith(null);
    const { sync } = await renderWithServices(<OfflineReadyIndicator />, { db });
    await until(() => indicator().textContent?.includes('Pas de synchronisation') ?? false);
    await setMeta(db, 'lastPullOkAt', iso(DEFAULT_NOW - HOUR));
    sync.set({ lastPullOkAt: iso(DEFAULT_NOW - HOUR) });
    await until(stateIs('ready'));
  });

  it('« Réessayer » lance une synchro manuelle', async () => {
    const { sync, api } = await renderWithServices(<OfflineReadyIndicator />, { db: await dbWith(null) });
    api.on('GET', '/api/catalog', { status: 304 });
    await until(stateIs('not-ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await until(() => sync.triggers.includes('manual'));
  });

  it('readiness fournie : rendu direct', async () => {
    await renderWithServices(
      <OfflineReadyIndicator
        readiness={{
          ready: false,
          checks: { shell: true, catalog: true, illustrations: false, recentPull: true },
        }}
      />,
    );
    expect(indicator().getAttribute('data-state')).toBe('not-ready');
    expect(indicator().textContent).toContain('Illustrations à télécharger');
    expect(indicator().textContent).not.toContain('Catalogue à télécharger');
  });

  it("l'accueil affiche le voyant", async () => {
    await renderApp({ db: await dbWith(HOUR) });
    await until(() => screen.queryByTestId('offline-ready')?.getAttribute('data-state') === 'ready');
  });
});

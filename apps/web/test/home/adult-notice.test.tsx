import { cleanup, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, renderApp } from '../support/render';
import { until } from '../support/wait';

const NOTICE = "Tu as 18 ans : tu peux désormais choisir l'objectif « Perdre du gras » dans ton profil.";
const notice = () => screen.queryByText(NOTICE);

describe('message des 18 ans (R-AGE-6)', () => {
  it('affiché une fois : « J’ai compris » le retire, absent au rendu suivant', async () => {
    const db = createTestLocalDb();
    await setMeta(db, 'lastAgeBand', 'minor');
    await renderApp({ db });
    await until(() => notice() !== null);
    expect(notice()?.closest('[role="status"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "J'ai compris" }));
    await until(() => notice() === null);
    expect(await getMeta(db, 'lastAgeBand')).toBe('adult');

    cleanup();
    await renderApp({ db });
    await until(() => screen.queryByTestId('offline-ready') !== null);
    expect(notice()).toBeNull();
  });

  it('au lancement, le profil rafraîchi révèle le passage à 18 ans', async () => {
    const db = createTestLocalDb();
    await setMeta(db, 'lastAgeBand', 'minor');
    const api = createFakeApi();
    api.on('GET', '/api/me', { status: 200, body: makeMe() });
    await renderApp({ db, api, me: makeMe({ ageBand: 'minor' }) });
    await until(() => notice() !== null);
    expect(api.calls.map((c) => c.path)).toEqual(['/api/me']);
  });

  it('lastAgeBand absent : aucun message', async () => {
    await renderApp();
    await until(() => screen.queryByTestId('offline-ready') !== null);
    expect(notice()).toBeNull();
  });
});

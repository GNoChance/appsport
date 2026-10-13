import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { REJECTION_CODE_LABELS } from '../../src/features/status/RejectionsPage';
import type { AppDb, DeadletterEntry } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import type { SyncEngine } from '../../src/sync/engine';
import { createFakeApi } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { renderApp } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const AT = '2026-10-06T10:00:00.000Z';
const INTRO = "Le serveur a refusé ces modifications : elles n'ont pas été enregistrées.";
/** Rejet serveur au format de push.ts : `{ kind, fieldNames, reason }`, noms de champs seulement. */
const rejection = (
  id: string,
  opId: string,
  code = 'validation',
  o: { entity?: string; kind?: string; fieldNames?: string[] } = {},
) => ({
  id,
  ownerId: 'u-1',
  opId,
  entity: o.entity ?? 'place',
  rowId: 'p-1',
  code,
  detailJson: {
    kind: o.kind ?? 'patch',
    fieldNames: o.fieldNames ?? ['name', 'note'],
    reason: 'sql_constraint',
  },
  dismissedAt: null,
  createdAt: AT,
});
/** Rejet local au format de push-results.ts : `{ kind, fieldNames }`. */
const dead = (opId: string, code: string, detail: unknown = null): DeadletterEntry => ({
  opId,
  userId: 'u-1',
  entity: 'place',
  id: `row-${opId}`,
  code,
  detail,
  receivedAt: '2026-10-06T11:00:00.000Z',
});

let engine: SyncEngine | null = null;
afterEach(() => {
  engine?.stop();
  engine = null;
});

/** Écran des refus avec le moteur réel, hors ligne : ses compteurs viennent de la base locale. */
async function renderRejections(seed: (db: AppDb) => Promise<void>) {
  const db = createTestLocalDb();
  await seed(db);
  const api = createFakeApi();
  api.setOffline('reject');
  const view = await renderApp({ path: '/rejections', db, api, realSync: true });
  engine = view.engine;
  view.engine.start();
  await screen.findByRole('heading', { level: 1, name: 'Éléments refusés' });
  return view;
}

const counter = () => screen.getByTestId('rejected-counter').getAttribute('data-count');
const item = (text: string) => {
  const li = screen.getByText(text).closest('li');
  if (!li) throw new Error(`aucun élément pour ${text}`);
  return li;
};

describe('RejectionsPage (R-SYN-18)', () => {
  it.each([
    ['validation', 'Données invalides'],
    ['forbidden', 'Action non autorisée'],
    ['parent_rejected', 'Élément parent refusé'],
    ['stale_revision', 'Version périmée'],
    ['unknown_entity', 'Type de donnée inconnu'],
    ['protocol', "Version de l'appli trop ancienne"],
  ])('REJECTION_CODE_LABELS.%s', (code, label) => {
    expect(REJECTION_CODE_LABELS[code]).toBe(label);
  });

  it('rejet serveur r-1 (validation) et rejet local op-7 (parent_rejected), libellés traduits', async () => {
    await renderRejections(async (db) => {
      await seedMirror(db, 'sync_rejection', [rejection('r-1', 'op-1')]);
      await db.deadletter.put(dead('op-7', 'parent_rejected'));
    });
    await screen.findByText('Données invalides');
    expect(screen.getByText('Élément parent refusé')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Éléments refusés' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(item('Données invalides')).getByRole('button', { name: 'Ignorer' })).toBeTruthy();
    expect(screen.getByText(INTRO)).toBeTruthy();
  });

  it('chaque refus montre son détail : type de donnée, opération et champs (R-SYN-18)', async () => {
    await renderRejections(async (db) => {
      await seedMirror(db, 'sync_rejection', [rejection('r-1', 'op-1')]);
      await db.deadletter.put(dead('op-7', 'parent_rejected', { kind: 'create', fieldNames: ['name'] }));
      await db.deadletter.put(dead('op-8', 'forbidden'));
    });
    await screen.findByText('Données invalides');
    expect(
      within(item('Données invalides')).getByText('Lieu · modification · champs : name, note'),
    ).toBeTruthy();
    expect(within(item('Élément parent refusé')).getByText('Lieu · création · champ : name')).toBeTruthy();
    // Détail absent (rejet local ancien) : le type de donnée seul.
    expect(within(item('Action non autorisée')).getByText('Lieu')).toBeTruthy();
  });

  it('deux refus de même code : chaque « Ignorer » est décrit par son propre détail', async () => {
    await renderRejections(async (db) => {
      await seedMirror(db, 'sync_rejection', [
        rejection('r-1', 'op-1', 'validation', { entity: 'place', kind: 'create', fieldNames: ['name'] }),
        rejection('r-2', 'op-2', 'validation', { entity: 'gym', kind: 'patch', fieldNames: ['city'] }),
        rejection('r-3', 'op-3', 'validation', { entity: 'quota', kind: 'delete', fieldNames: [] }),
      ]);
    });
    await screen.findAllByText('Données invalides');
    const descriptions = screen.getAllByRole('button', { name: 'Ignorer' }).map((b) =>
      (b.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
    expect(descriptions).toHaveLength(3);
    expect(descriptions[0]).toMatch(/^Données invalides Lieu · création · champ : name Refusé le /);
    expect(descriptions[1]).toContain('Salle · modification · champ : city');
    // Type de donnée inconnu : son nom tel quel.
    expect(descriptions[2]).toContain('quota · suppression');
    for (const d of descriptions) expect(d).toContain('Données invalides');
  });

  it("code inconnu : le code lui-même s'affiche", async () => {
    await renderRejections(async (db) => {
      await db.deadletter.put(dead('op-9', 'quota_exceeded'));
    });
    expect(await screen.findByText('quota_exceeded')).toBeTruthy();
  });

  it("« Ignorer » r-1 → op patch { dismissedAt }, élément retiré, rejected-counter '1'", async () => {
    const { db } = await renderRejections(async (db) => {
      await seedMirror(db, 'sync_rejection', [rejection('r-1', 'op-1')]);
      await db.deadletter.put(dead('op-7', 'parent_rejected'));
    });
    await screen.findByText('Données invalides');
    await until(() => counter() === '2');
    fireEvent.click(within(item('Données invalides')).getByRole('button', { name: 'Ignorer' }));
    await until(() => screen.queryByText('Données invalides') === null);
    expect(screen.getByText('Élément parent refusé')).toBeTruthy();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entity: 'sync_rejection',
      id: 'r-1',
      kind: 'patch',
      fields: { dismissedAt: '2026-10-06T12:00:00.000Z' },
    });
    await until(() => counter() === '1');
  });

  it('« Ignorer » un rejet local : retiré sans op', async () => {
    const { db } = await renderRejections(async (db) => {
      await db.deadletter.put(dead('op-7', 'parent_rejected'));
    });
    await screen.findByText('Élément parent refusé');
    fireEvent.click(within(item('Élément parent refusé')).getByRole('button', { name: 'Ignorer' }));
    expect(await screen.findByText('Aucun refus.')).toBeTruthy();
    expect(await db.outbox.count()).toBe(0);
    await until(() => counter() === '0');
  });

  it('aucun refus → « Aucun refus. »', async () => {
    await renderRejections(async () => {});
    expect(await screen.findByText('Aucun refus.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Éléments refusés' })).toBeNull();
    // Rien de refusé : pas de phrase « Le serveur a refusé… » qui contredirait « Aucun refus. ».
    expect(screen.queryByText(INTRO)).toBeNull();
  });
});

describe('SettingsPage (R-SYN-31)', () => {
  const ADVICE =
    "Ton navigateur peut effacer les données de l'appli si l'espace manque. Pense à télécharger tes données régulièrement.";

  async function renderSettings(persistGranted?: boolean) {
    const db = createTestLocalDb();
    if (persistGranted !== undefined) await setMeta(db, 'persistGranted', persistGranted);
    const view = await renderApp({ path: '/settings', db });
    await screen.findByRole('heading', { level: 1, name: 'Réglages' });
    return view;
  }

  it('persistGranted true → « Stockage persistant : accordé », sans conseil', async () => {
    await renderSettings(true);
    expect(await screen.findByText('Stockage persistant : accordé')).toBeTruthy();
    expect(screen.queryByText(ADVICE)).toBeNull();
  });

  it('persistGranted false → « Stockage persistant : refusé » et conseil d’export avec lien', async () => {
    await renderSettings(false);
    expect(await screen.findByText('Stockage persistant : refusé')).toBeTruthy();
    expect(screen.getByText(ADVICE)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Télécharger mes données' });
    expect(link.getAttribute('href')).toBe('/profile/privacy');
  });

  it('persistGranted absent → « Stockage persistant : pas encore demandé »', async () => {
    await renderSettings();
    expect(await screen.findByText('Stockage persistant : pas encore demandé')).toBeTruthy();
    expect(screen.queryByText(ADVICE)).toBeNull();
  });
});

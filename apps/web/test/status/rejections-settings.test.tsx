import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { REJECTION_CODE_LABELS } from '../../src/features/status/RejectionsPage';
import { THEME_PREVIEWS } from '../../src/features/status/theme-previews';
import type { AppDb, DeadletterEntry } from '../../src/local-db/db';
import { setMeta } from '../../src/local-db/meta';
import type { SyncEngine } from '../../src/sync/engine';
import { applyTheme, readThemeChoice } from '../../src/ui/theme/theme';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';
import { createFakeApi, createFakeSyncEngine, type FakeSyncEngine } from '../support/fake-api';
import { createTestLocalDb } from '../support/local-db';
import { DEFAULT_NOW, renderApp } from '../support/render';
import { seedMirror } from '../support/seed';
import { until } from '../support/wait';

const AT = '2026-10-06T10:00:00.000Z';
/** Ligne des refus dans Réglages › Synchronisation, quand il y en a : son nom dit où elle mène. */
const REFUSED_LINK = 'Voir les éléments refusés : Refus du serveur';
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

/** Refus comptés par le moteur : la source du compteur « N refusé(s) » (Réglages › Synchronisation). */
const counter = () => String(engine?.getState().rejected);
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

  it('« Ignorer » r-1 → op patch { dismissedAt }, élément retiré, 1 refus compté', async () => {
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

/** Valeur d'une ligne d'information (sans lien) : le texte qui suit son libellé. */
const infoValue = (label: string) => screen.getByText(label, { exact: true }).nextElementSibling?.textContent;
/** Texte qui décrit une ligne liée (sa valeur), via aria-describedby. */
const describedBy = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

async function renderSettings(o: { persistGranted?: boolean; sync?: FakeSyncEngine; db?: AppDb } = {}) {
  const db = o.db ?? createTestLocalDb();
  if (o.persistGranted !== undefined) await setMeta(db, 'persistGranted', o.persistGranted);
  const view = await renderApp({ path: '/settings', db, sync: o.sync });
  await screen.findByRole('heading', { level: 1, name: 'Réglages' });
  return view;
}

describe('SettingsPage › Stockage (R-SYN-31)', () => {
  const ADVICE =
    "Ton navigateur peut effacer les données de l'appli si l'espace manque. Pense à télécharger tes données régulièrement.";

  it('persistGranted true → stockage persistant « Accordé », sans conseil', async () => {
    await renderSettings({ persistGranted: true });
    await until(() => infoValue('Stockage persistant') === 'Accordé');
    expect(screen.queryByText(ADVICE)).toBeNull();
  });

  it('persistGranted false → « Refusé » et conseil d’export avec lien', async () => {
    await renderSettings({ persistGranted: false });
    await until(() => infoValue('Stockage persistant') === 'Refusé');
    expect(screen.getByText(ADVICE)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Télécharger mes données' });
    expect(link.getAttribute('href')).toBe('/profile/privacy');
  });

  it('persistGranted absent → « Pas encore demandé »', async () => {
    await renderSettings();
    await until(() => infoValue('Stockage persistant') === 'Pas encore demandé');
    expect(screen.queryByText(ADVICE)).toBeNull();
  });
});

describe('SettingsPage › Apparence (spec refonte §4, maquette C03)', () => {
  afterEach(() => {
    applyTheme('auto');
    localStorage.removeItem('rune.theme');
  });

  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

  it('5 choix dans le groupe « Apparence », Auto coché par défaut', async () => {
    await renderSettings();
    const group = screen.getByRole('radiogroup', { name: 'Apparence' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['auto', 'clair', 'sombre', 'carnet', 'nuit']);
    expect(radio('Auto').checked).toBe(true);
    for (const name of ['Clair', 'Sombre', 'Carnet', 'Salle de nuit'])
      expect(radio(name).checked).toBe(false);
    expect(describedBy(radio('Auto'))).toBe('Clair ou sombre selon le téléphone');
  });

  it('chaque choix a son aperçu, décoratif', async () => {
    await renderSettings();
    const previews = document.querySelectorAll('[data-theme-preview]');
    expect([...previews].map((p) => p.getAttribute('data-theme-preview'))).toEqual([
      'auto',
      'clair',
      'sombre',
      'carnet',
      'nuit',
    ]);
    for (const p of previews) expect(p.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('choisir « Carnet » le garde sur l’appareil (writeThemeChoice) et pose data-theme="carnet" tout de suite', async () => {
    await renderSettings();
    fireEvent.click(radio('Carnet'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('carnet');
    expect(readThemeChoice()).toBe('carnet');
    expect(localStorage.getItem('rune.theme')).toBe('carnet');
    expect(radio('Carnet').checked).toBe(true);
    expect(radio('Auto').checked).toBe(false);
  });

  it('revenir à « Auto » retire data-theme : la page suit de nouveau le téléphone', async () => {
    await renderSettings();
    fireEvent.click(radio('Salle de nuit'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('nuit');
    fireEvent.click(radio('Auto'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(readThemeChoice()).toBe('auto');
    expect(radio('Auto').checked).toBe(true);
  });

  it('le thème appliqué au démarrage est coché à l’ouverture', async () => {
    applyTheme('sombre');
    await renderSettings();
    expect(radio('Sombre').checked).toBe(true);
    expect(radio('Auto').checked).toBe(false);
  });

  it('les couleurs des aperçus sont celles de tokens.css, thème par thème', () => {
    const blocks = parseCssBlocks(
      readFileSync(resolve(import.meta.dirname, '../../src/ui/theme/tokens.css'), 'utf8'),
    );
    const selectors = {
      clair: ':root',
      sombre: ':root[data-theme="sombre"]',
      carnet: ':root[data-theme="carnet"]',
      nuit: ':root[data-theme="nuit"]',
    } as const;
    for (const [theme, selector] of Object.entries(selectors) as [keyof typeof selectors, string][]) {
      const tokens = declarationsOf(blocks, selector);
      expect(THEME_PREVIEWS[theme], theme).toEqual({
        bg: tokens?.get('--bg'),
        surface: tokens?.get('--surface'),
        text: tokens?.get('--text'),
        accent: tokens?.get('--accent'),
        accent2: tokens?.get('--accent-2'),
      });
    }
  });
});

describe('SettingsPage › Synchronisation (R-SYN-34, R-SYN-30)', () => {
  it('connexion, envoi au serveur et refus : l’état du moteur de synchro', async () => {
    const sync = createFakeSyncEngine({ connection: 'offline', pending: 2 });
    await renderSettings({ sync });
    expect(infoValue('Connexion')).toBe('Hors ligne');
    expect(screen.getByTestId('pending-counter').textContent).toBe('2 en attente');
    expect(infoValue('Refus du serveur')).toBe('Aucun refus');
    expect(screen.queryByRole('link', { name: /Refus du serveur/ })).toBeNull();
    act(() => sync.set({ connection: 'online', pending: 0 }));
    expect(infoValue('Connexion')).toBe('En ligne');
    expect(screen.getByTestId('pending-counter').textContent).toBe('0 en attente');
  });

  it('refus : la ligne mène aux éléments refusés, « 1 refusé » puis « 2 refusés »', async () => {
    const sync = createFakeSyncEngine({ rejected: 1 });
    const view = await renderSettings({ sync });
    // Le nom dit l'action et reprend le libellé visible (WCAG 2.5.3, maquette C03) ; la valeur le décrit.
    const row = screen.getByRole('link', { name: REFUSED_LINK });
    expect(row.getAttribute('href')).toBe('/rejections');
    expect(row.textContent).toContain('Refus du serveur');
    expect(describedBy(row)).toBe('1 refusé');
    act(() => sync.set({ rejected: 2 }));
    expect(describedBy(screen.getByRole('link', { name: REFUSED_LINK }))).toBe('2 refusés');
    fireEvent.click(screen.getByRole('link', { name: REFUSED_LINK }));
    await screen.findByRole('heading', { level: 1, name: 'Éléments refusés' });
    expect(view.location()).toBe('/rejections');
    // Retour des refus vers les Réglages, d'où on vient.
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe('/settings');
  });

  it('maquette C03 : les lignes d’état en petit libellé sur leur valeur en gras, refus compris', async () => {
    await renderSettings({ sync: createFakeSyncEngine({ rejected: 1 }), persistGranted: true });
    for (const label of ['Connexion', 'Sans réseau', 'Envoi au serveur', 'Stockage persistant']) {
      const row = screen.getByText(label, { exact: true }).closest('[data-emphasis]');
      expect(row?.getAttribute('data-emphasis'), label).toBe('value');
    }
    expect(screen.getByRole('link', { name: REFUSED_LINK }).getAttribute('data-emphasis')).toBe('value');
  });

  it('sans réseau : « Prêt hors ligne » quand l’appareil l’est, sinon « Pas encore prêt hors ligne »', async () => {
    const db = createTestLocalDb();
    await renderSettings({ db });
    await until(() => infoValue('Sans réseau') === 'Pas encore prêt hors ligne');
    const ready = createTestLocalDb();
    await setMeta(ready, 'catalogVersion', 'cat-1');
    await setMeta(ready, 'serverCatalogVersion', 'cat-1');
    await setMeta(ready, 'lastPullOkAt', new Date(DEFAULT_NOW - 3_600_000).toISOString());
    cleanup();
    await renderSettings({ db: ready });
    await until(() => infoValue('Sans réseau') === 'Prêt hors ligne');
  });
});

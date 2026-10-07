// @vitest-environment node
import { makeOp } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { applyPulledRows } from '../../src/sync/apply-pull';
import { createFixtureLocalDb } from '../support/local-db';

const T = '2026-10-06T11:00:00.000Z';
const serverNote = (extra: Record<string, unknown> = {}) => ({
  id: 'n1',
  ownerId: 'u1',
  title: 'serveur',
  body: 'b',
  deletedAt: null,
  rev: 9,
  updatedAt: T,
  ...extra,
});
const local = (extra: Record<string, unknown> = {}) => ({
  id: 'n1',
  ownerId: 'u1',
  title: 'local',
  body: 'local',
  serverRevSeen: 3,
  deletedAt: null,
  updatedAt: '2026-10-06T10:00:00.000Z',
  ...extra,
});

let db: AppDb;
beforeEach(() => {
  db = createFixtureLocalDb();
});
afterEach(async () => {
  await db.delete();
});

describe('applyPulledRows', () => {
  it('ligne écrite avec serverRevSeen = rev', async () => {
    await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: serverNote() }]);
    expect(await db.mirror('fixture_note').get('n1')).toEqual({ ...serverNote(), serverRevSeen: 9 });
  });

  it('rebase R-SYN-22 : patch local en attente rejoué sur la ligne serveur', async () => {
    await db.mirror('fixture_note').put(local());
    await db.outbox.add(
      makeOp({ userId: 'u1', entity: 'fixture_note', id: 'n1', kind: 'patch', fields: { body: 'local' } }),
    );
    await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: serverNote() }]);
    expect(await db.mirror('fixture_note').get('n1')).toMatchObject({
      title: 'serveur',
      body: 'local',
      serverRevSeen: 9,
    });
  });

  it('patchs rejoués dans l’ordre des opId', async () => {
    await db.mirror('fixture_note').put(local());
    const first = makeOp({
      userId: 'u1',
      entity: 'fixture_note',
      id: 'n1',
      kind: 'patch',
      fields: { body: 'a' },
    });
    const second = makeOp({
      userId: 'u1',
      entity: 'fixture_note',
      id: 'n1',
      kind: 'patch',
      fields: { body: 'z' },
    });
    await db.outbox.bulkAdd([second, first]);
    await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: serverNote() }]);
    expect((await db.mirror('fixture_note').get('n1'))?.body).toBe('z');
  });

  it('delete en attente → deletedAt gardé', async () => {
    await db.mirror('fixture_note').put(local({ deletedAt: '2026-10-06T10:30:00.000Z' }));
    const del = makeOp({ userId: 'u1', entity: 'fixture_note', id: 'n1', kind: 'delete' });
    await db.outbox.add(del);
    await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: serverNote() }]);
    expect((await db.mirror('fixture_note').get('n1'))?.deletedAt).toBe(del.clientTs);
  });

  it('create en attente sur une ligne reçue → ignoré', async () => {
    await db.mirror('fixture_note').put(local({ serverRevSeen: null }));
    await db.outbox.add(
      makeOp({ userId: 'u1', entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 'local' } }),
    );
    await applyPulledRows(db, [{ entity: 'fixture_note', rev: 9, row: serverNote() }]);
    expect(await db.mirror('fixture_note').get('n1')).toMatchObject({ title: 'serveur', serverRevSeen: 9 });
  });

  it('tombstone serveur sans contenu remplace la copie', async () => {
    await db.mirror('fixture_c2_log').put({
      id: 'c1',
      ownerId: 'u1',
      value: 7,
      serverRevSeen: 2,
      deletedAt: null,
    });
    const tomb = { id: 'c1', ownerId: 'u1', deletedAt: T, rev: 9, updatedAt: T };
    await applyPulledRows(db, [{ entity: 'fixture_c2_log', rev: 9, row: tomb }]);
    expect(await db.mirror('fixture_c2_log').get('c1')).toEqual({ ...tomb, serverRevSeen: 9 });
  });

  it('entité sans miroir ignorée', async () => {
    await applyPulledRows(db, [
      { entity: 'inconnue', rev: 4, row: { id: 'x' } },
      { entity: 'fixture_note', rev: 9, row: serverNote() },
    ]);
    expect(await db.mirror('fixture_note').count()).toBe(1);
  });
});

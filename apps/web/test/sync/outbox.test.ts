import { SYNC_FIXTURE_RULES, seqIds } from '@appsport/server/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '../../src/local-db/db';
import { HealthConsentRequiredError, pendingCount, writeLocal } from '../../src/sync/outbox';
import { createFixtureLocalDb } from '../support/local-db';

const NOW = '2026-10-06T10:00:00.000Z';
const LATER = '2026-10-06T11:00:00.000Z';

let db: AppDb;
let ctx: Parameters<typeof writeLocal>[2];

beforeEach(() => {
  db = createFixtureLocalDb();
  const ids = seqIds(25);
  ctx = {
    userId: 'u1',
    now: () => NOW,
    newOpId: ids.uuidv7,
    healthConsentActive: true,
    rules: SYNC_FIXTURE_RULES,
  };
});
afterEach(async () => {
  await db.delete();
});

const createNote = () =>
  writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't' } }, ctx);

describe('writeLocal', () => {
  it('écrit la ligne miroir et l’op dans l’outbox', async () => {
    const op = await createNote();
    expect(await db.mirror('fixture_note').get('n1')).toEqual({
      id: 'n1',
      ownerId: 'u1',
      title: 't',
      serverRevSeen: null,
      deletedAt: null,
      updatedAt: NOW,
    });
    expect(await db.outbox.get(op.opId)).toEqual({
      ...op,
      userId: 'u1',
      protocol: 1,
      attempts: 0,
      clientTs: NOW,
    });
    expect(op).toMatchObject({ entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't' } });
  });

  it('opId en double : ni ligne ni op (une seule transaction)', async () => {
    const op = await createNote();
    const dup = { ...ctx, newOpId: () => op.opId };
    await expect(
      writeLocal(db, { entity: 'fixture_note', id: 'n2', kind: 'create', fields: { title: 'u' } }, dup),
    ).rejects.toThrow();
    expect(await db.mirror('fixture_note').get('n2')).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
  });

  it('opId invalide : exception, rien d’écrit', async () => {
    await expect(
      writeLocal(
        db,
        { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't' } },
        {
          ...ctx,
          newOpId: () => 'pas-un-uuid',
        },
      ),
    ).rejects.toThrow();
    expect(await db.mirror('fixture_note').count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('refuse un champ hors clientWritable et une entité non J', async () => {
    await expect(
      writeLocal(
        db,
        { entity: 'fixture_note', id: 'n1', kind: 'create', fields: { title: 't', ownerId: 'x' } },
        ctx,
      ),
    ).rejects.toThrow('field_not_writable:ownerId');
    await expect(
      writeLocal(
        db,
        { entity: 'training_profile', id: 'u1', kind: 'patch', fields: { goal: 'muscle' } },
        ctx,
      ),
    ).rejects.toThrow('entity_not_journal');
    await expect(
      writeLocal(db, { entity: 'nope', id: 'x', kind: 'create', fields: {} }, ctx),
    ).rejects.toThrow('entity_not_journal');
    expect(await db.outbox.count()).toBe(0);
    expect(await db.mirror('fixture_note').count()).toBe(0);
  });

  it('sans consentement : champs et valeurs C2 retirés, table C2 refusée', async () => {
    const noConsent = { ...ctx, healthConsentActive: false };
    const op = await writeLocal(
      db,
      {
        entity: 'fixture_note_item',
        id: 'i1',
        kind: 'create',
        fields: { noteId: 'n1', label: 'x', painNote: 'TEMOIN', reason: 'pain' },
      },
      noConsent,
    );
    expect(op.fields).toEqual({ noteId: 'n1', label: 'x' });
    const row = await db.mirror('fixture_note_item').get('i1');
    expect(row).not.toHaveProperty('painNote');
    expect(row).not.toHaveProperty('reason');

    const kept = await writeLocal(
      db,
      {
        entity: 'fixture_note_item',
        id: 'i2',
        kind: 'create',
        fields: { noteId: 'n1', label: 'y', reason: 'fatigue' },
      },
      noConsent,
    );
    expect(kept.fields).toEqual({ noteId: 'n1', label: 'y', reason: 'fatigue' });
    expect(await db.mirror('fixture_note_item').get('i2')).toMatchObject({ reason: 'fatigue' });

    await expect(
      writeLocal(db, { entity: 'fixture_c2_log', id: 'c1', kind: 'create', fields: { value: 3 } }, noConsent),
    ).rejects.toBeInstanceOf(HealthConsentRequiredError);
    expect(await db.mirror('fixture_c2_log').count()).toBe(0);
    expect(await db.outbox.count()).toBe(2);
  });

  it('avec consentement : champs C2 gardés', async () => {
    const op = await writeLocal(
      db,
      {
        entity: 'fixture_note_item',
        id: 'i1',
        kind: 'create',
        fields: { noteId: 'n1', label: 'x', painNote: 'p' },
      },
      ctx,
    );
    expect(op.fields).toEqual({ noteId: 'n1', label: 'x', painNote: 'p' });
  });

  it('patch fusionne, delete pose deletedAt ; les deux posent updatedAt', async () => {
    await createNote();
    const later = { ...ctx, now: () => LATER };
    await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'patch', fields: { body: 'b' } }, later);
    expect(await db.mirror('fixture_note').get('n1')).toEqual({
      id: 'n1',
      ownerId: 'u1',
      title: 't',
      body: 'b',
      serverRevSeen: null,
      deletedAt: null,
      updatedAt: LATER,
    });
    const end = '2026-10-06T12:00:00.000Z';
    const del = await writeLocal(
      db,
      { entity: 'fixture_note', id: 'n1', kind: 'delete', fields: {} },
      {
        ...ctx,
        now: () => end,
      },
    );
    expect(del.kind).toBe('delete');
    expect(await db.mirror('fixture_note').get('n1')).toMatchObject({
      deletedAt: end,
      updatedAt: end,
      body: 'b',
    });
    expect(await db.outbox.count()).toBe(3);
  });

  it('patch d’une ligne absente : row_missing, rien d’écrit', async () => {
    await expect(
      writeLocal(db, { entity: 'fixture_note', id: 'n9', kind: 'patch', fields: { body: 'b' } }, ctx),
    ).rejects.toThrow('row_missing');
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('pendingCount', () => {
  it('compte les ops par utilisateur', async () => {
    await createNote();
    await writeLocal(db, { entity: 'fixture_note', id: 'n1', kind: 'patch', fields: { body: 'b' } }, ctx);
    await writeLocal(
      db,
      { entity: 'fixture_note', id: 'n2', kind: 'create', fields: { title: 'v' } },
      {
        ...ctx,
        userId: 'u2',
      },
    );
    expect(await pendingCount(db, 'u1')).toBe(2);
    expect(await pendingCount(db, 'u2')).toBe(1);
    expect(await pendingCount(db, 'u3')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  APPLIED_OP_TTL_MONTHS,
  COACH_FLUSH_MS,
  decodeWatermark,
  EPOCH_RESEND_DAYS,
  encodeWatermark,
  PushEnvelope,
  PushRequest,
  SYNC_DEBOUNCE_MS,
  SYNC_INTERVAL_MS,
  SYNC_PULL_LIMIT,
  SYNC_PUSH_MAX,
  SYNC_RETRY_MAX_MS,
  SYNC_RETRY_MIN_MS,
  SYNC_TIMEOUT_MS,
  SyncOp,
  TOMBSTONE_TTL_DAYS,
  UuidV7,
} from '../src/sync';

const op = {
  opId: '0199b9a0-0000-7000-8000-000000000001',
  userId: '0199b9a0-0000-7000-8000-0000000000aa',
  entity: 'fixture_note',
  id: '0199b9a0-0000-7000-8000-000000000002',
  kind: 'create',
  fields: { title: 'n' },
  clientTs: '2026-10-06T10:00:00.000Z',
  protocol: 1,
  attempts: 0,
};

describe('SyncOp', () => {
  it('accepte une op complète, avec ou sans serverRevSeen', () => {
    expect(SyncOp.safeParse(op).success).toBe(true);
    expect(SyncOp.safeParse({ ...op, serverRevSeen: null }).success).toBe(true);
    expect(SyncOp.safeParse({ ...op, serverRevSeen: 4 }).success).toBe(true);
  });

  it('refuse un kind inconnu et un opId qui n’est pas un UUIDv7', () => {
    expect(SyncOp.safeParse({ ...op, kind: 'upsert' }).success).toBe(false);
    expect(SyncOp.safeParse({ ...op, opId: 'not-a-uuid' }).success).toBe(false);
  });

  it('UuidV7 : minuscules et version 7 seulement', () => {
    expect(UuidV7.safeParse('017f22e2-79b0-7cc3-98c4-dc0c0c07398f').success).toBe(true);
    expect(UuidV7.safeParse('017F22E2-79B0-7CC3-98C4-DC0C0C07398F').success).toBe(false);
    expect(UuidV7.safeParse('017f22e2-79b0-4cc3-98c4-dc0c0c07398f').success).toBe(false);
  });
});

describe('PushRequest et PushEnvelope', () => {
  const ops = (n: number) => Array.from({ length: n }, () => op);

  it('200 ops acceptées, 201 refusées', () => {
    expect(PushRequest.safeParse({ ops: ops(200) }).success).toBe(true);
    expect(PushRequest.safeParse({ ops: ops(201) }).success).toBe(false);
    expect(PushEnvelope.safeParse({ ops: ops(200) }).success).toBe(true);
    expect(PushEnvelope.safeParse({ ops: ops(201) }).success).toBe(false);
  });

  it("l'enveloppe laisse passer une op invalide pourvu qu'elle ait un opId", () => {
    expect(PushEnvelope.safeParse({ ops: [{ opId: 'x', kind: 'upsert' }] }).success).toBe(true);
    expect(PushEnvelope.safeParse({ ops: [{ kind: 'create' }] }).success).toBe(false);
  });
});

describe('watermark', () => {
  it('encode et décode', () => {
    expect(encodeWatermark('0199b9a0-0000-7000-8000-0000000000e1', 42)).toBe(
      '0199b9a0-0000-7000-8000-0000000000e1:42',
    );
    expect(decodeWatermark('0199b9a0-0000-7000-8000-0000000000e1:42')).toEqual({
      epoch: '0199b9a0-0000-7000-8000-0000000000e1',
      rev: 42,
    });
    expect(decodeWatermark('e:0')).toEqual({ epoch: 'e', rev: 0 });
  });

  it('refuse les formes invalides', () => {
    for (const bad of ['abc', ':3', 'e:-1', 'e:1.5', 'e:', '']) expect(decodeWatermark(bad)).toBeNull();
  });
});

describe('constantes de synchro', () => {
  it('valeurs figées', () => {
    expect([
      SYNC_PUSH_MAX,
      SYNC_PULL_LIMIT,
      SYNC_TIMEOUT_MS,
      EPOCH_RESEND_DAYS,
      TOMBSTONE_TTL_DAYS,
      APPLIED_OP_TTL_MONTHS,
    ]).toEqual([200, 500, 4000, 60, 90, 12]);
    expect([
      SYNC_RETRY_MIN_MS,
      SYNC_RETRY_MAX_MS,
      SYNC_INTERVAL_MS,
      SYNC_DEBOUNCE_MS,
      COACH_FLUSH_MS,
    ]).toEqual([2000, 300000, 60000, 2000, 4000]);
  });
});

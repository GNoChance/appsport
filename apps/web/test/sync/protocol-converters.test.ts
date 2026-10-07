import { SYNC_PROTOCOL } from '@appsport/contracts';
import { makeOp } from '@appsport/server/testing';
import { describe, expect, it } from 'vitest';
import { convertOutboxOp, OUTBOX_CONVERTERS } from '../../src/sync/protocol-converters';

const opV1 = makeOp({ userId: 'u1', entity: 'sync_rejection', id: 'r1', kind: 'patch', protocol: 1 });

describe('convertOutboxOp', () => {
  it('a un maillon pour chaque protocole antérieur', () => {
    for (let p = 1; p < SYNC_PROTOCOL; p++) expect(OUTBOX_CONVERTERS[p], `v${p}`).toBeTypeOf('function');
  });

  it('amène une op v1 au protocole courant', () => {
    expect(convertOutboxOp(opV1).protocol).toBe(SYNC_PROTOCOL);
    expect(convertOutboxOp(opV1, 1)).toEqual(opV1);
  });

  it('lève si un maillon manque', () => {
    expect(() => convertOutboxOp(opV1, 3)).toThrow(/v2/);
    expect(() => convertOutboxOp(opV1, 3)).toThrow('outbox converter missing: v1 → v2');
  });
});

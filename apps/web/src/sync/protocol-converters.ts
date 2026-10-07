import { SYNC_PROTOCOL } from '@appsport/contracts';
import type { OutboxOp } from '../local-db/db';

/** Maillon p → p + 1 d'une op restée dans l'outbox (R-VER-4) ; aucun en v1. */
export const OUTBOX_CONVERTERS: Readonly<Record<number, (op: OutboxOp) => OutboxOp>> = {};

/** Amène une op de l'outbox au protocole `target`, maillon par maillon. */
export function convertOutboxOp(op: OutboxOp, target: number = SYNC_PROTOCOL): OutboxOp {
  let current = op;
  while (current.protocol < target) {
    const from = current.protocol;
    const convert = Object.hasOwn(OUTBOX_CONVERTERS, from) ? OUTBOX_CONVERTERS[from] : undefined;
    if (!convert) throw new Error(`outbox converter missing: v${from} → v${from + 1}`);
    current = { ...convert(current), protocol: from + 1 };
  }
  return current;
}

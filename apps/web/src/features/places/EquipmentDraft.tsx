import type { EquipmentCode } from '@rune/contracts';
import { useCallback, useRef, useState } from 'react';
import { Banner, Button, plural } from '../../ui';
import { sortEquipment } from './EquipmentChecklist';
import styles from './places.module.css';

export interface EquipmentChanges {
  added: EquipmentCode[];
  removed: EquipmentCode[];
}

export interface EquipmentDraft {
  /** Matériel affiché : le brouillon s'il y en a un, sinon l'état reçu. */
  selected: ReadonlySet<EquipmentCode>;
  toggle(code: EquipmentCode): void;
  /** Écart entre le brouillon et l'état reçu, dans l'ordre de la taxonomie. */
  changes: EquipmentChanges;
  /** Abandonne le brouillon : l'état reçu s'affiche de nouveau. */
  reset(): void;
  /** Envoie chaque ajout puis chaque retrait ; s'arrête au premier échec, qu'il relance. */
  save(): Promise<void>;
}

const keyOf = (codes: Iterable<EquipmentCode>) => sortEquipment(codes).join(' ');

/**
 * Matériel en brouillon (spec refonte §10.3) : rien ne part avant `save()`. `initial` est l'état du serveur
 * (ou du miroir), `send` l'appel d'ajout (`true`) ou de retrait (`false`) d'un code.
 * - Le brouillon vit dans l'écran : le quitter l'abandonne, l'état reçu revient au retour.
 * - `initial` relu (après un enregistrement, réussi ou non) : un brouillon devenu égal à l'état relu s'efface ;
 *   sinon il reste, et ses changements se comptent contre l'état relu (ce qui est passé ne compte plus).
 *   L'appelant relit donc toujours l'état après `save()`, que l'envoi réussisse ou échoue.
 */
export function useEquipmentDraft(
  initial: ReadonlySet<EquipmentCode>,
  send: (code: EquipmentCode, present: boolean) => Promise<void>,
): EquipmentDraft {
  const [draft, setDraft] = useState<ReadonlySet<EquipmentCode> | null>(null);
  const initialKey = keyOf(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  // État reçu changé : posé pendant le rendu, React rend aussitôt de nouveau avec lui.
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    if (draft !== null && keyOf(draft) === initialKey) setDraft(null);
  }
  const selected = draft ?? initial;
  const changes: EquipmentChanges = {
    added: sortEquipment([...selected].filter((code) => !initial.has(code))),
    removed: sortEquipment([...initial].filter((code) => !selected.has(code))),
  };
  const latest = useRef({ initial, initialKey, changes, send });
  latest.current = { initial, initialKey, changes, send };

  const toggle = useCallback((code: EquipmentCode) => {
    setDraft((current) => {
      const next = new Set(current ?? latest.current.initial);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return keyOf(next) === latest.current.initialKey ? null : next;
    });
  }, []);

  const reset = useCallback(() => setDraft(null), []);

  const save = useCallback(async () => {
    const { changes: pending, send: write } = latest.current;
    for (const code of pending.added) await write(code, true);
    for (const code of pending.removed) await write(code, false);
  }, []);

  return { selected, toggle, changes, reset, save };
}

/** « 2 changements » et « 1 ajout, 1 retrait » (la partie nulle est tue). */
export function changeSummary(changes: EquipmentChanges): { total: string; detail: string } {
  const added = changes.added.length;
  const removed = changes.removed.length;
  const count = added + removed;
  const detail = [
    added > 0 ? `${added} ${plural(added, 'ajout', 'ajouts')}` : null,
    removed > 0 ? `${removed} ${plural(removed, 'retrait', 'retraits')}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return { total: `${count} ${plural(count, 'changement', 'changements')}`, detail };
}

/**
 * Barre des changements (maquette D03) : le nombre de changements, « Annuler » et « Enregistrer », collée au
 * bas de l'écran au-dessus de la barre d'onglets. Absente tant que le brouillon ne change rien.
 */
export function DraftBar(p: {
  changes: EquipmentChanges;
  pending: boolean;
  error: string | null;
  onCancel(): void;
  onSave(): void;
}) {
  if (p.changes.added.length + p.changes.removed.length === 0) return null;
  const { total, detail } = changeSummary(p.changes);
  return (
    <section aria-label="Changements à enregistrer" className={styles.draftBar}>
      {p.error ? <Banner tone="error">{p.error}</Banner> : null}
      <p className={styles.draftSummary}>
        <span className={styles.draftDot} aria-hidden="true" />
        <span>
          <strong className={styles.draftTotal}>{total}</strong> · {detail}
        </span>
      </p>
      <div className={styles.draftActions}>
        <Button variant="secondary" onClick={p.onCancel} disabled={p.pending}>
          Annuler
        </Button>
        <Button onClick={p.onSave} disabled={p.pending}>
          Enregistrer
        </Button>
      </div>
    </section>
  );
}

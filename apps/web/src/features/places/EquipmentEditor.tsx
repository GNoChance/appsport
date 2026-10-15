import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_SHORT_LABELS,
  type EquipmentCategory,
  type EquipmentCode,
} from '@rune/contracts';
import { useId, useMemo, useState } from 'react';
import { useAction } from '../../ui';
import { Count, categoriesFor } from './EquipmentChips';
import { DraftBar, type EquipmentDraft, useEquipmentDraft } from './EquipmentDraft';
import { CheckIcon, ChevronIcon, PeopleIcon, PlusIcon } from './icons';
import styles from './places.module.css';
import { SubScreen } from './SubScreen';

/**
 * Écran Matériel d'un lieu (maquette D03) : les catégories se déplient (la première est ouverte), chaque
 * pastille coche ou décoche un matériel du brouillon, rien ne part avant « Enregistrer » (spec refonte
 * §10.3). Après l'envoi, l'état est toujours relu (`reread`) : réussi, l'écran se ferme sur la fiche à jour
 * (`onSaved`) ; en échec, le brouillon reste avec l'erreur, compté contre l'état relu. Retour l'abandonne.
 */
export function EquipmentEditor(p: {
  kind: 'gym' | 'home';
  placeName: string;
  initial: readonly EquipmentCode[];
  send(code: EquipmentCode, present: boolean): Promise<void>;
  reread(): Promise<void>;
  onSaved(): void;
  onBack(): void;
}) {
  const initial = useMemo(() => new Set(p.initial), [p.initial]);
  const draft = useEquipmentDraft(initial, p.send);
  const categories = categoriesFor(p.kind);
  const [open, setOpen] = useState<ReadonlySet<EquipmentCategory>>(() => new Set(categories.slice(0, 1)));
  const changedId = useId();
  const save = useAction(async () => {
    try {
      await draft.save();
    } catch (error) {
      await p.reread().catch(() => {});
      throw error;
    }
    await p.reread();
    p.onSaved();
  });

  function toggleCategory(category: EquipmentCategory) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <SubScreen title="Matériel" subtitle={p.placeName} onBack={p.onBack}>
      {p.kind === 'gym' ? (
        <div role="note" className={styles.note}>
          <PeopleIcon size={20} />
          <p>Fiche partagée avec le cercle : chaque changement apparaît dans son historique.</p>
        </div>
      ) : null}
      <span id={changedId} hidden>
        changement non enregistré
      </span>
      <div className={styles.editor}>
        {categories.map((category) => (
          <EditorCategory
            key={category}
            category={category}
            draft={draft}
            initial={initial}
            expanded={open.has(category)}
            disabled={save.pending}
            changedId={changedId}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>
      <DraftBar
        changes={draft.changes}
        pending={save.pending}
        error={save.error}
        onCancel={() => {
          save.reset();
          draft.reset();
        }}
        onSave={() => void save.run()}
      />
    </SubScreen>
  );
}

/**
 * Une catégorie : titre-bouton qui la déplie (compte coché sur le total, point violet tant qu'un changement
 * n'est pas enregistré), puis ses pastilles, de vraies cases à cocher.
 */
function EditorCategory(p: {
  category: EquipmentCategory;
  draft: EquipmentDraft;
  initial: ReadonlySet<EquipmentCode>;
  expanded: boolean;
  disabled: boolean;
  changedId: string;
  onToggle(): void;
}) {
  const panelId = useId();
  const label = EQUIPMENT_CATEGORY_LABELS[p.category];
  const codes = EQUIPMENT_CATEGORIES[p.category];
  const { selected } = p.draft;
  const count = codes.filter((code) => selected.has(code)).length;
  const changed = codes.some((code) => selected.has(code) !== p.initial.has(code));
  return (
    <div className={styles.editorCategory}>
      <h2 className={styles.editorHeading}>
        <button
          type="button"
          aria-expanded={p.expanded}
          aria-controls={panelId}
          className={styles.editorToggle}
          onClick={p.onToggle}
        >
          <span className={styles.editorChevron} aria-hidden="true">
            <ChevronIcon />
          </span>
          <span className={styles.editorLabel}>{label}</span>{' '}
          {changed ? (
            <>
              <span className={styles.draftDot} aria-hidden="true" />
              <span className={styles.srOnly}>changement non enregistré, </span>
            </>
          ) : null}
          <Count n={count} total={codes.length} />
        </button>
      </h2>
      <fieldset id={panelId} hidden={!p.expanded} className={styles.editorPanel}>
        <legend className={styles.srOnly}>{label}</legend>
        {codes.map((code) => {
          const checked = selected.has(code);
          const dirty = checked !== p.initial.has(code);
          return (
            <label key={code} className={styles.toggleChip} data-dirty={dirty ? '' : undefined}>
              <input
                type="checkbox"
                className={styles.toggleChipInput}
                checked={checked}
                disabled={p.disabled}
                aria-describedby={dirty ? p.changedId : undefined}
                onChange={() => p.draft.toggle(code)}
              />
              <span className={styles.toggleChipGlyph} aria-hidden="true">
                {checked ? <CheckIcon /> : <PlusIcon size={15} />}
              </span>
              {EQUIPMENT_SHORT_LABELS[code]}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

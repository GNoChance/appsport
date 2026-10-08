import {
  EQUIPMENT,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  type EquipmentCategory,
  type EquipmentCode,
} from '@appsport/contracts';
import styles from './places.module.css';

const CATEGORIES = Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[];

/** Codes dans l'ordre de la taxonomie (EQUIPMENT), sans doublon. */
export function sortEquipment(codes: Iterable<EquipmentCode>): EquipmentCode[] {
  const present = new Set(codes);
  return EQUIPMENT.filter((c) => present.has(c));
}

/** Matériel par catégorie ; les objets du quotidien ne s'affichent que pour une maison (R-EQ-3). */
export function EquipmentChecklist(p: {
  kind: 'gym' | 'home';
  value: readonly EquipmentCode[];
  onChange(next: EquipmentCode[]): void;
  disabled?: boolean;
}) {
  const categories = CATEGORIES.filter((c) => p.kind === 'home' || c !== 'household');
  const toggle = (code: EquipmentCode, present: boolean) =>
    p.onChange(sortEquipment(present ? [...p.value, code] : p.value.filter((c) => c !== code)));
  return (
    <div className={styles.checklist}>
      {categories.map((category) => (
        <fieldset key={category} className={styles.category}>
          <legend>{EQUIPMENT_CATEGORY_LABELS[category]}</legend>
          {EQUIPMENT_CATEGORIES[category].map((code) => (
            <label key={code} className={styles.item}>
              <input
                type="checkbox"
                checked={p.value.includes(code)}
                disabled={p.disabled}
                onChange={(e) => toggle(code, e.target.checked)}
              />
              {EQUIPMENT_LABELS[code]}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/** Matériel en lecture seule (salle sans droit de modifier, hors ligne, lieu de type salle). */
export function EquipmentList(p: { value: readonly EquipmentCode[] }) {
  if (p.value.length === 0) return <p className={styles.hint}>Aucun matériel renseigné.</p>;
  return (
    <ul className={styles.equipmentList}>
      {sortEquipment(p.value).map((code) => (
        <li key={code}>{EQUIPMENT_LABELS[code]}</li>
      ))}
    </ul>
  );
}

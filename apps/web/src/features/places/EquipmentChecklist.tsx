import {
  EQUIPMENT,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  type EquipmentCode,
} from '@rune/contracts';
import { categoriesFor } from './EquipmentChips';
import styles from './places.module.css';

/** Codes dans l'ordre de la taxonomie (EQUIPMENT), sans doublon. */
export function sortEquipment(codes: Iterable<EquipmentCode>): EquipmentCode[] {
  const present = new Set(codes);
  return EQUIPMENT.filter((c) => present.has(c));
}

/**
 * Matériel par catégorie, libellés entiers, pour créer un lieu (onboarding, ajout d'une salle ou d'une
 * maison) ; les objets du quotidien ne s'affichent que pour une maison (R-EQ-3).
 */
export function EquipmentChecklist(p: {
  kind: 'gym' | 'home';
  value: readonly EquipmentCode[];
  onChange(next: EquipmentCode[]): void;
}) {
  const categories = categoriesFor(p.kind);
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

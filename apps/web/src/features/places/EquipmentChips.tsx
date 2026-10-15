import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_SHORT_LABELS,
  type EquipmentCategory,
  type EquipmentCode,
} from '@rune/contracts';
import { useId } from 'react';
import styles from './places.module.css';

const ALL_CATEGORIES = Object.keys(EQUIPMENT_CATEGORIES) as EquipmentCategory[];

/** Catégories d'un lieu : les objets du quotidien ne vont qu'à une maison (R-EQ-3). */
export const categoriesFor = (kind: 'gym' | 'home') =>
  ALL_CATEGORIES.filter((c) => kind === 'home' || c !== 'household');

/** « 4/6 », lu « 4 sur 6 ». */
export function Count(p: { n: number; total: number }) {
  return (
    <span className={styles.count}>
      <span aria-hidden="true">
        <span className={styles.countValue}>{p.n}</span>/{p.total}
      </span>
      <span className={styles.srOnly}>
        {p.n} sur {p.total}
      </span>
    </span>
  );
}

/**
 * Matériel en lecture (maquettes D02 et D05) : par catégorie, des pastilles aux libellés courts qui défilent
 * de côté, avec le compte coché sur le total ; les catégories vides sont regroupées dessous, en une ligne
 * chacune.
 */
export function EquipmentChips(p: { kind: 'gym' | 'home'; value: readonly EquipmentCode[] }) {
  if (p.value.length === 0) return <p className={styles.hint}>Aucun matériel renseigné.</p>;
  const present = new Set(p.value);
  const categories = categoriesFor(p.kind);
  const filled = categories.filter((c) => EQUIPMENT_CATEGORIES[c].some((code) => present.has(code)));
  const empty = categories.filter((c) => !filled.includes(c));
  return (
    <div className={styles.chipGroups}>
      {filled.map((category) => (
        <ChipRow key={category} category={category} present={present} />
      ))}
      {empty.length > 0 ? (
        <ul aria-label="Catégories sans matériel coché" className={styles.emptyCategories}>
          {empty.map((category) => (
            <li key={category}>
              <span>{EQUIPMENT_CATEGORY_LABELS[category]}</span>
              <Count n={0} total={EQUIPMENT_CATEGORIES[category].length} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChipRow(p: { category: EquipmentCategory; present: ReadonlySet<EquipmentCode> }) {
  const titleId = useId();
  const all = EQUIPMENT_CATEGORIES[p.category];
  const codes = all.filter((code) => p.present.has(code));
  return (
    <div className={styles.chipGroup}>
      <div className={styles.chipGroupHead}>
        <h3 id={titleId} className={styles.chipGroupTitle}>
          {EQUIPMENT_CATEGORY_LABELS[p.category]}
        </h3>
        <Count n={codes.length} total={all.length} />
      </div>
      <div className={styles.chipScroller}>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: rangée qui défile de côté, atteignable au clavier */}
        <ul aria-labelledby={titleId} tabIndex={0} className={styles.chipRow}>
          {codes.map((code) => (
            <li key={code} className={styles.chip}>
              {EQUIPMENT_SHORT_LABELS[code]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

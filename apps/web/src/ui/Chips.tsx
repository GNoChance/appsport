import { CheckGlyph } from './ChoiceCard';
import styles from './ui.module.css';

/**
 * Pastilles pour les choix courts (2 / 3 / 4 séances, 45 min…) : des boutons radio sous une légende,
 * chacun dans son `<label>`, cibles de 44 px. La pastille choisie prend l'accent et porte une coche.
 * Comme pour `ChoiceList`, une option peut être désactivée et décrite (`describedBy` : id du texte qui
 * l'explique, par exemple la raison d'une option désactivée).
 */
export function Chips(p: {
  name: string;
  options: readonly { value: string; label: string; disabled?: boolean; describedBy?: string }[];
  value: string | null;
  onChange(v: string): void;
  legend: string;
}) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend className={styles.legend}>{p.legend}</legend>
      <div className={styles.chipList}>
        {p.options.map((o) => {
          const checked = p.value === o.value;
          return (
            <label key={o.value} className={styles.chip}>
              <input
                type="radio"
                name={p.name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                aria-describedby={o.describedBy}
                onChange={() => p.onChange(o.value)}
                className={styles.overlayInput}
              />
              {o.label}
              {checked ? (
                <span className={styles.chipCheck} aria-hidden="true">
                  <CheckGlyph />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

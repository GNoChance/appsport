import styles from './ui.module.css';

/** Groupe de boutons radio sous une légende. */
export function ChoiceList<T extends string | number>(p: {
  name: string;
  legend: string;
  value: T | null;
  onChange(v: T): void;
  options: readonly { value: T; label: string; disabled?: boolean }[];
}) {
  return (
    <fieldset className={styles.choices}>
      <legend>{p.legend}</legend>
      {p.options.map((o) => (
        <label key={String(o.value)} className={styles.choice}>
          <input
            type="radio"
            name={p.name}
            value={String(o.value)}
            checked={p.value === o.value}
            disabled={o.disabled}
            onChange={() => p.onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

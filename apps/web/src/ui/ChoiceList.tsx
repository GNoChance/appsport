import styles from './ui.module.css';

/**
 * Groupe de boutons radio sous une légende. `describedBy` d'une option : id du texte qui l'explique
 * (par exemple la raison d'une option désactivée), lu avec elle.
 */
export function ChoiceList<T extends string | number>(p: {
  name: string;
  legend: string;
  value: T | null;
  onChange(v: T): void;
  options: readonly { value: T; label: string; disabled?: boolean; describedBy?: string }[];
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
            aria-describedby={o.describedBy}
            onChange={() => p.onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

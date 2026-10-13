import { useId } from 'react';
import styles from './ui.module.css';

/**
 * Interrupteur : un vrai `<button role="switch">` (Espace et Entrée l'actionnent), `aria-checked`
 * suit l'état, le libellé le nomme et le toucher aussi, l'aide le décrit. `id` : celui du bouton.
 */
export function Switch(p: {
  id: string;
  label: string;
  checked: boolean;
  onChange(v: boolean): void;
  help?: string;
}) {
  const own = useId();
  const labelId = `${own}-label`;
  const helpId = `${own}-help`;
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <label id={labelId} htmlFor={p.id} className={styles.switchLabel}>
          {p.label}
        </label>
        {p.help ? (
          <span id={helpId} className={styles.hint}>
            {p.help}
          </span>
        ) : null}
      </span>
      <button
        id={p.id}
        type="button"
        role="switch"
        aria-checked={p.checked}
        aria-labelledby={labelId}
        aria-describedby={p.help ? helpId : undefined}
        className={styles.switch}
        onClick={() => p.onChange(!p.checked)}
      >
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchThumb} />
        </span>
      </button>
    </div>
  );
}

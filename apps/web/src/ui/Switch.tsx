import { useId } from 'react';
import styles from './ui.module.css';

/**
 * Interrupteur : un vrai `<button role="switch">` (Espace et Entrée l'actionnent), `aria-checked`
 * suit l'état, le libellé le nomme et le toucher aussi, l'aide le décrit. `id` : celui du bouton.
 * `disabled` : verrouillé (envoi en cours, état que l'API ne sait pas défaire) ; l'aide dit pourquoi.
 * `labelSuffix` : suite du nom lue par les lecteurs d'écran seulement, quand le libellé court affiché ne dit pas
 * à lui seul ce qu'il règle (« Visible » + « dans « Qui va à cette salle » », maquette D02).
 */
export function Switch(p: {
  id: string;
  label: string;
  labelSuffix?: string;
  checked: boolean;
  onChange(v: boolean): void;
  help?: string;
  disabled?: boolean;
}) {
  const own = useId();
  const labelId = `${own}-label`;
  const helpId = `${own}-help`;
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <label id={labelId} htmlFor={p.id} className={styles.switchLabel}>
          {p.label}
          {p.labelSuffix ? <span className={styles.visuallyHidden}> {p.labelSuffix}</span> : null}
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
        disabled={p.disabled}
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

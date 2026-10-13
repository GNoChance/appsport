import { cloneElement, type ReactElement, useId } from 'react';
import styles from './ui.module.css';

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };

function AlertGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.01" />
    </svg>
  );
}

/**
 * Champ libellé : libellé au-dessus, puis le contrôle enfant, qui reçoit l'`id` du libellé ; dessous,
 * l'erreur (avec une icône) puis l'aide, toutes deux en description du contrôle. `hint` : ancien nom de
 * `help`, gardé pour les écrans qui l'emploient.
 */
export function Field(p: {
  label: string;
  help?: string;
  hint?: string;
  error?: string | null;
  children: ReactElement;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const help = p.help ?? p.hint;
  const describedBy = [p.error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ');
  const control = cloneElement(p.children as ReactElement<ControlProps>, {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': p.error ? true : undefined,
  });
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {p.label}
      </label>
      {control}
      {p.error ? (
        <span id={errorId} className={styles.fieldError}>
          <AlertGlyph />
          {p.error}
        </span>
      ) : null}
      {help ? (
        <span id={helpId} className={styles.hint}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

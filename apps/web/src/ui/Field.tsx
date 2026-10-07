import { cloneElement, type ReactElement, useId } from 'react';
import styles from './ui.module.css';

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };

/** Champ libellé : le contrôle enfant reçoit l'`id` du libellé, l'aide et l'erreur en description. */
export function Field(p: { label: string; hint?: string; error?: string | null; children: ReactElement }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [p.hint ? hintId : null, p.error ? errorId : null].filter(Boolean).join(' ');
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
      {p.hint ? (
        <span id={hintId} className={styles.hint}>
          {p.hint}
        </span>
      ) : null}
      {p.error ? (
        <span id={errorId} className={styles.fieldError}>
          {p.error}
        </span>
      ) : null}
    </div>
  );
}

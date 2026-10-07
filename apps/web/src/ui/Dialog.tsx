import { type ReactNode, useEffect, useId, useRef } from 'react';
import styles from './ui.module.css';

/** Fenêtre modale nommée par son titre ; Échap la ferme ; le focus y entre à l'ouverture. */
export function Dialog(p: {
  open: boolean;
  title: string;
  onClose(): void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { open, onClose } = p;

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.dialog}
      >
        <h2 id={titleId}>{p.title}</h2>
        <div>{p.children}</div>
        <div className={styles.actions}>{p.actions}</div>
      </div>
    </div>
  );
}

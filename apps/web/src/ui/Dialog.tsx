import { type ReactNode, useEffect, useId, useRef } from 'react';
import styles from './ui.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab et Maj+Tab restent dans le dialogue : du dernier élément au premier et inversement, et un
 * focus sorti du dialogue y revient. Au milieu, le navigateur avance seul.
 */
function keepFocusInside(root: HTMLElement, e: KeyboardEvent): void {
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items.at(-1);
  const active = document.activeElement;
  let target: HTMLElement | undefined;
  if (!first || !last) target = root;
  else if (!root.contains(active)) target = e.shiftKey ? last : first;
  else if (e.shiftKey && (active === first || active === root)) target = last;
  else if (!e.shiftKey && active === last) target = first;
  if (!target) return;
  e.preventDefault();
  target.focus();
}

/**
 * Fenêtre modale nommée par son titre ; Échap la ferme ; le focus y entre à l'ouverture et n'en
 * sort pas au clavier.
 */
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
      else if (e.key === 'Tab' && ref.current) keepFocusInside(ref.current, e);
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

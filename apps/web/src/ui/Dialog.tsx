import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { inertOutside } from './inert-outside';
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
 * sort pas au clavier. `inertOutside` : le reste de la page est aussi inerte et caché aux lecteurs
 * d'écran tant qu'elle est ouverte (porte de réacceptation, retrait de l'accord santé). Sous un
 * dialogue inerte de la sorte, elle lui laisse le clavier. Plus haute que l'écran (téléphone en
 * paysage, texte agrandi), son contenu défile entre le titre et les actions, qui restent visibles.
 */
export function Dialog(p: {
  open: boolean;
  title: string;
  onClose(): void;
  actions: ReactNode;
  children: ReactNode;
  inertOutside?: boolean;
}) {
  const titleId = useId();
  const backdrop = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { open, onClose, inertOutside: strict = false } = p;

  // Avant les effets : à la fermeture, l'écran redevient atteignable avant que le focus y revienne.
  useLayoutEffect(() => {
    if (!open || !strict || !backdrop.current) return;
    return inertOutside(backdrop.current);
  }, [open, strict]);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current || ref.current.closest('[inert]')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Tab') keepFocusInside(ref.current, e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={backdrop} className={styles.backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.dialog}
      >
        <h2 id={titleId}>{p.title}</h2>
        <div className={styles.dialogBody}>{p.children}</div>
        <div className={styles.actions}>{p.actions}</div>
      </div>
    </div>
  );
}

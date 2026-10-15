import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Button } from './Button';
import { inertOutside } from './inert-outside';
import styles from './ui.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab et Maj+Tab restent dans la feuille : du dernier élément au premier et inversement, et un focus sorti
 * de la feuille y revient. Au milieu, le navigateur avance seul.
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
 * Feuille du bas (spec refonte §6, maquette C06) : poignée, fond assombri, titre, contenu, actions empilées
 * en pleine largeur. Sur un écran large, la même fenêtre se pose au centre, sans poignée.
 * - modale nommée par son titre ; le focus y entre à l'ouverture et n'en sort pas au clavier ; Échap ferme ;
 * - `describedBy` : id (ou ids séparés d'une espace) du texte qui la décrit, annoncé avec son nom à l'ouverture
 *   (un avertissement à entendre avant d'agir, maquette C06) ;
 * - le reste de la page est inerte et caché aux lecteurs d'écran tant qu'elle est ouverte (`inertOutside`, vrai par défaut),
 *   et redevient atteignable à la fermeture comme au démontage ;
 * - à la fermeture, le focus revient à l'élément qui l'avait à l'ouverture (le déclencheur), sauf si l'appelant
 *   l'a déjà posé ailleurs ; un champ du contenu qui prend le focus à l'ouverture (`autoFocus`) le garde ;
 * - la poignée est décorative : ni glisser ni toucher le voile ne ferment. Sans `actions`, la feuille porte son
 *   propre bouton « Fermer », pour qu'on puisse toujours la fermer au toucher (VoiceOver n'envoie pas Échap) ;
 *   `actions={null}` y renonce : l'appelant offre alors lui-même une sortie dans le contenu ;
 * - sous une autre feuille ouverte par-dessus (elle est alors inerte), elle lui laisse le clavier ;
 * - plus haute que l'écran (paysage, texte agrandi), son contenu défile entre le titre et les actions.
 */
export function BottomSheet(p: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Fond inerte et caché aux lecteurs d'écran tant qu'elle est ouverte ; vrai par défaut. */
  inertOutside?: boolean;
  describedBy?: string;
}) {
  const titleId = useId();
  const backdrop = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { open, inertOutside: strict = true } = p;
  // Déclencheur lu au rendu qui ouvre, avant que le contenu (autoFocus, refs, effets) ne prenne le focus.
  const trigger = useRef<HTMLElement | null>(null);
  const shown = useRef(false);
  if (open && !shown.current && typeof document !== 'undefined') {
    const active = document.activeElement;
    trigger.current = active instanceof HTMLElement && !ref.current?.contains(active) ? active : null;
  }
  useLayoutEffect(() => {
    shown.current = open;
  }, [open]);
  // Dernier onClose reçu : un appelant qui passe une fonction neuve à chaque rendu ne relance pas l'ouverture.
  const onClose = useRef(p.onClose);
  useLayoutEffect(() => {
    onClose.current = p.onClose;
  });
  const actions =
    p.actions === undefined ? (
      <Button variant="secondary" block onClick={() => onClose.current()}>
        Fermer
      </Button>
    ) : (
      p.actions
    );

  // Avant les effets : à la fermeture, l'écran redevient atteignable avant que le focus y revienne.
  useLayoutEffect(() => {
    if (!open || !strict || !backdrop.current) return;
    return inertOutside(backdrop.current);
  }, [open, strict]);

  useEffect(() => {
    if (!open) return;
    const sheet = ref.current;
    const opener = trigger.current;
    if (!sheet?.contains(document.activeElement)) sheet?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!sheet || sheet.closest('[inert]')) return;
      if (e.key === 'Escape') onClose.current();
      else if (e.key === 'Tab') keepFocusInside(sheet, e);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const active = document.activeElement;
      const lost = !active || active === document.body || (sheet?.contains(active) ?? false);
      if (lost && opener?.isConnected && opener !== sheet) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={backdrop} className={styles.backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={p.describedBy}
        tabIndex={-1}
        className={styles.sheet}
      >
        <span className={styles.sheetHandle} aria-hidden="true" data-sheet-handle="" />
        <h2 id={titleId}>{p.title}</h2>
        <div className={styles.sheetBody}>{p.children}</div>
        {actions ? <div className={styles.sheetActions}>{actions}</div> : null}
      </div>
    </div>
  );
}

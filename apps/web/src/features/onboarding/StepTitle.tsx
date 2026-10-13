import { createContext, type ReactNode, type RefObject, useCallback, useContext, useId } from 'react';

/**
 * Titre d'écran dans l'onboarding : `progressId` nomme le titre avec « Étape n/8 » ; `focusNext`
 * vaut vrai après un changement d'écran, et le prochain titre affiché prend alors le focus.
 */
export const StepTitleContext = createContext<{
  progressId: string;
  focusNext: RefObject<boolean>;
} | null>(null);

/**
 * Titre d'un écran (h2). Dans l'onboarding, il est nommé « Étape n/8 <titre> » et reçoit le focus
 * dès qu'il apparaît après un changement d'écran (lecteur d'écran et clavier repartent de là) ;
 * hors onboarding (Profil), simple titre.
 */
export function StepTitle(p: { children: ReactNode }) {
  const ctx = useContext(StepTitleContext);
  const id = useId();
  const focusOnMount = useCallback(
    (el: HTMLHeadingElement | null) => {
      if (!el || !ctx?.focusNext.current) return;
      ctx.focusNext.current = false;
      el.focus();
    },
    [ctx],
  );
  if (!ctx) return <h2>{p.children}</h2>;
  return (
    <h2 id={id} ref={focusOnMount} tabIndex={-1} aria-labelledby={`${ctx.progressId} ${id}`}>
      {p.children}
    </h2>
  );
}

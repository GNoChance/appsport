import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';

/**
 * Fenêtre modale nommée par son titre, rendue en feuille du bas sur téléphone et au centre sur un écran
 * large (BottomSheet) : Échap la ferme, le focus y entre à l'ouverture, n'en sort pas au clavier et revient
 * au déclencheur à la fermeture. Plus haute que l'écran, son contenu défile entre le titre et les actions,
 * qui restent visibles. Même API qu'avant la feuille du bas : `inertOutside` (porte de réacceptation, retrait
 * de l'accord santé) rend aussi le reste de la page inerte et caché aux lecteurs d'écran.
 */
export function Dialog(p: {
  open: boolean;
  title: string;
  onClose(): void;
  actions: ReactNode;
  children: ReactNode;
  inertOutside?: boolean;
}) {
  return (
    <BottomSheet
      open={p.open}
      title={p.title}
      onClose={p.onClose}
      actions={p.actions}
      inertOutside={p.inertOutside ?? false}
    >
      {p.children}
    </BottomSheet>
  );
}

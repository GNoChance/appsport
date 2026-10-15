import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Page } from '../../ui';
import styles from './places.module.css';

/**
 * Écran ouvert par-dessus une page des Salles (matériel, ajout d'une salle ou d'une maison) sans changer
 * d'adresse : son en-tête a un Retour (`onBack`) et un titre. Il entre par la droite (en fondu sous
 * mouvement réduit), repart en haut de page et donne le focus à son titre.
 */
export function SubScreen(p: { title: string; subtitle?: string; onBack(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const title = ref.current?.querySelector('h1');
    if (!title) return;
    title.tabIndex = -1;
    title.focus();
  }, []);
  return (
    <div ref={ref} className={styles.screenForward}>
      <Page title={p.title} back={p.onBack}>
        {p.subtitle ? <p className={styles.subtitle}>{p.subtitle}</p> : null}
        {p.children}
      </Page>
    </div>
  );
}

/**
 * Écran secondaire ouvert (`mode`) ou non (`null`). `open(mode, from)` : `from` est l'id du bouton qui
 * l'ouvre ; à la fermeture, il reprend le focus. `back` : la page revient d'un écran secondaire (elle
 * entre alors par la gauche).
 */
export function useSubScreen<M extends string>(): {
  mode: M | null;
  back: boolean;
  open(mode: M, from: string): void;
  close(): void;
} {
  const [mode, setMode] = useState<M | null>(null);
  const [back, setBack] = useState(false);
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== null || returnTo.current === null) return;
    document.getElementById(returnTo.current)?.focus();
    returnTo.current = null;
  }, [mode]);

  return {
    mode,
    back,
    open(next, from) {
      returnTo.current = from;
      setMode(next);
    },
    close() {
      setBack(true);
      setMode(null);
    },
  };
}

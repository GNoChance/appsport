import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Page } from '../../ui';
import styles from './places.module.css';

/** Envoi en cours ou non, par contenu de l'écran secondaire qui l'entoure ; null hors d'un écran secondaire. */
const BusyContext = createContext<Map<object, boolean> | null>(null);

/**
 * Un envoi part depuis le contenu d'un écran secondaire (création d'un lieu, d'une salle…) : tant que `busy`,
 * son Retour est sans effet. Hors d'un écran secondaire (onboarding), sans effet. L'état est posé au rendu : le
 * Retour voit celui que l'écran affiche (erreur montrée = envoi fini), sans attendre un effet.
 */
export function useSubScreenBusy(busy: boolean): void {
  const pending = useContext(BusyContext);
  const [key] = useState(() => ({}));
  pending?.set(key, busy);
  useEffect(() => {
    pending?.set(key, busy);
    return () => {
      pending?.delete(key);
    };
  }, [pending, key, busy]);
}

/**
 * Écran ouvert par-dessus une page des Salles (matériel, ajout d'une salle ou d'une maison) sans changer
 * d'adresse : son en-tête a un Retour (`onBack`) et un titre. Il entre par la droite (en fondu sous
 * mouvement réduit), repart en haut de page et donne le focus à son titre.
 * Retour est sans effet pendant un envoi (`busy`, ou `useSubScreenBusy` dans son contenu), comme la fermeture
 * d'une feuille du bas : l'envoi finit sous les yeux de l'utilisateur, son erreur s'affiche, le brouillon reste.
 */
export function SubScreen(p: {
  title: string;
  subtitle?: string;
  busy?: boolean;
  onBack(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending] = useState(() => new Map<object, boolean>());
  const busy = useRef(false);
  busy.current = p.busy === true;
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const title = ref.current?.querySelector('h1');
    if (!title) return;
    title.tabIndex = -1;
    title.focus();
  }, []);
  const { onBack } = p;
  const back = useCallback(() => {
    if (busy.current || [...pending.values()].some(Boolean)) return;
    onBack();
  }, [onBack, pending]);
  return (
    <div ref={ref} className={styles.screenForward}>
      <BusyContext.Provider value={pending}>
        <Page title={p.title} back={back}>
          {p.subtitle ? <p className={styles.subtitle}>{p.subtitle}</p> : null}
          {p.children}
        </Page>
      </BusyContext.Provider>
    </div>
  );
}

/**
 * Écran secondaire ouvert (`mode`) ou non (`null`). `open(mode, from)` : `from` est l'id du bouton qui
 * l'ouvre ; à la fermeture, il reprend le focus. `back` : la page revient d'un écran secondaire (elle
 * entre alors par la gauche). `close` ne vaut que pour l'écran ouvert au rendu qui l'a donné : venu d'un écran
 * déjà fermé (une action finie après son départ), il ne ferme pas celui ouvert depuis.
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
  /** Ouvertures et fermetures : chaque rendu lie son `close` à l'écran ouvert à ce moment-là. */
  const visits = useRef(0);
  const visit = visits.current;

  useEffect(() => {
    if (mode !== null || returnTo.current === null) return;
    document.getElementById(returnTo.current)?.focus();
    returnTo.current = null;
  }, [mode]);

  return {
    mode,
    back,
    open(next, from) {
      visits.current += 1;
      returnTo.current = from;
      setMode(next);
    },
    close() {
      if (visits.current !== visit) return;
      visits.current += 1;
      setBack(true);
      setMode(null);
    },
  };
}

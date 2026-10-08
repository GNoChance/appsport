import type { ApiErrorCode } from '@appsport/contracts';
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../../api/client';
import { Banner, Button, Dialog, errorMessage } from '../../ui';
import { loginErrorMessage } from '../auth/messages';
import styles from './admin.module.css';

type Overrides = Partial<Record<ApiErrorCode, string>>;

/** Mot de passe de l'admin ressaisi pour une action sensible (P-AUT-5) et refusé. */
export const WRONG_PASSWORD_MESSAGE = 'Mot de passe incorrect.';

/** Code d'invitation ou de réinitialisation : affiché une seule fois, jamais gardé (R-INV-3, R-RST-1). */
export const SECRET_SHOWN_ONCE = 'Ce code ne sera plus affiché.';

/**
 * Message d'une action d'administration : surcharges de l'écran, puis message commun ;
 * `rate_limited` (ressaisie du mot de passe, R-AUTH-2) annonce l'attente en minutes.
 */
export function adminErrorMessage(e: unknown, overrides?: Overrides): string {
  if (e instanceof ApiError && e.code === 'rate_limited') return loginErrorMessage(e);
  return errorMessage(e, overrides);
}

/**
 * Données lues en ligne (classe E) : la dernière lecture lancée l'emporte ; un échec garde les
 * données déjà affichées. `load` doit être stable (`useCallback`) : la lecture repart quand il change.
 */
export function useServerData<T>(load: () => Promise<T>): {
  data: T | null;
  error: string | null;
  reload(): Promise<void>;
} {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    try {
      const data = await load();
      if (id === latest.current) setState({ data, error: null });
    } catch (e) {
      if (id === latest.current) setState((s) => ({ data: s.data, error: errorMessage(e) }));
    }
  }, [load]);

  useEffect(() => {
    void reload();
    return () => {
      // Démontage ou nouvelle lecture : une réponse en retard est ignorée.
      latest.current += 1;
    };
  }, [reload]);

  return { ...state, reload };
}

/** Lecture impossible (hors ligne : « Nécessite le réseau ») et « Réessayer ». */
export function LoadFailure(p: { message: string; onRetry(): void }) {
  return (
    <div className={styles.failure}>
      <Banner tone="error">{p.message}</Banner>
      <Button variant="secondary" onClick={p.onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

/**
 * À la fermeture d'un dialogue, rend le focus à l'élément qui l'avait à l'ouverture ; s'il a
 * disparu (ligne supprimée), à `fallback`.
 */
export function useRestoreFocus(fallback?: RefObject<HTMLElement | null>): void {
  const [trigger] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(
    () => () => {
      if (trigger?.isConnected) trigger.focus();
      else fallback?.current?.focus();
    },
    [trigger, fallback],
  );
}

/**
 * Dialogue de confirmation d'une action d'administration (en ligne seulement). Le bouton de
 * confirmation soumet le formulaire du dialogue (Entrée dans un champ aussi) ; `validate` faux :
 * saisie à corriger, signalée par l'écran, rien ne part. Pendant l'envoi, ni « Annuler » ni Échap
 * ne ferment. Échec : message dans le dialogue, qui reste ouvert. Réussite : `onConfirm` a fini
 * (liste relue comprise), le dialogue se ferme. Monté seulement ouvert : chaque ouverture repart vide.
 */
export function ActionDialog(p: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  canConfirm?: boolean;
  overrides?: Overrides;
  fallbackFocus?: RefObject<HTMLElement | null>;
  validate?(): boolean;
  onConfirm(): Promise<void>;
  onClose(): void;
  children?: ReactNode;
}) {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  useRestoreFocus(p.fallbackFocus);
  const ready = p.canConfirm ?? true;

  // Référence stable : le dialogue ne reprend pas le focus à chaque rendu du parent.
  const close = useCallback(() => {
    if (!busy.current) onClose.current();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current || !ready || p.validate?.() === false) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await p.onConfirm();
    } catch (err) {
      setError(adminErrorMessage(err, p.overrides));
      return;
    } finally {
      busy.current = false;
      setPending(false);
    }
    close();
  }

  return (
    <Dialog
      open
      title={p.title}
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={p.danger ? 'danger' : 'primary'}
            disabled={pending || !ready}
          >
            {p.confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} noValidate onSubmit={(e) => void submit(e)}>
        {p.children}
        {error ? <Banner tone="error">{error}</Banner> : null}
      </form>
    </Dialog>
  );
}

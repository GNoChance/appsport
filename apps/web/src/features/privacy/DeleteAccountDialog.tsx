import { type FormEvent, useCallback, useId, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useRepos } from '../../repos';
import { Banner, Button, Dialog, Field } from '../../ui';
import { useRestoreFocus } from '../admin/admin-ui';
import { ExportButton } from './ExportButton';
import { ANTHROPIC_RETENTION_TEXT, DELETE_LIST_TEXT, passwordActionError } from './messages';
import styles from './privacy.module.css';

type DeleteProps = { open: boolean; onClose(): void };

/**
 * Suppression du compte par l'utilisateur (R-SUP-1, P-DRT-3) : export proposé, liste de ce qui sera
 * supprimé, mention Anthropic (P-DRT-6), mot de passe, « Supprimer définitivement ». Réussite : base
 * locale effacée, file comprise (R-SUP-5), puis écran de connexion « Ce compte a été supprimé ».
 * Le dernier administrateur est refusé par le serveur (R-SUP-4) et rien n'est effacé.
 */
export function DeleteAccountDialog(p: DeleteProps) {
  return p.open ? <OpenDeleteDialog {...p} /> : null;
}

function OpenDeleteDialog(p: DeleteProps) {
  const repos = useRepos();
  const [, navigate] = useLocation();
  const formId = useId();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  useRestoreFocus();

  // Référence stable : le dialogue ne reprend pas le focus (champ du mot de passe) à chaque rendu.
  const close = useCallback(() => {
    if (!busy.current) onClose.current();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current || password === '') return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await repos.me.deleteAccount(password);
    } catch (err) {
      setError(passwordActionError(err));
      busy.current = false;
      setPending(false);
      return;
    }
    // Pendant la navigation, le dialogue ne se ferme plus : la page qui le porte disparaît.
    navigate('/login?reason=account_deleted', { replace: true });
  }

  return (
    <Dialog
      open
      title="Supprimer ton compte ?"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={pending || password === ''}>
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} noValidate onSubmit={(e) => void submit(e)}>
        <p>{DELETE_LIST_TEXT}</p>
        <p>{ANTHROPIC_RETENTION_TEXT}</p>
        <ExportButton label="Télécharger mes données d'abord" />
        <Field label="Mot de passe">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <Banner tone="error">{error}</Banner> : null}
      </form>
    </Dialog>
  );
}

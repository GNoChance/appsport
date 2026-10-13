import { type FormEvent, useCallback, useId, useRef, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, Dialog, Field } from '../../ui';
import { useRestoreFocus } from '../admin/admin-ui';
import { ExportButton } from './ExportButton';
import { passwordActionError, WITHDRAW_LIST_TEXT, WITHDRAWN_TEXT } from './messages';
import styles from './privacy.module.css';

type WithdrawProps = { open: boolean; onClose(): void; onWithdrawn?(): void };

/**
 * Retrait de l'accord santé (R-CST-5, P-CST-3) : export proposé, liste de ce qui sera effacé, mot
 * de passe ressaisi (P-AUT-5). Le serveur répond le nouveau profil (meta.me), puis les données de
 * santé locales sont purgées (`withdrawHealth`). Le dialogue reste ouvert sur le message de
 * réussite jusqu'à « Fermer ». Fermé, rien n'est monté : chaque ouverture repart vide. L'écran
 * derrière est inerte, comme sous la porte de réacceptation qui l'ouvre aussi.
 */
export function ConsentWithdrawDialog(p: WithdrawProps) {
  return p.open ? <OpenWithdrawDialog {...p} /> : null;
}

function OpenWithdrawDialog(p: WithdrawProps) {
  const repos = useRepos();
  const formId = useId();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const latest = useRef(p);
  latest.current = p;
  useRestoreFocus();

  // Référence stable : le dialogue ne reprend pas le focus (champ du mot de passe) à chaque rendu.
  const close = useCallback(() => {
    if (!busy.current) latest.current.onClose();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current || password === '') return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await repos.consent.withdrawHealth(password);
      setPassword('');
      setDone(true);
      latest.current.onWithdrawn?.();
    } catch (err) {
      setError(passwordActionError(err));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (done) {
    return (
      // Autre clé : le dialogue est remonté et reprend le focus (le bouton qui l'avait a disparu).
      <Dialog
        key="done"
        open
        inertOutside
        title="Retirer l'accord santé"
        onClose={close}
        actions={<Button onClick={close}>Fermer</Button>}
      >
        <Banner tone="info">{WITHDRAWN_TEXT}</Banner>
      </Dialog>
    );
  }

  return (
    <Dialog
      key="form"
      open
      inertOutside
      title="Retirer l'accord santé"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={pending || password === ''}>
            Retirer mon accord
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} noValidate onSubmit={(e) => void submit(e)}>
        <p>{WITHDRAW_LIST_TEXT}</p>
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

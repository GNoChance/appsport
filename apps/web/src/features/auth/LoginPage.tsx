import { usernameKey } from '@appsport/domain';
import { type FormEvent, useCallback, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, Dialog, ERROR_MESSAGES, Field, Page } from '../../ui';
import styles from './auth.module.css';
import { FORMER_ACCOUNT_NAME, loginErrorMessage, pendingWarning } from './messages';

/**
 * Connexion (R-AUTH-1) ; un autre pseudo que celui de l'appareil est averti avant l'effacement
 * (P-AUT-6). Une fois la session ouverte, la garde de l'appli mène à l'accueil : elle voit la
 * nouvelle session au même rendu que l'écran, sans détour par un état de connexion périmé.
 */
export function LoginPage() {
  const repos = useRepos();
  const search = useSearch();
  const { connection } = useSyncState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ pending: number; owner: string } | null>(null);

  const accountDeleted =
    new URLSearchParams(search).get('reason') === 'account_deleted' || connection === 'account_deleted';
  const sessionExpired = connection === 'unauthenticated';
  const closeWarning = useCallback(() => setWarning(null), []);

  /** `confirmed` : l'avertissement d'effacement a été accepté. */
  async function attempt(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (!confirmed) {
        const device = await repos.me.deviceOwner();
        if (device.pending > 0 && usernameKey(username) !== usernameKey(device.username ?? '')) {
          setWarning({ pending: device.pending, owner: device.username ?? FORMER_ACCOUNT_NAME });
          return;
        }
      }
      await repos.me.login({ username, password });
    } catch (e) {
      setError(loginErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) void attempt(false);
  };

  return (
    <Page title="Connexion">
      {accountDeleted ? (
        <Banner tone="warning">{ERROR_MESSAGES.account_deleted}</Banner>
      ) : sessionExpired ? (
        <Banner tone="warning">{ERROR_MESSAGES.unauthenticated}</Banner>
      ) : null}
      <form className={styles.form} noValidate onSubmit={submit}>
        <Field label="Pseudo">
          <input
            type="text"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Mot de passe">
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" disabled={busy}>
          Se connecter
        </Button>
      </form>
      <nav className={styles.links} aria-label="Autres accès">
        <Link href="/invite">J'ai un code d'invitation</Link>
        <Link href="/reset">J'ai un lien de réinitialisation</Link>
      </nav>
      <Dialog
        open={warning !== null}
        title="Données non envoyées"
        onClose={closeWarning}
        actions={
          <>
            <Button variant="secondary" onClick={closeWarning}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                closeWarning();
                void attempt(true);
              }}
            >
              Continuer
            </Button>
          </>
        }
      >
        <p>{warning ? pendingWarning(warning.pending, warning.owner) : null}</p>
      </Dialog>
    </Page>
  );
}

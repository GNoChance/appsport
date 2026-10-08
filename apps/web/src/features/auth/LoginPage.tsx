import { usernameKey } from '@appsport/domain';
import { type FormEvent, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useSyncState } from '../../app-services';
import { type DeviceOwner, useRepos } from '../../repos';
import { Banner, Button, ERROR_MESSAGES, Field, Page } from '../../ui';
import styles from './auth.module.css';
import { loginErrorMessage } from './messages';
import { useWipeWarning } from './WipeWarning';

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
  const wipe = useWipeWarning(() => void attempt(true));

  const accountDeleted =
    new URLSearchParams(search).get('reason') === 'account_deleted' || connection === 'account_deleted';
  const sessionExpired = connection === 'unauthenticated';

  /** `confirmed` : l'avertissement d'effacement a été accepté. */
  async function attempt(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const sameUser = (owner: DeviceOwner) =>
        owner.username !== null && usernameKey(username) === usernameKey(owner.username);
      if (!confirmed && (await wipe.warns(sameUser))) return;
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
      {wipe.dialog}
    </Page>
  );
}

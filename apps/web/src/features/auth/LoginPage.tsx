import { usernameKey } from '@rune/domain';
import { type FormEvent, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useSyncState } from '../../app-services';
import { type DeviceOwner, useRepos } from '../../repos';
import { Banner, Button, ERROR_MESSAGES, Field, SystemPanel } from '../../ui';
import { RuneMark, RuneWordmark } from '../../ui/Logo';
import { useColorScheme } from '../../ui/use-color-scheme';
import styles from './auth.module.css';
import { loginErrorMessage } from './messages';
import { useWipeWarning } from './WipeWarning';

function TicketIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v2.5" />
      <path d="M14 10.75v2.5" />
      <path d="M14 15.5V18" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.65-8.65" />
      <path d="m16.5 6.5 3 3" />
      <path d="m14 9 2 2" />
    </svg>
  );
}

/**
 * Marque de l'écran de connexion (maquette A01) : logo de 92 px, le mot RUNE et le slogan. Le logo nomme
 * l'appli ; le mot dessiné à côté n'est pas relu une seconde fois. Lueur du logo en sombre, cadre à l'accent
 * et rune à l'encre en clair.
 */
function LoginBrand() {
  const dark = useColorScheme() === 'dark';
  return (
    <div className={styles.brand}>
      <RuneMark size={92} glow={dark} title="Rune" />
      <p className={styles.wordmark} aria-hidden="true">
        <RuneWordmark />
      </p>
      <p className={styles.slogan}>Grave ta progression.</p>
    </div>
  );
}

/**
 * Connexion (R-AUTH-1) ; un autre pseudo que celui de l'appareil est averti avant l'effacement
 * (P-AUT-6). Une fois la session ouverte, la garde de l'appli mène à l'accueil : elle voit la
 * nouvelle session au même rendu que l'écran, sans détour par un état de connexion périmé.
 * Maquette A01 : la marque, puis la fenêtre du Système « Connexion » qui porte le formulaire, puis
 * les autres accès (invitation, réinitialisation).
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

  // Les blocs de l'écran entrent en cascade ; la feuille d'avertissement, à part, garde sa propre entrée.
  return (
    <>
      <div className={`stagger ${styles.login}`}>
        <LoginBrand />
        {accountDeleted ? (
          <Banner tone="warning">{ERROR_MESSAGES.account_deleted}</Banner>
        ) : sessionExpired ? (
          <Banner tone="warning">{ERROR_MESSAGES.unauthenticated}</Banner>
        ) : null}
        <SystemPanel title="Connexion" headingLevel={1}>
          <p>Identification requise.</p>
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
            <Button type="submit" disabled={busy} className={styles.submit}>
              Se connecter
            </Button>
          </form>
        </SystemPanel>
        <nav className={styles.links} aria-label="Autres accès">
          <Link href="/invite" className={styles.mainLink}>
            <TicketIcon />
            J'ai un code d'invitation
          </Link>
          <Link href="/reset" className={styles.quietLink}>
            <KeyIcon />
            J'ai un lien de réinitialisation
          </Link>
        </nav>
      </div>
      {wipe.dialog}
    </>
  );
}

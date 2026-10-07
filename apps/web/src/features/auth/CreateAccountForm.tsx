import { type MeResponse, PRIVACY_POLICY_VERSION, type Role } from '@appsport/contracts';
import { validateUsername } from '@appsport/domain';
import { type FormEvent, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, Field, formatDate } from '../../ui';
import styles from './auth.module.css';
import { accessErrorMessage, checkNewPassword, USERNAME_MESSAGES } from './messages';
import { PasswordFields } from './PasswordFields';

/**
 * Création du compte (02 §3.4). Tout est contrôlé ici avant l'envoi ; un refus du serveur garde le
 * formulaire (R-CPT-1 : l'invitation n'est pas consommée).
 */
export function CreateAccountForm(p: {
  code: string;
  birthDate: string;
  role: Role;
  onCreated(me: MeResponse): void;
}) {
  const repos = useRepos();
  const [username, setUsername] = useState('');
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !read) return;
    const name = validateUsername(username);
    const problem = name.ok
      ? checkNewPassword({ ...passwords, username, role: p.role })
      : USERNAME_MESSAGES[name.reason];
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await repos.me.acceptInvitation({
        code: p.code,
        username,
        password: passwords.password,
        termsVersion: PRIVACY_POLICY_VERSION,
      });
      p.onCreated(me);
    } catch (err) {
      setError(accessErrorMessage(err, p.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <Field label="Date de naissance" hint="Renseignée par l'administrateur. Une erreur ? Préviens-le.">
        <input type="text" readOnly value={formatDate(p.birthDate)} />
      </Field>
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
      <PasswordFields username={username} role={p.role} {...passwords} onChange={setPasswords} />
      <label className={styles.consent}>
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>
          J'ai lu la page{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Confidentialité et règles
          </a>
        </span>
      </label>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button type="submit" disabled={!read || busy}>
        Créer mon compte
      </Button>
    </form>
  );
}

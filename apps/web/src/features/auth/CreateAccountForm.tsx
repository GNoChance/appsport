import { type MeResponse, PRIVACY_POLICY_VERSION, type Role } from '@rune/contracts';
import { validateUsername } from '@rune/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, Field, formatDate } from '../../ui';
import styles from './auth.module.css';
import { isStandalone } from './install-help';
import {
  accessErrorMessage,
  checkNewPassword,
  type NewPasswordErrors,
  newPasswordErrors,
  USERNAME_MESSAGES,
} from './messages';
import { PasswordFields } from './PasswordFields';
import { useWipeWarning } from './WipeWarning';

type FieldErrors = NewPasswordErrors & { username?: string };

/**
 * Création du compte (02 §3.4). Tout est contrôlé ici avant l'envoi : un refus local est rattaché à son
 * champ (pseudo, mot de passe ou confirmation, maquette A03), qui prend le focus. Un refus du serveur
 * s'affiche en alerte et garde le formulaire (R-CPT-1 : l'invitation n'est pas consommée).
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wipe = useWipeWarning(() => void send(true));

  // Refus local : le champ en cause (marqué aria-invalid au rendu) prend le focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque refus local relance la recherche
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !read) return;
    const name = validateUsername(username);
    const errors: FieldErrors = name.ok
      ? newPasswordErrors(checkNewPassword({ ...passwords, username, role: p.role }))
      : { username: USERNAME_MESSAGES[name.reason] };
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }
    void send(false);
  }

  /** `confirmed` : l'effacement des éléments non envoyés de l'appareil a été accepté. */
  async function send(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      // Un nouveau compte n'est jamais le propriétaire des données déjà sur l'appareil.
      if (!confirmed && (await wipe.warns(() => false))) return;
      const me = await repos.me.acceptInvitation({
        code: p.code,
        username,
        password: passwords.password,
        termsVersion: PRIVACY_POLICY_VERSION,
      });
      // R-CPT-2 : stockage persistant demandé à la création, dans l'appli installée seulement.
      if (isStandalone()) void repos.status.requestPersistentStorage().catch(() => {});
      p.onCreated(me);
    } catch (err) {
      setError(accessErrorMessage(err, p.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form ref={formRef} className={styles.form} noValidate onSubmit={submit}>
        <Field label="Date de naissance" hint="Renseignée par l'administrateur. Une erreur ? Préviens-le.">
          <input type="text" readOnly value={formatDate(p.birthDate)} />
        </Field>
        <Field label="Pseudo" error={fieldErrors.username}>
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
        <PasswordFields
          username={username}
          role={p.role}
          {...passwords}
          onChange={setPasswords}
          errors={fieldErrors}
        />
        <label className={styles.consent}>
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
          <span>
            J'ai lu la page{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>
              Confidentialité et règles
            </a>
          </span>
        </label>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" disabled={!read || busy}>
          Créer mon compte
        </Button>
      </form>
      {wipe.dialog}
    </>
  );
}

import type { Role } from '@rune/contracts';
import { usernameKey } from '@rune/domain';
import { type FormEvent, useState } from 'react';
import { type DeviceOwner, useRepos } from '../../repos';
import { Banner, Button, Page } from '../../ui';
import styles from './auth.module.css';
import { CodeStep, useFragmentCode } from './CodeStep';
import {
  accessErrorMessage,
  accessFieldError,
  checkNewPassword,
  editedPasswordFields,
  type NewPasswordErrors,
  newPasswordErrors,
} from './messages';
import { PasswordFields } from './PasswordFields';
import { useFieldErrors } from './use-field-errors';
import { useSessionRedirect } from './use-session-redirect';
import { useWipeWarning } from './WipeWarning';

interface CheckedReset {
  code: string;
  username: string;
  role: Role;
}

/**
 * Nouveau mot de passe (maquette A04) : un refus, local ou du serveur (mot de passe courant…), est
 * rattaché à son champ (mot de passe ou confirmation), qui prend le focus ; l'erreur part dès que ce champ
 * est repris. Les autres erreurs du serveur (réseau, lien) s'affichent en alerte. La saisie est gardée.
 */
function NewPasswordForm(p: CheckedReset) {
  const repos = useRepos();
  const redirect = useSessionRedirect();
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const fields = useFieldErrors<keyof NewPasswordErrors>();
  const [error, setError] = useState<string | null>(null);
  const wipe = useWipeWarning(() => void send(true));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errors = newPasswordErrors(checkNewPassword({ ...passwords, username: p.username, role: p.role }));
    fields.show(errors);
    if (errors.password || errors.confirm) {
      setError(null);
      return;
    }
    void send(false);
  }

  /** `confirmed` : l'effacement des éléments non envoyés d'un autre compte a été accepté. */
  async function send(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const sameUser = (owner: DeviceOwner) =>
        owner.username !== null && usernameKey(p.username) === usernameKey(owner.username);
      if (!confirmed && (await wipe.warns(sameUser))) return;
      const me = await repos.me.resetPassword({ code: p.code, newPassword: passwords.password });
      redirect(me.id, '/');
    } catch (err) {
      // Ce formulaire n'a pas de champ pseudo : seul un refus du mot de passe y est rattaché.
      const password = accessFieldError(err, p.role)?.password;
      if (password) fields.show({ password });
      else setError(accessErrorMessage(err, p.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form ref={fields.formRef} className={styles.form} noValidate onSubmit={submit}>
        {/* Pseudo pour les gestionnaires de mots de passe : le nouveau est enregistré sous ce nom. */}
        <input type="text" autoComplete="username" value={p.username} readOnly hidden />
        <PasswordFields
          username={p.username}
          role={p.role}
          label={`Nouveau mot de passe pour ${p.username}`}
          {...passwords}
          onChange={(next) => {
            fields.clear(...editedPasswordFields(passwords, next));
            setPasswords(next);
          }}
          errors={fields.errors}
        />
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" disabled={busy}>
          Changer le mot de passe
        </Button>
      </form>
      {wipe.dialog}
    </>
  );
}

/**
 * Réinitialisation (R-RST-1) : lien ou code transmis par l'admin, puis nouveau mot de passe. Retour
 * mène à la connexion, d'une étape comme de l'autre.
 */
export function ResetPage() {
  const repos = useRepos();
  const fragment = useFragmentCode();
  const [checked, setChecked] = useState<CheckedReset | null>(null);

  if (checked) {
    return (
      <Page title="Choisis ton nouveau mot de passe" back="/login">
        <NewPasswordForm {...checked} />
      </Page>
    );
  }
  return (
    <Page title="Réinitialiser mon mot de passe" back="/login">
      <p className={styles.lead}>
        Ouvre le lien que l'administrateur t'a transmis, ou colle ici le lien ou le code.
      </p>
      <CodeStep
        label="Lien ou code de réinitialisation"
        fragment={fragment}
        check={repos.me.checkReset}
        onChecked={(code, r) => setChecked({ code, username: r.username, role: r.role })}
        describeError={(e) => accessErrorMessage(e, 'member')}
      />
    </Page>
  );
}

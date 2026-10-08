import type { Role } from '@appsport/contracts';
import { type FormEvent, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, Page } from '../../ui';
import styles from './auth.module.css';
import { CodeStep, useFragmentCode } from './CodeStep';
import { accessErrorMessage, checkNewPassword } from './messages';
import { PasswordFields } from './PasswordFields';
import { useSessionRedirect } from './use-session-redirect';

interface CheckedReset {
  code: string;
  username: string;
  role: Role;
}

function NewPasswordForm(p: CheckedReset) {
  const repos = useRepos();
  const redirect = useSessionRedirect();
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = checkNewPassword({ ...passwords, username: p.username, role: p.role });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await repos.me.resetPassword({ code: p.code, newPassword: passwords.password });
      redirect(me.id, '/');
    } catch (err) {
      setError(accessErrorMessage(err, p.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <PasswordFields
        username={p.username}
        role={p.role}
        label={`Nouveau mot de passe pour ${p.username}`}
        {...passwords}
        onChange={setPasswords}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button type="submit" disabled={busy}>
        Changer le mot de passe
      </Button>
    </form>
  );
}

/** Réinitialisation (R-RST-1) : lien ou code transmis par l'admin, puis nouveau mot de passe. */
export function ResetPage() {
  const repos = useRepos();
  const fragment = useFragmentCode();
  const [checked, setChecked] = useState<CheckedReset | null>(null);

  if (checked) {
    return (
      <Page title="Choisis ton nouveau mot de passe">
        <NewPasswordForm {...checked} />
      </Page>
    );
  }
  return (
    <Page title="Réinitialiser mon mot de passe">
      <p>Ouvre le lien que l'administrateur t'a transmis, ou colle ici le lien ou le code.</p>
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

import { EXPERIENCE_LABELS, GOAL_LABELS, type MeResponse, type Role, SPORTS } from '@appsport/contracts';
import { validateUsername } from '@appsport/domain';
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ApiError } from '../../api/client';
import { useLive, useMe } from '../../app-services';
import { type TrainingProfileView, useRepos } from '../../repos';
import { Banner, Button, Field, formatDate, Page, plural, useAction } from '../../ui';
import { LogoutDialog } from '../auth/LogoutDialog';
import { accessErrorMessage, checkNewPassword, loginErrorMessage, USERNAME_MESSAGES } from '../auth/messages';
import { PasswordFields } from '../auth/PasswordFields';
import { AvailabilityStep } from '../onboarding/AvailabilityStep';
import { ExperienceStep } from '../onboarding/ExperienceStep';
import { GoalStep } from '../onboarding/GoalStep';
import { CautiousModeToggle } from '../onboarding/HealthStep';
import { SportStep } from '../onboarding/SportStep';
import type { StepProps } from '../onboarding/StepActions';
import { StepTitleContext } from '../onboarding/StepTitle';
import styles from './profile.module.css';

export const FORCED_PASSWORD_CHANGE_TEXT =
  'Ton mot de passe doit être changé avant de continuer (14 caractères au moins pour un administrateur).';
export const PASSWORD_CHANGED_TEXT = 'Mot de passe changé. Tes autres appareils ont été déconnectés.';
const WRONG_CURRENT_PASSWORD = 'Mot de passe actuel incorrect.';
const CURRENT_PASSWORD_REQUIRED = 'Saisis ton mot de passe actuel.';
const NOT_SET = 'Non renseigné';

/**
 * Profil (02 §11) : Compte, Mot de passe, Entraînement et liens vers Lieux, Santé, Confidentialité
 * et Réglages. Mot de passe à changer (R-MDP-1) : bandeau et section du mot de passe seulement ; le
 * bandeau suit `useMe()` et disparaît au `refresh()` qui suit le changement. Les sections gardent
 * leur place dans l'arbre : le formulaire du mot de passe reste monté, avec son message de réussite.
 */
export function ProfilePage() {
  const me = useMe();
  if (!me) return null;
  const forced = me.mustChangePassword;
  return (
    <Page title="Profil">
      {forced ? <Banner tone="warning">{FORCED_PASSWORD_CHANGE_TEXT}</Banner> : null}
      {forced ? null : <AccountSection me={me} />}
      <PasswordSection me={me} />
      {forced ? null : <TrainingSection me={me} />}
      {forced ? null : <ProfileLinks />}
    </Page>
  );
}

/** Section titrée (h2), nommée par son titre. */
function Section(p: { title: string; headingId?: string; children: ReactNode }) {
  const fallbackId = useId();
  const id = p.headingId ?? fallbackId;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id}>{p.title}</h2>
      {p.children}
    </section>
  );
}

/** Compte : pseudo, date de naissance en lecture seule, déconnexion (R-CPT-3, R-AUTH-7, R-AUTH-9). */
function AccountSection(p: { me: MeResponse }) {
  const [logout, setLogout] = useState<'current' | 'all' | null>(null);
  return (
    <Section title="Compte">
      <UsernameForm me={p.me} />
      <Field label="Date de naissance" hint="Seul l'administrateur peut la corriger.">
        <input type="text" readOnly value={formatDate(p.me.birthDate)} />
      </Field>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setLogout('current')}>
          Se déconnecter
        </Button>
        <Button variant="danger" onClick={() => setLogout('all')}>
          Déconnecter tous mes appareils
        </Button>
      </div>
      <LogoutDialog mode={logout ?? 'current'} open={logout !== null} onClose={() => setLogout(null)} />
    </Section>
  );
}

/** Pseudo : contrôlé ici (R-CPT-2), puis PATCH /api/me ; le refus du serveur garde la saisie. */
function UsernameForm(p: { me: MeResponse }) {
  const repos = useRepos();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft ?? p.me.username;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || value === p.me.username) return;
    setSaved(false);
    const check = validateUsername(value);
    if (!check.ok) {
      setError(USERNAME_MESSAGES[check.reason]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repos.me.updateUsername(value);
      setDraft(null);
      setSaved(true);
    } catch (err) {
      // username_invalid : motif du serveur (body.reason) ; username_taken, réseau : message commun.
      setError(accessErrorMessage(err, p.me.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <Field label="Pseudo">
        <input
          type="text"
          value={value}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {saved ? <Banner tone="info">Pseudo enregistré.</Banner> : null}
      <Button type="submit" variant="secondary" disabled={busy || value === p.me.username}>
        Enregistrer le pseudo
      </Button>
    </form>
  );
}

/** Erreur d'un changement de mot de passe : mot de passe actuel, attente ou motif du refus. */
function passwordChangeError(e: unknown, role: Role): string {
  if (e instanceof ApiError && e.code === 'invalid_credentials') return WRONG_CURRENT_PASSWORD;
  if (e instanceof ApiError && e.code === 'rate_limited') return loginErrorMessage(e);
  return accessErrorMessage(e, role);
}

/**
 * Mot de passe (R-MDP-6) : l'actuel, puis le nouveau contrôlé ici (`checkNewPassword`, 14
 * caractères pour un admin). Réussite : champs vidés et autres appareils déconnectés.
 */
function PasswordSection(p: { me: MeResponse }) {
  const repos = useRepos();
  const [current, setCurrent] = useState('');
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    const problem =
      current === ''
        ? CURRENT_PASSWORD_REQUIRED
        : checkNewPassword({ ...passwords, username: p.me.username, role: p.me.role });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repos.me.changePassword({ currentPassword: current, newPassword: passwords.password });
      setCurrent('');
      setPasswords({ password: '', confirm: '' });
      setDone(true);
    } catch (err) {
      setError(passwordChangeError(err, p.me.role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Mot de passe">
      <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
        <Field label="Mot de passe actuel">
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <PasswordFields
          username={p.me.username}
          role={p.me.role}
          {...passwords}
          onChange={setPasswords}
          label="Nouveau mot de passe"
        />
        {error ? <Banner tone="error">{error}</Banner> : null}
        {done ? <Banner tone="info">{PASSWORD_CHANGED_TEXT}</Banner> : null}
        <Button type="submit" disabled={busy}>
          Changer le mot de passe
        </Button>
      </form>
    </Section>
  );
}

type Editor = 'goal' | 'sport' | 'experience' | 'availability';

const EDITORS: readonly { key: Editor; label: string; action: string }[] = [
  { key: 'goal', label: 'Objectif', action: "Modifier l'objectif" },
  { key: 'sport', label: 'Sport', action: 'Modifier le sport' },
  { key: 'experience', label: 'Niveau', action: 'Modifier le niveau' },
  { key: 'availability', label: 'Disponibilité', action: 'Modifier la disponibilité' },
];

function sportLabel(profile: TrainingProfileView): string {
  if (profile.sportCode === null) return 'Aucun';
  if (profile.sportCode === 'other') return profile.sportOtherLabel ?? NOT_SET;
  return SPORTS.find((s) => s.code === profile.sportCode)?.label ?? NOT_SET;
}

function summaryValue(key: Editor, profile: TrainingProfileView | null): string {
  if (!profile) return key === 'sport' ? 'Aucun' : NOT_SET;
  switch (key) {
    case 'goal':
      return profile.goal ? GOAL_LABELS[profile.goal] : NOT_SET;
    case 'sport':
      return sportLabel(profile);
    case 'experience':
      return profile.experience ? EXPERIENCE_LABELS[profile.experience] : NOT_SET;
    case 'availability':
      return profile.daysPerWeek && profile.sessionMinutes
        ? `${profile.daysPerWeek} ${plural(profile.daysPerWeek, 'séance', 'séances')} de ${profile.sessionMinutes} min`
        : NOT_SET;
  }
}

/**
 * Entraînement (R-ONB-3) : chaque réponse se modifie avec l'écran de l'onboarding en édition, à la
 * place du résumé. Le titre de l'écran prend le focus à l'ouverture (« Entraînement <titre> ») ; à la
 * fermeture, le focus revient au bouton « Modifier … ». Mode prudent envoyé au changement.
 */
function TrainingSection(p: { me: MeResponse }) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const headingId = useId();
  const [editing, setEditing] = useState<Editor | null>(null);
  const focusNext = useRef(false);
  const returnTo = useRef<Editor | null>(null);
  const summaryRef = useRef<HTMLDListElement>(null);
  const titles = useMemo(() => ({ progressId: headingId, focusNext }), [headingId]);
  const [cautiousDraft, setCautiousDraft] = useState<boolean | null>(null);
  const cautious = useAction(async (cautiousMode: boolean) => {
    await repos.profile.update({ cautiousMode });
    return true;
  });

  // Mode prudent : le choix s'affiche jusqu'à la relecture du miroir (pull après l'envoi).
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du profil efface le brouillon
  useEffect(() => setCautiousDraft(null), [profile]);

  useEffect(() => {
    if (editing !== null || returnTo.current === null) return;
    summaryRef.current?.querySelector<HTMLButtonElement>(`[data-editor="${returnTo.current}"]`)?.focus();
    returnTo.current = null;
  }, [editing]);

  if (profile === undefined) return null;

  function open(key: Editor) {
    focusNext.current = true;
    setEditing(key);
  }
  function close() {
    returnTo.current = editing;
    setEditing(null);
  }
  async function changeCautious(v: boolean) {
    setCautiousDraft(v);
    if (!(await cautious.run(v))) setCautiousDraft(null);
  }

  const step: StepProps = { mode: 'edit', onNext: close, onBack: close };

  return (
    <Section title="Entraînement" headingId={headingId}>
      {editing === null ? (
        <dl ref={summaryRef} className={styles.summary}>
          {EDITORS.map((e) => (
            <div key={e.key}>
              <dt>{e.label}</dt>
              <dd>{summaryValue(e.key, profile)}</dd>
              <dd>
                <Button variant="secondary" data-editor={e.key} onClick={() => open(e.key)}>
                  {e.action}
                </Button>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <StepTitleContext.Provider value={titles}>
          <div className={styles.editor}>
            {editing === 'goal' ? <GoalStep {...step} /> : null}
            {editing === 'sport' ? <SportStep {...step} /> : null}
            {editing === 'experience' ? <ExperienceStep {...step} /> : null}
            {editing === 'availability' ? <AvailabilityStep {...step} /> : null}
          </div>
        </StepTitleContext.Provider>
      )}
      <CautiousModeToggle
        value={cautiousDraft ?? profile?.cautiousMode ?? false}
        minor={p.me.ageBand === 'minor'}
        onChange={(v) => void changeCautious(v)}
      />
      {cautious.error ? <Banner tone="error">{cautious.error}</Banner> : null}
    </Section>
  );
}

const LINKS: readonly { href: string; label: string }[] = [
  { href: '/profile/places', label: 'Lieux' },
  { href: '/profile/health', label: 'Santé' },
  { href: '/profile/privacy', label: 'Confidentialité' },
  { href: '/settings', label: 'Réglages' },
];

function ProfileLinks() {
  return (
    <nav aria-label="Autres pages du profil">
      <ul className={styles.links}>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

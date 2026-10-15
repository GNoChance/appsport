import type { MeResponse, Role } from '@rune/contracts';
import { validateUsername } from '@rune/domain';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../../api/client';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, Field, formatDate, ListGroup, ListRow, Page, useAction } from '../../ui';
import { LogoutDialog } from '../auth/LogoutDialog';
import {
  accessErrorMessage,
  checkNewPassword,
  loginErrorMessage,
  PASSWORD_MISMATCH_MESSAGE,
  USERNAME_MESSAGES,
} from '../auth/messages';
import { PasswordFields } from '../auth/PasswordFields';
import { AvailabilityStep } from '../onboarding/AvailabilityStep';
import { ExperienceStep } from '../onboarding/ExperienceStep';
import { GoalStep } from '../onboarding/GoalStep';
import { CautiousModeToggle } from '../onboarding/HealthStep';
import { SportStep } from '../onboarding/SportStep';
import type { StepProps } from '../onboarding/StepActions';
import { StepTitleContext } from '../onboarding/StepTitle';
import {
  BarsIcon,
  CalendarIcon,
  GaugeIcon,
  IdCardIcon,
  KeyIcon,
  LockIcon,
  LogoutIcon,
  PulseIcon,
  TargetIcon,
  UserIcon,
} from './icons';
import styles from './profile.module.css';
import { answerValue, type TrainingAnswer } from './profile-summary';
import { useFocusAfterClose } from './use-focus-after-close';

export const FORCED_PASSWORD_CHANGE_TEXT =
  'Ton mot de passe doit être changé avant de continuer (14 caractères au moins pour un administrateur).';
export const PASSWORD_CHANGED_TEXT = 'Mot de passe changé. Tes autres appareils ont été déconnectés.';
const USERNAME_SAVED_TEXT = 'Pseudo enregistré.';
const WRONG_CURRENT_PASSWORD = 'Mot de passe actuel incorrect.';
const CURRENT_PASSWORD_REQUIRED = 'Saisis ton mot de passe actuel.';

/** Bouton de la ligne nommée `label` dans `root` (une ligne est nommée par son seul libellé). */
function rowButton(root: HTMLElement | null, label: string): HTMLElement | null {
  for (const button of root?.querySelectorAll<HTMLElement>('button[aria-labelledby]') ?? []) {
    const labelId = button.getAttribute('aria-labelledby') ?? '';
    if (document.getElementById(labelId)?.textContent === label) return button;
  }
  return null;
}

/**
 * Profil › Mon profil (02 §11, spec refonte §10.4, maquette C02) : Entraînement (une ligne par réponse de
 * l'onboarding, qui ouvre son écran en édition, puis le mode prudent, réglé ici seulement) et Compte (pseudo
 * et mot de passe derrière leur ligne, date de naissance en lecture seule). Mot de passe à changer (R-MDP-1) :
 * bandeau, champs du mot de passe d'emblée et « Se déconnecter » seulement, sans Retour (le hub renverrait
 * ici) ; une fois changé, tout réapparaît avec le message de réussite.
 */
export function ProfilePage() {
  const me = useMe();
  if (!me) return null;
  const forced = me.mustChangePassword;
  return (
    <Page title="Mon profil" back={forced ? undefined : '/profile'}>
      {forced ? <Banner tone="warning">{FORCED_PASSWORD_CHANGE_TEXT}</Banner> : null}
      {forced ? null : <TrainingSection me={me} />}
      <AccountSection me={me} />
      {forced ? <ForcedLogout /> : null}
    </Page>
  );
}

/** Section titrée (h2), nommée par son titre. */
function Section(p: { title: string; headingId?: string; children: ReactNode }) {
  const fallbackId = useId();
  const id = p.headingId ?? fallbackId;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

type AccountForm = 'username' | 'password';

const ACCOUNT_ROWS: Record<AccountForm, string> = {
  username: 'Pseudo',
  password: 'Changer le mot de passe',
};

/**
 * Compte (R-CPT-3, R-MDP-6) : la ligne « Pseudo » ou « Changer le mot de passe » ouvre son formulaire à la
 * place des lignes ; « Annuler » ou la réussite les rendent, la réussite avec son message, et le focus revient
 * à la ligne. La date de naissance se lit seulement (seul l'administrateur la corrige). Mot de passe à changer :
 * le formulaire du mot de passe seul, ouvert d'emblée et sans « Annuler » ; l'état est gardé quand l'obligation
 * tombe, pour que le message de réussite et le focus suivent.
 */
function AccountSection(p: { me: MeResponse }) {
  const forced = p.me.mustChangePassword;
  const [open, setOpen] = useState<AccountForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<AccountForm | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open !== null || forced || returnTo === null) return;
    rowButton(listRef.current, ACCOUNT_ROWS[returnTo])?.focus();
    setReturnTo(null);
  }, [open, forced, returnTo]);

  function show(form: AccountForm) {
    setNotice(null);
    setOpen(form);
  }
  function close(form: AccountForm, message: string | null = null) {
    setNotice(message);
    setReturnTo(form);
    setOpen(null);
  }

  if (forced) {
    return (
      <Section title="Mot de passe">
        <PasswordForm me={p.me} onDone={() => close('password', PASSWORD_CHANGED_TEXT)} />
      </Section>
    );
  }

  return (
    <Section title="Compte">
      {open === null && notice ? <Banner tone="info">{notice}</Banner> : null}
      {open === 'username' ? (
        <UsernameForm
          me={p.me}
          onDone={() => close('username', USERNAME_SAVED_TEXT)}
          onCancel={() => close('username')}
        />
      ) : open === 'password' ? (
        <PasswordForm
          me={p.me}
          focusOnOpen
          onDone={() => close('password', PASSWORD_CHANGED_TEXT)}
          onCancel={() => close('password')}
        />
      ) : (
        <div ref={listRef}>
          <ListGroup>
            <ListRow
              icon={<UserIcon />}
              label={ACCOUNT_ROWS.username}
              value={p.me.username}
              onClick={() => show('username')}
            />
            <ListRow
              icon={<IdCardIcon />}
              label="Date de naissance"
              value={
                <span className={styles.lines}>
                  <span>{formatDate(p.me.birthDate)}</span>
                  <span>Seul l'administrateur peut la corriger.</span>
                </span>
              }
              badge={
                <span className={styles.lock}>
                  <LockIcon />
                </span>
              }
            />
            <ListRow
              icon={<KeyIcon />}
              label={ACCOUNT_ROWS.password}
              value="Tes autres appareils seront déconnectés."
              onClick={() => show('password')}
            />
          </ListGroup>
        </div>
      )}
    </Section>
  );
}

/**
 * Mot de passe à changer (R-MDP-1) : seule autre issue, la déconnexion de cet appareil, que le serveur
 * accepte dans cet état (R-AUTH-9 : même avertissement, puis données locales effacées). La feuille ne propose
 * pas « Tous mes appareils ». À la fermeture, le focus revient à la ligne.
 */
function ForcedLogout() {
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFocusAfterClose(open, () => row.current?.querySelector('button'));
  return (
    <div ref={row}>
      <ListGroup>
        <ListRow icon={<LogoutIcon />} label="Se déconnecter" tone="danger" onClick={() => setOpen(true)} />
      </ListGroup>
      <LogoutDialog currentOnly open={open} onClose={close} />
    </div>
  );
}

/**
 * Pseudo : contrôlé ici (R-CPT-2), message lié au champ, qui prend le focus ; puis PATCH /api/me. Le refus du
 * serveur (ou le réseau) s'affiche en alerte et garde la saisie. Le champ prend le focus à l'ouverture.
 */
function UsernameForm(p: { me: MeResponse; onDone(): void; onCancel(): void }) {
  const repos = useRepos();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const value = draft ?? p.me.username;

  useEffect(() => inputRef.current?.focus(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || value === p.me.username) return;
    setError(null);
    const check = validateUsername(value);
    if (!check.ok) {
      setFieldError(USERNAME_MESSAGES[check.reason]);
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await repos.me.updateUsername(value);
    } catch (err) {
      // username_invalid : motif du serveur (body.reason) ; username_taken, réseau : message commun.
      setError(accessErrorMessage(err, p.me.role));
      setBusy(false);
      return;
    }
    setBusy(false);
    p.onDone();
  }

  return (
    <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <Field label="Pseudo" error={fieldError}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
        />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className={styles.formActions}>
        <Button type="submit" disabled={busy || value === p.me.username}>
          Enregistrer le pseudo
        </Button>
        <Button variant="secondary" disabled={busy} onClick={p.onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Erreur d'un changement de mot de passe : mot de passe actuel, attente ou motif du refus. */
function passwordChangeError(e: unknown, role: Role): string {
  if (e instanceof ApiError && e.code === 'invalid_credentials') return WRONG_CURRENT_PASSWORD;
  if (e instanceof ApiError && e.code === 'rate_limited') return loginErrorMessage(e);
  return accessErrorMessage(e, role);
}

type PasswordFieldErrors = { current?: string; password?: string; confirm?: string };

/**
 * Mot de passe (R-MDP-6) : l'actuel, puis le nouveau contrôlé ici (`checkNewPassword`, 14 caractères pour un
 * admin) ; un refus local est lié à son champ, qui prend le focus. Le refus du serveur ou le réseau s'affichent
 * en alerte et gardent la saisie. Réussite (autres appareils déconnectés) : `onDone`. `onCancel` absent (mot
 * de passe à changer) : pas d'« Annuler ». `focusOnOpen` : le premier champ prend le focus à l'ouverture.
 */
function PasswordForm(p: { me: MeResponse; focusOnOpen?: boolean; onDone(): void; onCancel?(): void }) {
  const repos = useRepos();
  const [current, setCurrent] = useState('');
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  const focusOnOpen = useRef(p.focusOnOpen);

  useEffect(() => {
    if (focusOnOpen.current) currentRef.current?.focus();
  }, []);

  // Refus local : le champ en cause (marqué aria-invalid au rendu) prend le focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque refus local relance la recherche
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (current === '') {
      setFieldErrors({ current: CURRENT_PASSWORD_REQUIRED });
      return;
    }
    const problem = checkNewPassword({ ...passwords, username: p.me.username, role: p.me.role });
    if (problem) {
      setFieldErrors(problem === PASSWORD_MISMATCH_MESSAGE ? { confirm: problem } : { password: problem });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await repos.me.changePassword({ currentPassword: current, newPassword: passwords.password });
    } catch (err) {
      setError(passwordChangeError(err, p.me.role));
      setBusy(false);
      return;
    }
    // Champs vidés : le formulaire reste un instant affiché (mot de passe à changer) avant de céder la place.
    setCurrent('');
    setPasswords({ password: '', confirm: '' });
    setBusy(false);
    p.onDone();
  }

  return (
    <form ref={formRef} className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <Field label="Mot de passe actuel" error={fieldErrors.current}>
        <input
          ref={currentRef}
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
        errors={fieldErrors}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className={styles.formActions}>
        <Button type="submit" disabled={busy}>
          Changer le mot de passe
        </Button>
        {p.onCancel ? (
          <Button variant="secondary" disabled={busy} onClick={p.onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const TRAINING_ROWS: readonly { key: TrainingAnswer; label: string; icon: ReactNode }[] = [
  { key: 'goal', label: 'Objectif', icon: <TargetIcon /> },
  { key: 'sport', label: 'Sport', icon: <PulseIcon /> },
  { key: 'experience', label: 'Niveau', icon: <BarsIcon /> },
  { key: 'availability', label: 'Disponibilité', icon: <CalendarIcon /> },
];

const labelOf = (key: TrainingAnswer) => TRAINING_ROWS.find((r) => r.key === key)?.label ?? '';

/**
 * Entraînement (R-ONB-3) : chaque ligne ouvre l'écran de l'onboarding en édition, à la place des lignes. Le
 * titre de l'écran prend le focus à l'ouverture (« Entraînement <titre> ») ; à la fermeture, le focus revient
 * à la ligne. Mode prudent (C1, réglé ici seulement) envoyé au changement, interrupteur désactivé pendant
 * l'envoi (deux envois croisés laisseraient un état ou une erreur périmés).
 */
function TrainingSection(p: { me: MeResponse }) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const headingId = useId();
  const [editing, setEditing] = useState<TrainingAnswer | null>(null);
  const focusNext = useRef(false);
  const returnTo = useRef<TrainingAnswer | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    rowButton(listRef.current, labelOf(returnTo.current))?.focus();
    returnTo.current = null;
  }, [editing]);

  if (profile === undefined) return null;

  function open(key: TrainingAnswer) {
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
        <div ref={listRef}>
          <ListGroup>
            {TRAINING_ROWS.map((r) => (
              <ListRow
                key={r.key}
                icon={r.icon}
                label={r.label}
                value={answerValue(r.key, profile)}
                onClick={() => open(r.key)}
              />
            ))}
          </ListGroup>
        </div>
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
      <div className={styles.cautious}>
        <span className={styles.cautiousIcon} aria-hidden="true">
          <GaugeIcon />
        </span>
        <CautiousModeToggle
          value={cautiousDraft ?? profile?.cautiousMode ?? false}
          minor={p.me.ageBand === 'minor'}
          disabled={cautious.pending}
          onChange={(v) => void changeCautious(v)}
        />
      </div>
      {cautious.error ? <Banner tone="error">{cautious.error}</Banner> : null}
    </Section>
  );
}

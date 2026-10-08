import {
  BODY_AREA_LABELS,
  BODY_AREAS,
  type BodyArea,
  HEALTH_CONSENT_TEXT,
  HEALTH_QUESTIONNAIRE,
  LIMITATION_NOTE_MAX,
  LIMITATION_SEVERITIES,
  LIMITATION_SEVERITY_LABELS,
  LIMITATION_SIDE_LABELS,
  LIMITATION_SIDES,
  type LimitationSeverity,
  type LimitationSide,
  type TrainingProfilePatch,
} from '@appsport/contracts';
import { useId, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Field, HealthWarning, useAction } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, saveStep } from './StepActions';
import { StepTitle } from './StepTitle';

const SELF_CHECK_TEXT =
  "Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer.";
const SEE_DOCTOR_TEXT = 'Nous te recommandons de consulter un médecin avant de commencer.';
const SCREENING_INCOMPLETE = 'Réponds aux 4 questions ou efface tes réponses avant de continuer.';
const DRAFT_INCOMPLETE = 'Termine ou efface la limitation en cours avant de continuer.';
const CAUTIOUS_NOT_HEALTH_DATA =
  "Réglage d'entraînement, pas une donnée de santé : enregistré même sans accord.";

/** Explication et accord santé (E7.1, P-CST-1) : case jamais pré-cochée, distincte de Confidentialité. */
export function HealthConsentPanel(p: { onGranted(): void; onSkip?: () => void }) {
  const repos = useRepos();
  const [agreed, setAgreed] = useState(false);
  const grant = useAction(async () => {
    await repos.consent.grantHealth();
    p.onGranted();
  });
  return (
    <section className={styles.panel}>
      <p>
        Tes réponses au questionnaire et tes limitations sont des données de santé. Elles servent seulement à
        adapter tes séances et restent sur le serveur du cercle. Elles ne vont au coach qu'avec son propre
        accord, en plus de celui-ci. Tu peux les supprimer à tout moment.
      </p>
      <label className={styles.check}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>{HEALTH_CONSENT_TEXT.text}</span>
      </label>
      {grant.error ? <Banner tone="error">{grant.error}</Banner> : null}
      <div className={styles.actions}>
        {p.onSkip ? (
          <Button variant="secondary" onClick={p.onSkip}>
            Passer
          </Button>
        ) : null}
        <Button disabled={!agreed || grant.pending} onClick={() => void grant.run()}>
          J'accepte et je renseigne
        </Button>
      </div>
    </section>
  );
}

type Answer = 'yes' | 'no';

const noAnswers = (): (Answer | null)[] => HEALTH_QUESTIONNAIRE.questions.map(() => null);

/**
 * Questionnaire d'alerte en cours (E7.2) : réponses, réponses déjà envoyées et `persist` (PUT des
 * 4 réponses, qui lève en cas d'échec). Tenu par `HealthStep` pour l'envoyer au clic sur « Suivant ».
 */
export function useScreening(onSaved?: (caution: boolean) => void) {
  const repos = useRepos();
  const [answers, setAnswers] = useState(noAnswers);
  const [sent, setSent] = useState<(Answer | null)[] | null>(null);
  const [a, b, c, d] = answers.map((x) => (x === null ? null : x === 'yes'));
  const values: [boolean, boolean, boolean, boolean] | null =
    a != null && b != null && c != null && d != null ? [a, b, c, d] : null;
  const answered = answers.some((x) => x !== null);
  const dirty = answered && (sent === null || sent.some((x, i) => x !== answers[i]));
  return {
    answers,
    setAnswer: (i: number, v: Answer) => setAnswers((prev) => prev.map((x, j) => (j === i ? v : x))),
    clear: () => setAnswers(noAnswers()),
    complete: values !== null,
    /** Réponses commencées mais pas toutes données. */
    partial: answered && values === null,
    /** Réponses données et pas encore envoyées telles quelles. */
    dirty,
    saved: sent !== null && !dirty,
    /** Un seul « oui » suffit pour recommander un médecin, avant tout envoi. */
    advice: answers.includes('yes'),
    async persist(): Promise<void> {
      if (values === null) return;
      const result = await repos.consent.saveScreening(values);
      setSent(answers);
      onSaved?.(result.caution);
    },
  };
}

export type Screening = ReturnType<typeof useScreening>;

/**
 * Questionnaire d'alerte (E7.2) : avec accord, réponses envoyées et seul l'indicateur de prudence
 * est gardé ; sans accord (`record` faux), auto-vérification affichée, rien n'est envoyé (P-CST-2).
 * `screening` : réponses tenues par l'écran parent (onboarding), sinon par le composant.
 */
export function ScreeningQuestions(p: {
  record: boolean;
  onSaved?(caution: boolean): void;
  screening?: Screening;
}) {
  const id = useId();
  const own = useScreening(p.onSaved);
  const s = p.screening ?? own;
  const save = useAction(() => s.persist());

  if (!p.record) {
    return (
      <section className={styles.panel}>
        <p>{SELF_CHECK_TEXT}</p>
        <ul className={styles.questions}>
          {HEALTH_QUESTIONNAIRE.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      {HEALTH_QUESTIONNAIRE.questions.map((q, i) => (
        <ChoiceList<Answer>
          key={q}
          name={`${id}-screening-${i}`}
          legend={q}
          value={s.answers[i] ?? null}
          onChange={(v) => s.setAnswer(i, v)}
          options={[
            { value: 'yes', label: 'Oui' },
            { value: 'no', label: 'Non' },
          ]}
        />
      ))}
      {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      {s.advice ? <Banner tone="warning">{SEE_DOCTOR_TEXT}</Banner> : null}
      {s.saved ? <Banner tone="info">Réponses enregistrées.</Banner> : null}
      <div className={styles.actions}>
        {s.dirty ? (
          <Button variant="secondary" onClick={s.clear}>
            Effacer mes réponses
          </Button>
        ) : null}
        <Button variant="secondary" disabled={!s.complete || save.pending} onClick={() => void save.run()}>
          Enregistrer mes réponses
        </Button>
      </div>
    </section>
  );
}

/**
 * Limitation en cours de saisie (E7.3) : `persist` l'ajoute (POST, lève en cas d'échec) puis vide
 * la saisie. Tenue par `HealthStep` pour l'envoyer au clic sur « Suivant ».
 */
export function useLimitationDraft() {
  const repos = useRepos();
  const [bodyArea, setBodyArea] = useState<BodyArea | ''>('');
  const [side, setSide] = useState<LimitationSide | ''>('');
  const [severity, setSeverity] = useState<LimitationSeverity | null>(null);
  const [note, setNote] = useState('');
  const complete = bodyArea !== '' && side !== '' && severity !== null;
  const empty = bodyArea === '' && side === '' && severity === null && note.trim() === '';
  const clear = () => {
    setBodyArea('');
    setSide('');
    setSeverity(null);
    setNote('');
  };
  return {
    bodyArea,
    setBodyArea,
    side,
    setSide,
    severity,
    setSeverity,
    note,
    setNote,
    complete,
    /** Saisie commencée mais pas complète. */
    partial: !empty && !complete,
    empty,
    clear,
    async persist(): Promise<void> {
      if (bodyArea === '' || side === '' || severity === null) return;
      const trimmed = note.trim();
      await repos.consent.addLimitation({ bodyArea, side, severity, note: trimmed === '' ? null : trimmed });
      clear();
    },
  };
}

export type LimitationDraft = ReturnType<typeof useLimitationDraft>;

/**
 * Limitations facultatives (E7.3) : zone, côté, gêne et note de 200 caractères au plus. `draft` :
 * saisie tenue par l'écran parent (onboarding), sinon par le composant.
 */
export function LimitationsEditor(p: { draft?: LimitationDraft } = {}) {
  const repos = useRepos();
  const id = useId();
  const limitations = useLive(() => repos.consent.limitations(), [repos]);
  const own = useLimitationDraft();
  const draft = p.draft ?? own;
  const add = useAction(() => draft.persist());
  const remove = useAction((limitationId: string) => repos.consent.removeLimitation(limitationId));

  return (
    <section className={styles.panel}>
      <h3>Limitations</h3>
      <p className={styles.note}>
        Facultatif : une zone sensible ou une gêne à ménager ; aucun diagnostic n'est nécessaire.
      </p>
      {limitations === undefined ? null : limitations.length === 0 ? (
        <p>Aucune</p>
      ) : (
        <ul className={styles.limitations}>
          {limitations.map((l) => (
            <li key={l.id} className={styles.limitation}>
              <span>
                <span id={`${id}-${l.id}`}>
                  {`${BODY_AREA_LABELS[l.bodyArea]} · ${LIMITATION_SIDE_LABELS[l.side]} · ${LIMITATION_SEVERITY_LABELS[l.severity]}`}
                </span>
                {l.note ? <span className={styles.note}> — {l.note}</span> : null}
              </span>
              <Button
                variant="secondary"
                aria-describedby={`${id}-${l.id}`}
                disabled={remove.pending}
                onClick={() => void remove.run(l.id)}
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Zone">
        <select value={draft.bodyArea} onChange={(e) => draft.setBodyArea(e.target.value as BodyArea | '')}>
          <option value="">Choisir</option>
          {BODY_AREAS.map((a) => (
            <option key={a} value={a}>
              {BODY_AREA_LABELS[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Côté">
        <select value={draft.side} onChange={(e) => draft.setSide(e.target.value as LimitationSide | '')}>
          <option value="">Choisir</option>
          {LIMITATION_SIDES.map((s) => (
            <option key={s} value={s}>
              {LIMITATION_SIDE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <ChoiceList<LimitationSeverity>
        name={`${id}-severity`}
        legend="Gêne"
        value={draft.severity}
        onChange={draft.setSeverity}
        options={LIMITATION_SEVERITIES.map((s) => ({ value: s, label: LIMITATION_SEVERITY_LABELS[s] }))}
      />
      <Field label="Note" hint={`${LIMITATION_NOTE_MAX} caractères au plus.`}>
        <input
          type="text"
          maxLength={LIMITATION_NOTE_MAX}
          value={draft.note}
          onChange={(e) => draft.setNote(e.target.value)}
        />
      </Field>
      {add.error ? <Banner tone="error">{add.error}</Banner> : null}
      {remove.error ? <Banner tone="error">{remove.error}</Banner> : null}
      <div className={styles.actions}>
        {draft.empty ? null : (
          <Button variant="secondary" onClick={draft.clear}>
            Effacer la saisie
          </Button>
        )}
        <Button variant="secondary" disabled={!draft.complete || add.pending} onClick={() => void add.run()}>
          Ajouter une limitation
        </Button>
      </div>
    </section>
  );
}

/** Mode prudent (E7.5, C1) : proposé à tous ; affiché imposé pour un mineur (R-CST-7). */
export function CautiousModeToggle(p: {
  value: boolean;
  minor: boolean;
  /** Envoi en cours (Profil) : pas de nouveau choix avant la réponse. */
  disabled?: boolean;
  onChange(v: boolean): void;
}) {
  const hintId = useId();
  const noteId = useId();
  return (
    <div className={styles.toggle}>
      <label className={styles.check}>
        <input
          type="checkbox"
          role="switch"
          aria-checked={p.minor || p.value}
          checked={p.minor || p.value}
          disabled={p.minor || p.disabled}
          aria-describedby={p.minor ? `${hintId} ${noteId}` : noteId}
          onChange={(e) => p.onChange(e.target.checked)}
        />
        <span>Je préfère une progression plus prudente</span>
      </label>
      {p.minor ? (
        <span id={hintId} className={styles.note}>
          Imposé jusqu'à 18 ans
        </span>
      ) : null}
      <span id={noteId} className={styles.note}>
        {CAUTIOUS_NOT_HEALTH_DATA}
      </span>
    </div>
  );
}

/**
 * E7 Santé et prudence, facultatif. Avec accord : questionnaire enregistré et limitations ; sans :
 * accord proposé, ou auto-vérification après « Passer ». Au clic sur « Suivant » (R-ONB-2), l'écran
 * envoie ce qui n'est pas encore enregistré : réponses complètes (PUT), limitation complète (POST),
 * puis le mode prudent avec l'étape (PATCH). Une saisie à moitié faite arrête « Suivant ».
 */
export function HealthStep(p: StepProps) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [skipped, setSkipped] = useState(false);
  const [cautious, setCautious] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const screening = useScreening();
  const draft = useLimitationDraft();
  const recording = me?.consents.health.active === true;
  const next = useAction(async (patch: TrainingProfilePatch) => {
    if (recording && screening.dirty) await screening.persist();
    if (recording && draft.complete) await draft.persist();
    await saveStep(repos, p, 'health', patch);
  });
  if (!me || profile === undefined) return null;

  const minor = me.ageBand === 'minor';
  const stored = profile?.cautiousMode ?? false;
  const changed = !minor && cautious !== null && cautious !== stored;
  const issue = !recording
    ? null
    : screening.partial
      ? SCREENING_INCOMPLETE
      : draft.partial
        ? DRAFT_INCOMPLETE
        : null;

  function submit() {
    setBlocked(issue);
    if (issue === null) void next.run(changed ? { cautiousMode: cautious === true } : {});
  }

  return (
    <>
      <StepTitle>Santé et prudence</StepTitle>
      {recording ? (
        <>
          <ScreeningQuestions record screening={screening} />
          <LimitationsEditor draft={draft} />
        </>
      ) : skipped ? (
        <ScreeningQuestions record={false} />
      ) : (
        <HealthConsentPanel onGranted={() => {}} onSkip={() => setSkipped(true)} />
      )}
      <CautiousModeToggle value={cautious ?? stored} minor={minor} onChange={setCautious} />
      <HealthWarning />
      <StepActions
        onBack={p.onBack}
        pending={next.pending}
        error={blocked !== null && blocked === issue ? blocked : next.error}
        primary={{ label: saveLabel(p.mode), onClick: submit }}
      />
    </>
  );
}

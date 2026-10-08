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
} from '@appsport/contracts';
import { useId, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Field, HealthWarning, useAction } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';

const SELF_CHECK_TEXT =
  "Si l'une de ces situations te concerne, demande l'avis d'un médecin avant de commencer.";
const SEE_DOCTOR_TEXT = 'Nous te recommandons de consulter un médecin avant de commencer.';

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
        Les réponses de cet écran sont des données de santé. Elles servent seulement à adapter tes séances et
        restent sur le serveur du cercle. Elles ne vont au coach qu'avec son propre accord, en plus de
        celui-ci. Tu peux les supprimer à tout moment.
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

/**
 * Questionnaire d'alerte (E7.2) : avec accord, réponses envoyées et seul l'indicateur de prudence
 * est gardé ; sans accord (`record` faux), auto-vérification affichée, rien n'est envoyé (P-CST-2).
 */
export function ScreeningQuestions(p: { record: boolean; onSaved?(caution: boolean): void }) {
  const repos = useRepos();
  const id = useId();
  const [answers, setAnswers] = useState<(Answer | null)[]>(() =>
    HEALTH_QUESTIONNAIRE.questions.map(() => null),
  );
  const [caution, setCaution] = useState<boolean | null>(null);
  const save = useAction(async (a: [boolean, boolean, boolean, boolean]) => {
    const result = await repos.consent.saveScreening(a);
    setCaution(result.caution);
    p.onSaved?.(result.caution);
  });

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

  const [a, b, c, d] = answers.map((x) => (x === null ? null : x === 'yes'));
  const complete = a != null && b != null && c != null && d != null;
  return (
    <section className={styles.panel}>
      {HEALTH_QUESTIONNAIRE.questions.map((q, i) => (
        <ChoiceList<Answer>
          key={q}
          name={`${id}-screening-${i}`}
          legend={q}
          value={answers[i] ?? null}
          onChange={(v) => setAnswers((prev) => prev.map((x, j) => (j === i ? v : x)))}
          options={[
            { value: 'yes', label: 'Oui' },
            { value: 'no', label: 'Non' },
          ]}
        />
      ))}
      {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      {caution === true ? <Banner tone="warning">{SEE_DOCTOR_TEXT}</Banner> : null}
      {caution === false ? <Banner tone="info">Réponses enregistrées.</Banner> : null}
      <Button
        variant="secondary"
        disabled={!complete || save.pending}
        onClick={() => {
          if (complete) void save.run([a, b, c, d]);
        }}
      >
        Enregistrer mes réponses
      </Button>
    </section>
  );
}

/** Limitations facultatives (E7.3) : zone, côté, gêne et note de 200 caractères au plus. */
export function LimitationsEditor() {
  const repos = useRepos();
  const id = useId();
  const limitations = useLive(() => repos.consent.limitations(), [repos]);
  const [bodyArea, setBodyArea] = useState<BodyArea | ''>('');
  const [side, setSide] = useState<LimitationSide | ''>('');
  const [severity, setSeverity] = useState<LimitationSeverity | null>(null);
  const [note, setNote] = useState('');
  const add = useAction(async () => {
    if (bodyArea === '' || side === '' || severity === null) return;
    const trimmed = note.trim();
    await repos.consent.addLimitation({ bodyArea, side, severity, note: trimmed === '' ? null : trimmed });
    setBodyArea('');
    setSide('');
    setSeverity(null);
    setNote('');
  });
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
        <select value={bodyArea} onChange={(e) => setBodyArea(e.target.value as BodyArea | '')}>
          <option value="">Choisir</option>
          {BODY_AREAS.map((a) => (
            <option key={a} value={a}>
              {BODY_AREA_LABELS[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Côté">
        <select value={side} onChange={(e) => setSide(e.target.value as LimitationSide | '')}>
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
        value={severity}
        onChange={setSeverity}
        options={LIMITATION_SEVERITIES.map((s) => ({ value: s, label: LIMITATION_SEVERITY_LABELS[s] }))}
      />
      <Field label="Note" hint={`${LIMITATION_NOTE_MAX} caractères au plus.`}>
        <input
          type="text"
          maxLength={LIMITATION_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {add.error ? <Banner tone="error">{add.error}</Banner> : null}
      {remove.error ? <Banner tone="error">{remove.error}</Banner> : null}
      <Button
        variant="secondary"
        disabled={bodyArea === '' || side === '' || severity === null || add.pending}
        onClick={() => void add.run()}
      >
        Ajouter une limitation
      </Button>
    </section>
  );
}

/** Mode prudent (E7.5, C1) : proposé à tous ; affiché imposé pour un mineur (R-CST-7). */
export function CautiousModeToggle(p: { value: boolean; minor: boolean; onChange(v: boolean): void }) {
  const hintId = useId();
  return (
    <div className={styles.toggle}>
      <label className={styles.check}>
        <input
          type="checkbox"
          role="switch"
          aria-checked={p.minor || p.value}
          checked={p.minor || p.value}
          disabled={p.minor}
          aria-describedby={p.minor ? hintId : undefined}
          onChange={(e) => p.onChange(e.target.checked)}
        />
        <span>Je préfère une progression plus prudente</span>
      </label>
      {p.minor ? (
        <span id={hintId} className={styles.note}>
          Imposé jusqu'à 18 ans
        </span>
      ) : null}
    </div>
  );
}

/**
 * E7 Santé et prudence, facultatif. Avec accord : questionnaire enregistré et limitations ; sans :
 * accord proposé, ou auto-vérification après « Passer ». Le mode prudent est un état local, envoyé
 * au clic sur « Suivant » (R-ONB-2).
 */
export function HealthStep(p: StepProps) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [skipped, setSkipped] = useState(false);
  const [cautious, setCautious] = useState<boolean | null>(null);
  const save = useSaveStep(p, 'health');
  if (!me || profile === undefined) return null;

  const minor = me.ageBand === 'minor';
  const stored = profile?.cautiousMode ?? false;
  const changed = !minor && cautious !== null && cautious !== stored;
  return (
    <>
      <h2>Santé et prudence</h2>
      {me.consents.health.active ? (
        <>
          <ScreeningQuestions record />
          <LimitationsEditor />
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
        pending={save.pending}
        error={save.error}
        primary={{
          label: saveLabel(p.mode),
          onClick: () => void save.run(changed ? { cautiousMode: cautious === true } : {}),
        }}
      />
    </>
  );
}

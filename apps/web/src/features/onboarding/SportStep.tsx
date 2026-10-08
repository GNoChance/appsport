import {
  GOAL_LABELS,
  type Goal,
  ONBOARDING_STEPS,
  SPORT_OTHER_LABEL_MAX,
  SPORTS,
  type SportCode,
} from '@appsport/contracts';
import { useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceList, Field } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { StepTitle } from './StepTitle';

type Practice = 'yes' | 'no';

export const SPORT_REQUIRED_TEXT = `Obligatoire avec l'objectif « ${GOAL_LABELS.sport_support} ».`;

/**
 * E2 Autre sport : « Oui » imposé avec l'objectif sportif ; « Autre » exige un libellé (40
 * caractères au plus). `pendingGoal` (édition depuis l'objectif) : PATCH { goal, sportCode,
 * sportOtherLabel } en un seul envoi.
 */
export function SportStep(p: StepProps & { pendingGoal?: Goal }) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [sport, setSport] = useState<SportCode | null>(null);
  const [otherLabel, setOtherLabel] = useState<string | null>(null);
  const save = useSaveStep(p, 'sport');
  if (!me || profile === undefined) return null;

  const savedSport = profile?.sportCode ?? null;
  // Sans sport enregistré, « Non » n'est une réponse que si l'écran a déjà été validé.
  const answered =
    p.mode === 'edit' ||
    me.onboardingCompletedAt !== null ||
    (me.onboardingStep !== null &&
      ONBOARDING_STEPS.indexOf(me.onboardingStep) >= ONBOARDING_STEPS.indexOf('sport'));
  const required = (p.pendingGoal ?? profile?.goal) === 'sport_support';
  const practiceValue: Practice | null = required
    ? 'yes'
    : (practice ?? (savedSport !== null ? 'yes' : answered && profile !== null ? 'no' : null));
  const sportValue = sport ?? savedSport;
  const label = (otherLabel ?? profile?.sportOtherLabel ?? '').trim();
  const complete =
    practiceValue === 'no' || (sportValue !== null && (sportValue !== 'other' || label !== ''));

  function submit() {
    if (!complete) return;
    const answer =
      practiceValue === 'yes' && sportValue !== null
        ? { sportCode: sportValue, sportOtherLabel: sportValue === 'other' ? label : null }
        : { sportCode: null, sportOtherLabel: null };
    void save.run(p.pendingGoal ? { goal: p.pendingGoal, ...answer } : answer);
  }

  return (
    <>
      <StepTitle>Autre sport</StepTitle>
      <ChoiceList<Practice>
        name="sport-practice"
        legend="Pratiques-tu un autre sport régulièrement ?"
        value={practiceValue}
        onChange={setPractice}
        options={[
          { value: 'no', label: 'Non', disabled: required },
          { value: 'yes', label: 'Oui' },
        ]}
      />
      {required ? <p className={styles.note}>{SPORT_REQUIRED_TEXT}</p> : null}
      {practiceValue === 'yes' ? (
        <ChoiceList<SportCode>
          name="sport"
          legend="Quel sport ?"
          value={sportValue}
          onChange={setSport}
          options={SPORTS.map((s) => ({ value: s.code, label: s.label }))}
        />
      ) : null}
      {practiceValue === 'yes' && sportValue === 'other' ? (
        <Field label="Ton sport">
          <input
            type="text"
            maxLength={SPORT_OTHER_LABEL_MAX}
            value={otherLabel ?? profile?.sportOtherLabel ?? ''}
            onChange={(e) => setOtherLabel(e.target.value)}
          />
        </Field>
      ) : null}
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{ label: saveLabel(p.mode), disabled: !complete, onClick: submit }}
      />
    </>
  );
}

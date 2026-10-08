import { GOAL_LABELS, type Goal } from '@appsport/contracts';
import { availableGoals } from '@appsport/domain';
import { useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceList } from '../../ui';
import { SportStep } from './SportStep';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';

/**
 * E1 Objectif : « Perdre du gras » n'est pas proposé à un mineur. En édition, choisir l'objectif
 * sportif sans sport enregistré mène d'abord au sport, puis un seul PATCH (R-ONB-3).
 */
export function GoalStep(p: StepProps) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [choice, setChoice] = useState<Goal | null>(null);
  const [askSport, setAskSport] = useState(false);
  const save = useSaveStep(p, 'goal');
  if (!me || profile === undefined) return null;

  const goals = availableGoals(me.ageBand);
  const saved = profile?.goal ?? null;
  const value = choice ?? (saved !== null && goals.includes(saved) ? saved : null);
  const needsSport = p.mode === 'edit' && value === 'sport_support' && !profile?.sportCode;

  if (askSport) {
    return (
      <SportStep
        mode="edit"
        pendingGoal="sport_support"
        onNext={p.onNext}
        onBack={() => setAskSport(false)}
      />
    );
  }

  return (
    <>
      <h2>Objectif</h2>
      <ChoiceList<Goal>
        name="goal"
        legend="Quel est ton objectif principal ?"
        value={value}
        onChange={setChoice}
        options={goals.map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
      />
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{
          label: needsSport ? 'Suivant' : saveLabel(p.mode),
          disabled: value === null,
          onClick: () => {
            if (value === null) return;
            if (needsSport) setAskSport(true);
            else void save.run({ goal: value });
          },
        }}
      />
    </>
  );
}

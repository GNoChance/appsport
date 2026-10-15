import { GOAL_LABELS, type Goal } from '@rune/contracts';
import { availableGoals } from '@rune/domain';
import { useContext, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceCard, ChoiceGroup } from '../../ui';
import styles from './onboarding.module.css';
import { SportStep } from './SportStep';
import { CONTINUE_LABEL, StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { GOAL_ICONS } from './StepIcons';
import { StepTitle, StepTitleContext } from './StepTitle';

/**
 * E1 Objectif (maquette B01 : une carte par objectif, avec son icône) : « Perdre du gras » n'est pas proposé
 * à un mineur. En édition, choisir l'objectif sportif sans sport enregistré mène d'abord au sport
 * (« Continuer »), puis un seul PATCH (R-ONB-3) ; le titre de l'écran affiché (sport, ou objectif au retour)
 * prend alors le focus.
 */
export function GoalStep(p: StepProps) {
  const repos = useRepos();
  const me = useMe();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [choice, setChoice] = useState<Goal | null>(null);
  const [askSport, setAskSport] = useState(false);
  const titles = useContext(StepTitleContext);
  const save = useSaveStep(p, 'goal');
  if (!me || profile === undefined) return null;

  const goals = availableGoals(me.ageBand);
  const saved = profile?.goal ?? null;
  const value = choice ?? (saved !== null && goals.includes(saved) ? saved : null);
  const needsSport = p.mode === 'edit' && value === 'sport_support' && !profile?.sportCode;

  function showSport(show: boolean) {
    if (titles) titles.focusNext.current = true;
    setAskSport(show);
  }

  if (askSport) {
    return (
      <SportStep mode="edit" pendingGoal="sport_support" onNext={p.onNext} onBack={() => showSport(false)} />
    );
  }

  return (
    <>
      <StepTitle>Objectif</StepTitle>
      <div className={styles.question}>
        <ChoiceGroup legend="Quel est ton objectif principal ?">
          {goals.map((g) => (
            <ChoiceCard
              key={g}
              type="radio"
              name="goal"
              value={g}
              checked={value === g}
              onChange={() => setChoice(g)}
              title={GOAL_LABELS[g]}
              icon={GOAL_ICONS[g]}
            />
          ))}
        </ChoiceGroup>
      </div>
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{
          label: needsSport ? CONTINUE_LABEL : saveLabel(p.mode),
          disabled: value === null,
          onClick: () => {
            if (value === null) return;
            if (needsSport) showSport(true);
            else void save.run({ goal: value });
          },
        }}
      />
    </>
  );
}

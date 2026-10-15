import { EXPERIENCE_LABELS, EXPERIENCES, type Experience } from '@rune/contracts';
import { useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceCard, ChoiceGroup } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { EXPERIENCE_ICONS } from './StepIcons';
import { StepTitle } from './StepTitle';

/** E5 Niveau (maquette B05 : une carte par durée, des barres qui montent avec le niveau). */
export function ExperienceStep(p: StepProps) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [choice, setChoice] = useState<Experience | null>(null);
  const save = useSaveStep(p, 'experience');
  if (profile === undefined) return null;
  const value = choice ?? profile?.experience ?? null;
  return (
    <>
      <StepTitle>Niveau</StepTitle>
      <div className={styles.question}>
        <ChoiceGroup legend="Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ?">
          {EXPERIENCES.map((e) => (
            <ChoiceCard
              key={e}
              type="radio"
              name="experience"
              value={e}
              checked={value === e}
              onChange={() => setChoice(e)}
              title={EXPERIENCE_LABELS[e]}
              icon={EXPERIENCE_ICONS[e]}
            />
          ))}
        </ChoiceGroup>
      </div>
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{
          label: saveLabel(p.mode),
          disabled: value === null,
          onClick: () => {
            if (value !== null) void save.run({ experience: value });
          },
        }}
      />
    </>
  );
}

import { EXPERIENCE_LABELS, EXPERIENCES, type Experience } from '@appsport/contracts';
import { useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceList } from '../../ui';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';

/** E5 Niveau. */
export function ExperienceStep(p: StepProps) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [choice, setChoice] = useState<Experience | null>(null);
  const save = useSaveStep(p, 'experience');
  if (profile === undefined) return null;
  const value = choice ?? profile?.experience ?? null;
  return (
    <>
      <h2>Niveau</h2>
      <ChoiceList<Experience>
        name="experience"
        legend="Depuis combien de temps fais-tu de la musculation régulièrement (au moins une fois par semaine) ?"
        value={value}
        onChange={setChoice}
        options={EXPERIENCES.map((e) => ({ value: e, label: EXPERIENCE_LABELS[e] }))}
      />
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

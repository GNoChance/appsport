import { DAYS_PER_WEEK, SESSION_MINUTES } from '@appsport/contracts';
import { useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceList } from '../../ui';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';

type Days = (typeof DAYS_PER_WEEK)[number];
type Minutes = (typeof SESSION_MINUTES)[number];

/** E6 Disponibilité : séances par semaine (« 2 », « 3 », « 4 ») et durée (« 30 min » à « 90 min »). */
export function AvailabilityStep(p: StepProps) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [days, setDays] = useState<Days | null>(null);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const save = useSaveStep(p, 'availability');
  if (profile === undefined) return null;
  const daysValue = days ?? profile?.daysPerWeek ?? null;
  const minutesValue = minutes ?? profile?.sessionMinutes ?? null;
  return (
    <>
      <h2>Disponibilité</h2>
      <ChoiceList<Days>
        name="days-per-week"
        legend="Séances par semaine"
        value={daysValue}
        onChange={setDays}
        options={DAYS_PER_WEEK.map((n) => ({ value: n, label: String(n) }))}
      />
      <ChoiceList<Minutes>
        name="session-minutes"
        legend="Durée d'une séance"
        value={minutesValue}
        onChange={setMinutes}
        options={SESSION_MINUTES.map((n) => ({ value: n, label: `${n} min` }))}
      />
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{
          label: saveLabel(p.mode),
          disabled: daysValue === null || minutesValue === null,
          onClick: () => {
            if (daysValue !== null && minutesValue !== null) {
              void save.run({ daysPerWeek: daysValue, sessionMinutes: minutesValue });
            }
          },
        }}
      />
    </>
  );
}

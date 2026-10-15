import { DAYS_PER_WEEK, SESSION_MINUTES } from '@rune/contracts';
import { useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Chips, plural } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { CalendarGlyph } from './StepIcons';
import { StepTitle } from './StepTitle';

type Days = (typeof DAYS_PER_WEEK)[number];
type Minutes = (typeof SESSION_MINUTES)[number];

/**
 * E6 Disponibilité (maquette B06) : séances par semaine (« 2 », « 3 », « 4 ») et durée (« 30 min » à « 90 min »)
 * en pastilles ; la carte « Ton rythme » redit les deux réponses, et n'apparaît qu'une fois les deux données.
 */
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
      <StepTitle>Disponibilité</StepTitle>
      <p className={styles.lead}>Choisis un rythme que tu peux tenir.</p>
      <Chips
        name="days-per-week"
        legend="Séances par semaine"
        value={daysValue === null ? null : String(daysValue)}
        onChange={(v) => setDays(DAYS_PER_WEEK.find((n) => String(n) === v) ?? null)}
        options={DAYS_PER_WEEK.map((n) => ({ value: String(n), label: String(n) }))}
      />
      <Chips
        name="session-minutes"
        legend="Durée d'une séance"
        value={minutesValue === null ? null : String(minutesValue)}
        onChange={(v) => setMinutes(SESSION_MINUTES.find((n) => String(n) === v) ?? null)}
        options={SESSION_MINUTES.map((n) => ({ value: String(n), label: `${n} min` }))}
      />
      {daysValue !== null && minutesValue !== null ? (
        <div className={styles.rhythm}>
          <span className={styles.rhythmIcon} aria-hidden="true">
            <CalendarGlyph />
          </span>
          <p className={styles.rhythmText}>
            <span className={styles.rhythmLabel}>Ton rythme</span>
            <span className={styles.rhythmValue}>
              {`${daysValue} ${plural(daysValue, 'séance', 'séances')} de ${minutesValue} min par semaine`}
            </span>
          </p>
        </div>
      ) : null}
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

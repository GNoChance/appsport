import { EXPERIENCE_LABELS, GOAL_LABELS, OnboardingStep, SPORTS } from '@appsport/contracts';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { ApiError } from '../../api/client';
import { ONBOARDING_COMPLETED_EVENT } from '../../app-events';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, plural, useAction } from '../../ui';
import { OfflineReadyIndicator } from '../status/OfflineReadyIndicator';
import { useReadiness } from '../status/use-readiness';
import styles from './onboarding.module.css';
import { StepTitle } from './StepTitle';

/**
 * E8 C'est prêt : récapitulatif et voyant « Prêt hors ligne ». « Commencer » termine l'onboarding
 * une fois le voyant au vert (R-SYN-33), émet ONBOARDING_COMPLETED_EVENT puis mène à l'accueil ;
 * sinon « Réessayer ». Un écran encore incomplet pour le serveur (409) est rendu à `onIncomplete`,
 * avec l'étape qu'il indique (null si illisible).
 */
export function ReadyStep(p: { onBack(): void; onIncomplete(step: OnboardingStep | null): void }) {
  const repos = useRepos();
  const [, navigate] = useLocation();
  const { readiness, loaded, retry } = useReadiness();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const places = useLive(() => repos.places.list(), [repos]);
  const [retrying, setRetrying] = useState(false);
  const start = useAction(async () => {
    try {
      await repos.profile.completeOnboarding();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'onboarding_incomplete') throw error;
      const step = OnboardingStep.safeParse(error.body.step);
      p.onIncomplete(step.success ? step.data : null);
      return;
    }
    window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT));
    navigate('/');
  });

  const onRetry = () => {
    setRetrying(true);
    void retry().finally(() => setRetrying(false));
  };

  const primary = places?.find((pl) => pl.isPrimary);
  const sport = profile?.sportCode
    ? profile.sportCode === 'other'
      ? profile.sportOtherLabel
      : SPORTS.find((s) => s.code === profile.sportCode)?.label
    : null;

  return (
    <>
      <StepTitle>C'est prêt</StepTitle>
      {profile ? (
        <dl className={styles.summary}>
          {profile.goal ? (
            <div>
              <dt>Objectif</dt>
              <dd>{GOAL_LABELS[profile.goal]}</dd>
            </div>
          ) : null}
          {sport ? (
            <div>
              <dt>Sport</dt>
              <dd>{sport}</dd>
            </div>
          ) : null}
          {primary ? (
            <div>
              <dt>Lieu principal</dt>
              <dd>{primary.name}</dd>
            </div>
          ) : null}
          {profile.experience ? (
            <div>
              <dt>Niveau</dt>
              <dd>{EXPERIENCE_LABELS[profile.experience]}</dd>
            </div>
          ) : null}
          {profile.daysPerWeek && profile.sessionMinutes ? (
            <div>
              <dt>Disponibilité</dt>
              <dd>{`${profile.daysPerWeek} ${plural(profile.daysPerWeek, 'séance', 'séances')} de ${profile.sessionMinutes} min`}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {loaded ? <OfflineReadyIndicator readiness={readiness} /> : null}
      {start.error ? <Banner tone="error">{start.error}</Banner> : null}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={p.onBack} disabled={start.pending}>
          Retour
        </Button>
        {loaded && !readiness.ready ? (
          <Button variant="secondary" onClick={onRetry} disabled={retrying}>
            Réessayer
          </Button>
        ) : null}
        <Button onClick={() => void start.run()} disabled={!loaded || !readiness.ready || start.pending}>
          Commencer
        </Button>
      </div>
    </>
  );
}

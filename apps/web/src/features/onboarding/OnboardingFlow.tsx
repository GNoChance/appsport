import { ONBOARDING_STEPS, type OnboardingStep, type PlaceKind } from '@appsport/contracts';
import { firstIncompleteStep } from '@appsport/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { Page } from '../../ui';
import { AvailabilityStep } from './AvailabilityStep';
import { ExperienceStep } from './ExperienceStep';
import { GoalStep } from './GoalStep';
import { HealthStep } from './HealthStep';
import styles from './onboarding.module.css';
import { PlaceKindStep } from './PlaceKindStep';
import { PlaceStep } from './PlaceStep';
import { ReadyStep } from './ReadyStep';
import { SportStep } from './SportStep';

interface FlowState {
  step: OnboardingStep;
  /** Type du lieu principal : choisi à l'écran « Lieu principal », ou celui du lieu déjà créé. */
  kind: PlaceKind | null;
}

/** Écran affiché : l'écran du lieu sans type connu revient à la question du type. */
const shownStep = (s: FlowState): OnboardingStep =>
  s.step === 'place' && s.kind === null ? 'place_kind' : s.step;

/**
 * Onboarding en 8 écrans (02 §8), hors de la coquille de l'appli. Départ au premier écran
 * incomplet (R-ONB-2), recalculé à chaque pull réussi tant que l'utilisateur n'a rien changé (un
 * nouvel appareil reçoit ses réponses après l'ouverture) ; chaque écran s'enregistre au clic sur
 * « Suivant », « Retour » revient à l'écran précédent avec ses réponses.
 */
export function OnboardingFlow() {
  const repos = useRepos();
  const { lastPullOkAt } = useSyncState();
  const [state, setState] = useState<FlowState | null>(null);
  // Écran ou type de lieu changé par l'utilisateur : la reprise calculée ne s'applique plus.
  const moved = useRef(false);

  const resume = useCallback(async (): Promise<FlowState> => {
    const [input, places] = await Promise.all([repos.profile.onboardingInput(), repos.places.list()]);
    return { step: firstIncompleteStep(input), kind: places.find((p) => p.isPrimary)?.kind ?? null };
  }, [repos]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reprise recalculée après chaque pull réussi
  useEffect(() => {
    let active = true;
    resume().then(
      (s) => {
        if (active && !moved.current) setState(s);
      },
      () => {
        // Base locale illisible : départ au premier écran.
        if (active && !moved.current) setState((prev) => prev ?? { step: 'goal', kind: null });
      },
    );
    return () => {
      active = false;
    };
  }, [resume, lastPullOkAt]);

  if (!state) return null;

  const step = shownStep(state);
  const index = ONBOARDING_STEPS.indexOf(step);
  const goTo = (s: OnboardingStep) => {
    moved.current = true;
    setState((prev) => (prev ? { ...prev, step: s } : prev));
  };
  const next = ONBOARDING_STEPS[index + 1];
  const previous = ONBOARDING_STEPS[index - 1];
  const onNext = () => {
    if (next) goTo(next);
  };
  const onBack = previous ? () => goTo(previous) : undefined;
  const props = { mode: 'onboarding', onNext, onBack } as const;

  /** 409 onboarding_incomplete : l'écran indiqué par le serveur, sinon celui de la base locale. */
  const onIncomplete = (serverStep: OnboardingStep | null) => {
    if (serverStep) {
      goTo(serverStep);
      return;
    }
    moved.current = true;
    resume().then(
      (s) => setState(s),
      () => {},
    );
  };

  return (
    <Page title="Prise en main">
      <p className={styles.progress}>{`Étape ${index + 1}/${ONBOARDING_STEPS.length}`}</p>
      <div key={step} data-testid="onboarding-step" data-step={step} className={styles.step}>
        {step === 'goal' ? <GoalStep {...props} /> : null}
        {step === 'sport' ? <SportStep {...props} /> : null}
        {step === 'place_kind' ? (
          <PlaceKindStep
            {...props}
            value={state.kind}
            onChange={(kind) => {
              moved.current = true;
              setState((prev) => (prev ? { ...prev, kind } : prev));
            }}
          />
        ) : null}
        {step === 'place' && state.kind ? <PlaceStep {...props} kind={state.kind} /> : null}
        {step === 'experience' ? <ExperienceStep {...props} /> : null}
        {step === 'availability' ? <AvailabilityStep {...props} /> : null}
        {step === 'health' ? <HealthStep {...props} /> : null}
        {step === 'ready' ? <ReadyStep onBack={() => goTo('health')} onIncomplete={onIncomplete} /> : null}
      </div>
    </Page>
  );
}

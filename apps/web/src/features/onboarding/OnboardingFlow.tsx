import { ONBOARDING_STEPS, type OnboardingStep, type PlaceKind } from '@rune/contracts';
import { firstIncompleteStep } from '@rune/domain';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, ERROR_MESSAGES, Page, SegmentedProgress } from '../../ui';
import { type ScreenTransition, useScreenEntrance } from '../../ui/screen-transition';
import { CoachStep } from '../coach/CoachStep';
import { AvailabilityStep } from './AvailabilityStep';
import { ExperienceStep } from './ExperienceStep';
import { GoalStep } from './GoalStep';
import { HealthStep } from './HealthStep';
import styles from './onboarding.module.css';
import { PlaceKindStep } from './PlaceKindStep';
import { PlaceStep } from './PlaceStep';
import { ReadyStep } from './ReadyStep';
import { SportStep } from './SportStep';
import { StepTitleContext } from './StepTitle';

/**
 * Écrans de l'onboarding (spec refonte §10.1) : le coach d'abord, puis les écrans du serveur. Le coach n'est
 * pas une étape serveur (`ONBOARDING_STEPS` inchangé) : le serveur refuse seulement de terminer sans coach.
 */
export type FlowStep = 'coach' | OnboardingStep;
const FLOW_STEPS: readonly FlowStep[] = ['coach', ...ONBOARDING_STEPS];

interface FlowState {
  step: FlowStep;
  /** Type du lieu principal : choisi à l'écran « Lieu principal », ou celui du lieu déjà créé. */
  kind: PlaceKind | null;
  /**
   * Écran qui suit le coach : celui de la reprise quand elle passe d'abord par le coach (profil sans coach),
   * sinon l'objectif.
   */
  afterCoach: OnboardingStep;
  /** Entrée de l'écran affiché : depuis la droite vers l'avant, depuis la gauche au retour, rien à la reprise. */
  transition: ScreenTransition;
}

/**
 * Écran affiché : l'écran du lieu sans type connu revient à la question du type (seul un 409 du
 * serveur peut mener à 'place' : la reprise locale passe par 'place_kind').
 */
export const shownStep = (s: Pick<FlowState, 'step' | 'kind'>): FlowStep =>
  s.step === 'place' && s.kind === null ? 'place_kind' : s.step;

/**
 * Onboarding en 9 écrans (spec refonte §10.1), hors de la coquille de l'appli. Départ au premier écran
 * incomplet (R-ONB-2), précédé de l'étape coach tant que le profil n'a pas de coach ; recalculé à chaque
 * pull réussi tant que l'utilisateur n'a rien changé (un nouvel appareil reçoit ses réponses, coach compris,
 * après l'ouverture). Chaque écran s'enregistre au clic, « Retour » revient à l'écran précédent avec ses
 * réponses. À chaque changement d'écran, le nouvel écran entre par la droite (par la gauche au retour, en fondu
 * sous mouvement réduit, spec refonte §7) et son titre (« Étape n sur 9 <titre> ») prend le focus.
 */
export function OnboardingFlow() {
  const repos = useRepos();
  const { lastPullOkAt } = useSyncState();
  const [state, setState] = useState<FlowState | null>(null);
  // Raison d'un retour imposé par le serveur (409), affichée jusqu'au changement d'écran suivant.
  const [notice, setNotice] = useState<string | null>(null);
  // Écran, coach ou type de lieu changé par l'utilisateur : la reprise calculée ne s'applique plus.
  const moved = useRef(false);
  const focusNext = useRef(false);
  const progressId = useId();
  const titles = useMemo(() => ({ progressId, focusNext }), [progressId]);
  const screen = useRef<HTMLDivElement>(null);

  const resume = useCallback(async (): Promise<FlowState> => {
    const [input, places, profile] = await Promise.all([
      repos.profile.onboardingInput(),
      repos.places.list(),
      repos.profile.get(),
    ]);
    const step = firstIncompleteStep(input);
    return {
      step: profile?.coach ? step : 'coach',
      kind: places.find((p) => p.isPrimary)?.kind ?? null,
      afterCoach: step,
      transition: 'none',
    };
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
        if (active && !moved.current)
          setState((prev) => prev ?? { step: 'coach', kind: null, afterCoach: 'goal', transition: 'none' });
      },
    );
    return () => {
      active = false;
    };
  }, [resume, lastPullOkAt]);

  useScreenEntrance(screen, state ? shownStep(state) : '', state?.transition ?? 'none');

  if (!state) return null;

  const step = shownStep(state);
  const index = FLOW_STEPS.indexOf(step);
  const goTo = (s: FlowStep, reason: string | null = null) => {
    moved.current = true;
    focusNext.current = true;
    setNotice(reason);
    const transition = FLOW_STEPS.indexOf(s) < index ? 'back' : 'forward';
    // Revenir au coach depuis l'objectif : la suite du coach redevient l'objectif.
    setState((prev) =>
      prev ? { ...prev, step: s, afterCoach: s === 'coach' ? 'goal' : prev.afterCoach, transition } : prev,
    );
  };
  const next = FLOW_STEPS[index + 1];
  const previous = FLOW_STEPS[index - 1];
  const onNext = () => {
    if (next) goTo(next);
  };
  const onBack = previous ? () => goTo(previous) : undefined;
  const props = { mode: 'onboarding', onNext, onBack } as const;

  /** 409 onboarding_incomplete : l'écran indiqué par le serveur, sinon celui de la base locale. */
  const onIncomplete = (serverStep: OnboardingStep | null) => {
    const reason = ERROR_MESSAGES.onboarding_incomplete;
    if (serverStep) {
      goTo(serverStep, reason);
      return;
    }
    moved.current = true;
    resume().then(
      (s) => {
        focusNext.current = true;
        setNotice(reason);
        setState({ ...s, transition: 'back' });
      },
      () => {},
    );
  };

  return (
    <div className={styles.flow}>
      <Page title="Prise en main">
        <div id={progressId}>
          <SegmentedProgress step={index + 1} total={FLOW_STEPS.length} />
        </div>
        {notice ? <Banner tone="warning">{notice}</Banner> : null}
        <StepTitleContext.Provider value={titles}>
          <div ref={screen} key={step} data-testid="onboarding-step" data-step={step} className={styles.step}>
            {step === 'coach' ? (
              <CoachStep
                onNext={() => goTo(state.afterCoach)}
                onChange={() => {
                  moved.current = true;
                }}
              />
            ) : null}
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
            {step === 'ready' ? (
              <ReadyStep onBack={() => goTo('health')} onIncomplete={onIncomplete} />
            ) : null}
          </div>
        </StepTitleContext.Provider>
      </Page>
    </div>
  );
}

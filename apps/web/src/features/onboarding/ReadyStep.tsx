import { EXPERIENCE_LABELS, GOAL_LABELS, OnboardingStep, SPORTS } from '@rune/contracts';
import { type CSSProperties, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ApiError } from '../../api/client';
import { ONBOARDING_COMPLETED_EVENT } from '../../app-events';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Button, CoachBubble, plural, RankBadge, SystemPanel, useAction } from '../../ui';
import { coachText } from '../coach/coach-lines';
import { OfflineReadyIndicator } from '../status/OfflineReadyIndicator';
import { useReadiness } from '../status/use-readiness';
import { AwakeningQuests, awakeningQuests } from './AwakeningQuests';
import styles from './onboarding.module.css';
import { StepActions } from './StepActions';
import { StepTitle } from './StepTitle';

/** Étincelles autour du rang qui se grave : direction (degrés) et distance (px), décor seulement. */
const SPARKS = [
  { angle: -80, distance: 54 },
  { angle: -35, distance: 62 },
  { angle: 10, distance: 56 },
  { angle: 55, distance: 60 },
  { angle: 100, distance: 52 },
  { angle: 145, distance: 60 },
  { angle: 190, distance: 56 },
  { angle: 235, distance: 62 },
];

/**
 * E8 C'est prêt, en célébration « Éveil terminé » (spec refonte §7, maquette B08, prototype) : la fenêtre du
 * Système s'ouvre, le rang E se grave avec quelques étincelles, les 3 quêtes d'éveil se cochent une à une
 * (vrais états), le coach choisi dit son mot de la fin, puis « Commencer » apparaît ; le récapitulatif suit.
 * Tout est dans la page dès le premier rendu : l'animation (CSS, 600 à 1 200 ms) ne fait que rejouer
 * l'arrivée, et sous mouvement réduit tout arrive en fondu court, sans retard ni étincelles.
 *
 * Le coach ne parle qu'une fois les 3 quêtes remplies : il ne valide pas un éveil encore en cours.
 *
 * « Commencer » termine l'onboarding une fois le voyant « Prêt hors ligne » au vert (R-SYN-33), émet
 * ONBOARDING_COMPLETED_EVENT puis mène à l'accueil ; sinon le voyant dit ce qui manque, avec « Réessayer ».
 * Quand il passe au vert (« Réessayer » réussi ou voyant recalculé en fond), le voyant et « Réessayer » s'en
 * vont : une région polie, là dès le premier rendu, annonce « Prêt hors ligne », et si le focus est retombé
 * sur la page (il était sur « Réessayer »), il passe à « Commencer ».
 * Un écran encore incomplet pour le serveur (409) est rendu à `onIncomplete`, avec l'étape qu'il indique (null
 * si illisible).
 */
export function ReadyStep(p: { onBack(): void; onIncomplete(step: OnboardingStep | null): void }) {
  const repos = useRepos();
  const me = useMe();
  const [, navigate] = useLocation();
  const { readiness, loaded, retry } = useReadiness();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const places = useLive(() => repos.places.list(), [repos]);
  const [retrying, setRetrying] = useState(false);
  const recapId = useId();
  const startButton = useRef<HTMLButtonElement>(null);
  const offlineReady = loaded && readiness.ready;
  const waiting = loaded && !readiness.ready;
  const wasWaiting = useRef(false);
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

  // Voyant passé au vert : « Réessayer » vient de disparaître ; le focus qui y était retombe sur la page, il va
  // alors à « Commencer », désormais actif, dans le même rendu (avant l'affichage). Un focus posé ailleurs
  // (titre, récapitulatif) ne bouge pas.
  useLayoutEffect(() => {
    if (wasWaiting.current && offlineReady) {
      const active = document.activeElement;
      if (active === null || active === document.body) startButton.current?.focus();
    }
    wasWaiting.current = waiting;
  }, [waiting, offlineReady]);

  const primary = places?.find((pl) => pl.isPrimary);
  const quests = awakeningQuests({
    profile,
    hasPrimaryPlace: primary !== undefined,
    offlineReady,
  });
  const allDone = quests.every((q) => q.done);
  const coach = profile?.coach ?? null;
  const sport = profile?.sportCode
    ? profile.sportCode === 'other'
      ? profile.sportOtherLabel
      : SPORTS.find((s) => s.code === profile.sportCode)?.label
    : null;

  return (
    <>
      <StepTitle>C'est prêt</StepTitle>
      <p className={styles.lead}>Vérifie tes choix avant de commencer.</p>
      <div className={styles.celebration}>
        <SystemPanel title="Éveil terminé." headingLevel={3}>
          <div className={styles.awakening}>
            <span className={styles.rankStage}>
              <span className={styles.rank}>
                <RankBadge rank="E" size={72} />
              </span>
              <span className={styles.sparks} aria-hidden="true">
                {SPARKS.map((s) => (
                  <span
                    key={s.angle}
                    className={styles.spark}
                    style={
                      {
                        '--spark-angle': `${s.angle}deg`,
                        '--spark-distance': `${s.distance}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            </span>
            <p className={styles.awakeningText}>
              {allDone
                ? "Quêtes d'éveil remplies. Ta progression commence au rang E."
                : "Quêtes d'éveil en cours. Ta progression commencera au rang E."}
            </p>
          </div>
          <AwakeningQuests quests={quests} />
        </SystemPanel>
      </div>
      {coach && me && allDone ? (
        <div className={styles.coachLine}>
          <CoachBubble coach={coach} label="Message d'accueil">
            <p>{coachText(coach, 'ready', me.username)}</p>
          </CoachBubble>
        </div>
      ) : null}
      {waiting ? (
        <div className={styles.notReady}>
          <OfflineReadyIndicator readiness={readiness} />
          <Button variant="secondary" onClick={onRetry} disabled={retrying}>
            Réessayer
          </Button>
        </div>
      ) : null}
      <p className={styles.srOnly} role="status">
        {offlineReady ? 'Prêt hors ligne' : ''}
      </p>
      {profile ? (
        <section aria-labelledby={recapId} className={styles.recap}>
          <h3 id={recapId}>Récapitulatif</h3>
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
        </section>
      ) : null}
      <StepActions
        className={styles.revealActions}
        onBack={p.onBack}
        pending={start.pending}
        error={start.error}
        primary={{
          label: 'Commencer',
          className: styles.glow,
          ref: startButton,
          disabled: !offlineReady,
          onClick: () => void start.run(),
        }}
      />
    </>
  );
}

import { EXPERIENCE_LABELS, GOAL_LABELS } from '@rune/contracts';
import { useState } from 'react';
import { Link } from 'wouter';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, CoachBubble, CountUp, Page, plural, SystemPanel } from '../../ui';
import { coachLine } from '../coach/coach-lines';
import { AwakeningQuests, awakeningQuests } from '../onboarding/AwakeningQuests';
import { OfflineReadyIndicator } from '../status/OfflineReadyIndicator';
import { useReadiness } from '../status/use-readiness';
import styles from './home.module.css';
import { useNow } from './use-now';

/** R-AGE-6 : affiché une fois par appareil, au passage de mineur à adulte. */
export const ADULT_NOTICE_TEXT =
  "Tu as 18 ans : tu peux désormais choisir l'objectif « Perdre du gras » dans ton profil.";

const parisHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** « Bonjour, {pseudo} » de 5 h à 17 h 59 à l'heure de Paris, « Bonsoir, {pseudo} » le reste du temps. */
function greeting(nowMs: number, pseudo: string): string {
  const hour = Number(parisHour.formatToParts(nowMs).find((part) => part.type === 'hour')?.value);
  return `${hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir'}, ${pseudo}`;
}

function PlaceIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.tileIcon}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className={`${styles.tileIcon} ${styles.rhythmIcon}`}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      className={styles.chevron}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Accueil (spec refonte §10.2, maquettes MixSombre / MixClair, prototype « Accueil ») : salutation selon l'heure
 * de Paris, bandeaux du compte, bulle du coach « Aujourd'hui » avec sa ligne du jour, fenêtre du Système et ses
 * quêtes d'éveil aux vrais états (« Éveil terminé. » à 3/3 seulement, « Éveil en cours. » tant qu'une quête reste
 * ouverte : pull de plus de 24 h, nouvel appareil avant le premier pull), tuiles lieu principal et rythme, ligne
 * objectif et niveau, puis le voyant « Prêt hors ligne » (R-SYN-33). Les cartes, voyant compris, entrent en
 * cascade, d'un bloc, une fois le profil, les lieux et le voyant lus : jamais une fenêtre à 0/3 qu'une bulle
 * viendrait pousser.
 *
 * Aucune fausse donnée : une valeur pas encore connue (profil pas encore reçu sur ce nouvel appareil) n'affiche
 * ni bulle, ni tuile, ni ligne ; une quête n'est cochée que quand son état réel l'est. Le voyant et la quête
 * « Prêt hors ligne » lisent le même calcul. L'heure et le jour viennent de l'horloge des services (injectée
 * dans les tests), relue à chaque minute pleine (`useNow`) : un accueil resté ouvert dit « Bonsoir » dès 18 h et
 * passe à la ligne du lendemain dès minuit, sans dépendre d'un autre rendu.
 */
export function HomePage() {
  const me = useMe();
  const repos = useRepos();
  const now = useNow();
  const adultNotice = useLive(() => repos.me.adultNotice(), [repos]);
  const profile = useLive(() => repos.profile.get(), [repos]);
  const places = useLive(() => repos.places.list(), [repos]);
  const { readiness, loaded, retry } = useReadiness();
  const [retrying, setRetrying] = useState(false);
  if (!me) return null;

  const onRetry = () => {
    setRetrying(true);
    void retry().finally(() => setRetrying(false));
  };
  const primary = places?.find((place) => place.isPrimary);
  const quests = awakeningQuests({
    profile,
    hasPrimaryPlace: primary !== undefined,
    offlineReady: loaded && readiness.ready,
  });
  const coach = profile?.coach ?? null;
  const days = profile?.daysPerWeek ?? null;
  const goal = profile?.goal ?? null;
  const experience = profile?.experience ?? null;
  // Lectures locales faites (profil, même absent, lieux, voyant) : la pile entre alors d'un bloc, en cascade.
  const readsDone = profile !== undefined && places !== undefined && loaded;

  return (
    <Page title={greeting(now, me.username)}>
      {me.passwordReminderDue ? (
        <Banner tone="warning">Pense à changer ton mot de passe (rappel annuel).</Banner>
      ) : null}
      {adultNotice ? (
        <Banner tone="info">
          <p className={styles.notice}>{ADULT_NOTICE_TEXT}</p>
          <Button variant="secondary" onClick={() => void repos.me.dismissAdultNotice()}>
            J'ai compris
          </Button>
        </Banner>
      ) : null}
      {readsDone ? (
        <div className={`${styles.cards} stagger`}>
          {coach ? (
            <CoachBubble coach={coach} label="Aujourd'hui">
              <p>{coachLine(coach, 'daily', new Date(now), me.username, days)}</p>
            </CoachBubble>
          ) : null}
          <SystemPanel title={quests.every((q) => q.done) ? 'Éveil terminé.' : 'Éveil en cours.'}>
            <div className={styles.awakening}>
              <p>Tes programmes et tes séances arriveront ici.</p>
              <AwakeningQuests quests={quests} />
            </div>
          </SystemPanel>
          {primary || days !== null ? (
            <div className={styles.tiles}>
              {primary ? (
                <Link href={`/places/${primary.id}`} className={styles.tile}>
                  <PlaceIcon />
                  <span className={styles.tileKey}>Lieu principal</span>{' '}
                  <span className={styles.tileValue}>{primary.name}</span>
                </Link>
              ) : null}
              {days !== null ? (
                <Link href="/profile" className={styles.tile}>
                  <CalendarIcon />
                  <span className={styles.tileKey}>Rythme</span>{' '}
                  <span className={styles.tileNumber}>
                    <CountUp to={days} />
                    <small aria-hidden="true">{` ${plural(days, 'séance', 'séances')} / sem.`}</small>
                    <span
                      className={styles.srOnly}
                    >{` ${plural(days, 'séance', 'séances')} par semaine`}</span>
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
          {goal && experience ? (
            <Link href="/profile" className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.tileKey}>Objectif · niveau</span>{' '}
                <span
                  className={styles.rowValue}
                >{`${GOAL_LABELS[goal]} · ${EXPERIENCE_LABELS[experience]}`}</span>
              </span>
              <Chevron />
            </Link>
          ) : null}
          <div className={styles.readiness}>
            <OfflineReadyIndicator readiness={readiness} />
            {readiness.ready ? null : (
              <Button variant="secondary" block onClick={onRetry} disabled={retrying}>
                Réessayer
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Page>
  );
}

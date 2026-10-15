import type { CoachId } from '@rune/contracts';
import { useCallback, useEffect, useId, useState } from 'react';
import { useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { useTrainingProfile } from '../../repos/use-training-profile';
import {
  Banner,
  BottomSheet,
  Button,
  COACH_NAMES,
  CoachAvatar,
  CoachBubble,
  Page,
  useAction,
} from '../../ui';
import { useFocusAfterClose } from '../profile/use-focus-after-close';
import { CoachChoices } from './CoachStep';
import { COACHES, coachText } from './coach-lines';
import styles from './my-coach.module.css';

/** Mon coach dit que la vraie conversation viendra plus tard (spec refonte §8, prototype). */
export const COACH_LATER_TEXT =
  "Pour l'instant, ton coach parle avec des messages préparés à l'avance. La vraie conversation arrivera plus tard.";

/** Bouton de confirmation de la feuille, le nom du coach en complément (prototype). */
const CHOOSE_LABELS: Readonly<Record<CoachId, string>> = {
  ombre: "Choisir L'Ombre",
  skald: 'Choisir le Skald',
  scribe: 'Choisir le Scribe',
};

const ignore = () => {};

/**
 * Profil › Mon coach (spec refonte §8, prototype « Mon coach ») : le coach choisi, ses deux avatars
 * (entraînement et nutrition), son nom, son tempérament et un aperçu de sa voix étiqueté, puis la mention que
 * la vraie conversation viendra plus tard. « Changer de coach » ouvre une feuille avec les trois choix ;
 * confirmer l'enregistre sur le serveur (`setCoach`, classe E). Le coach confirmé s'affiche tout de suite,
 * jusqu'à la relecture du profil (pull après l'envoi), avec « <coach> est ton nouveau coach. », qui reste tant
 * qu'une relecture ne le contredit pas. Sur un nouvel appareil avant le premier pull, le miroir vide ne dit pas
 * « pas de coach » : ni coach ni « Changer de coach » tant que le profil n'est pas connu.
 */
export function MyCoachPage() {
  const me = useMe();
  const { coach: saved, loaded, known } = useTrainingProfile();
  const [chosen, setChosen] = useState<CoachId | null>(null);
  const [announced, setAnnounced] = useState<CoachId | null>(null);
  const [sheet, setSheet] = useState(false);
  const changeId = useId();
  const closeSheet = useCallback(() => setSheet(false), []);
  useFocusAfterClose(sheet, () => document.getElementById(changeId));

  // Toute relecture du coach enregistré fait de nouveau foi : le choix affiché s'efface, et l'annonce aussi
  // quand la relecture la contredit (un autre appareil a choisi un autre coach depuis).
  useEffect(() => {
    setChosen(null);
    setAnnounced((c) => (c === saved ? c : null));
  }, [saved]);

  // Rien avant la lecture du profil : la feuille ouverte trop tôt n'aurait pas le coach actuel.
  if (!me || !loaded) return null;
  const coach = chosen ?? saved;
  // L'annonce ne vaut que pour le coach affiché, dès le rendu qui le change (avant l'effet qui l'efface).
  const notice = announced !== null && announced === coach ? announced : null;

  function changed(next: CoachId) {
    setChosen(next);
    setAnnounced(next);
    setSheet(false);
  }

  return (
    <Page title="Mon coach" back="/profile">
      {notice ? <Banner tone="info">{`${COACH_NAMES[notice]} est ton nouveau coach.`}</Banner> : null}
      {known && coach ? <CoachHero key={coach} coach={coach} pseudo={me.username} /> : null}
      <p className={styles.later}>
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>{COACH_LATER_TEXT}</span>
      </p>
      {known ? (
        <>
          <Button
            id={changeId}
            variant="secondary"
            block
            onClick={() => {
              setAnnounced(null);
              setSheet(true);
            }}
          >
            Changer de coach
          </Button>
          <ChangeCoachSheet
            open={sheet}
            current={coach}
            pseudo={me.username}
            onClose={closeSheet}
            onChanged={changed}
          />
        </>
      ) : null}
    </Page>
  );
}

/**
 * Le coach en grand : ses deux avatars, nommés (« Le Skald », « Le Skald, mode nutrition ») et légendés
 * Entraînement et Nutrition, puis son nom, son tempérament et l'aperçu de sa voix. Remonté à chaque changement
 * de coach : les avatars grandissent de nouveau (un fondu sous mouvement réduit).
 */
function CoachHero(p: { coach: CoachId; pseudo: string }) {
  const nameId = useId();
  const texts = COACHES[p.coach];
  return (
    <section aria-labelledby={nameId} className={styles.hero}>
      <div className={styles.avatars}>
        <figure className={styles.figure}>
          <span className={styles.grow}>
            <CoachAvatar coach={p.coach} size={112} animated="brief" />
          </span>
          <figcaption className={styles.caption}>
            <i className={styles.diamond} data-tone="training" aria-hidden="true" />
            Entraînement
          </figcaption>
        </figure>
        <figure className={styles.figure}>
          <span className={styles.grow}>
            <CoachAvatar coach={p.coach} mode="nutrition" size={112} animated="brief" />
          </span>
          <figcaption className={styles.caption}>
            <i className={styles.diamond} data-tone="nutrition" aria-hidden="true" />
            Nutrition
          </figcaption>
        </figure>
      </div>
      <div className={styles.identity}>
        <h2 id={nameId} className={styles.name}>
          {texts.name}
        </h2>
        <p className={styles.temper}>{texts.temper}</p>
      </div>
      <CoachBubble coach={p.coach} label="Aperçu">
        {coachText(p.coach, 'sample', p.pseudo)}
      </CoachBubble>
    </section>
  );
}

type SheetProps = {
  open: boolean;
  current: CoachId | null;
  pseudo: string;
  onClose(): void;
  onChanged(coach: CoachId): void;
};

/**
 * Feuille « Changer de coach » : les trois coachs en cartes, l'actuel coché ; la confirmation, désactivée tant
 * que le choix est l'actuel, enregistre le nouveau coach. Pendant l'envoi, cartes et boutons sont figés et
 * Échap ne ferme pas ; un échec (hors ligne, serveur) laisse la feuille ouverte avec le message. Fermée, rien
 * n'est monté : chaque ouverture repart du coach actuel. Tant que rien n'est choisi, le coché suit le coach
 * actuel, même relu pendant que la feuille est ouverte (un autre appareil en a changé).
 */
function ChangeCoachSheet(p: SheetProps) {
  return p.open ? <OpenCoachSheet {...p} /> : null;
}

function OpenCoachSheet(p: SheetProps) {
  const repos = useRepos();
  const [picked, setPicked] = useState<CoachId | null>(null);
  const pick = picked ?? p.current;
  const save = useAction(async (coach: CoachId) => {
    await repos.profile.setCoach(coach);
    return true;
  });
  const next = pick !== null && pick !== p.current ? pick : null;

  async function confirm() {
    if (next === null) return;
    if (await save.run(next)) p.onChanged(next);
  }

  return (
    <BottomSheet
      open
      title="Changer de coach"
      onClose={save.pending ? ignore : p.onClose}
      actions={
        <>
          <Button disabled={next === null || save.pending} onClick={() => void confirm()}>
            {next !== null
              ? CHOOSE_LABELS[next]
              : p.current === null
                ? 'Choisis un coach'
                : 'Choisis un autre coach'}
          </Button>
          <Button variant="secondary" disabled={save.pending} onClick={p.onClose}>
            Annuler
          </Button>
        </>
      }
    >
      <div className={styles.sheetBody}>
        <CoachChoices
          name="coach-change"
          legend="Ton historique et tes rangs restent intacts. Seul le ton change."
          pseudo={p.pseudo}
          value={pick}
          disabled={save.pending}
          onChange={(coach) => {
            setPicked(coach);
            save.reset();
          }}
        />
        {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      </div>
    </BottomSheet>
  );
}

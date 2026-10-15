import type { GymDetail } from '@rune/contracts';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Link } from 'wouter';
import { useLive, useMe } from '../../app-services';
import { type PlaceView, useRepos } from '../../repos';
import { Page, plural } from '../../ui';
import { GymHistory } from './GymHistory';
import { MemberAvatars, membersOrder } from './GymMembers';
import { GymPicker } from './GymPicker';
import { HomeCreate } from './HomeCreate';
import { ChevronIcon, GymIcon, HomeIcon, PlusIcon, StarIcon } from './icons';
import { PRIMARY_NOTE } from './PlaceActions';
import styles from './places.module.css';
import { SubScreen, useSubScreen } from './SubScreen';

/** Entrées de l'historique montrées sous « Mes lieux » ; la fiche de la salle en montre davantage. */
export const PLACES_ACTIVITY_LIMIT = 3;

/**
 * Fiches en ligne des salles `gymIds` (membres visibles, historique), lues une fois par liste de salles.
 * Hors ligne ou en échec : rien, l'écran n'invente aucun chiffre.
 */
function useGymDetails(gymIds: readonly string[]): ReadonlyMap<string, GymDetail> {
  const repos = useRepos();
  const key = [...gymIds].sort().join(' ');
  const [details, setDetails] = useState<ReadonlyMap<string, GymDetail>>(() => new Map());
  useEffect(() => {
    let current = true;
    const ids = key === '' ? [] : key.split(' ');
    void Promise.all(
      ids.map((id) =>
        repos.gyms.detail(id).then(
          (r) => (r.offline ? null : ([id, r.detail] as const)),
          () => null,
        ),
      ),
    ).then((entries) => {
      if (current) setDetails(new Map(entries.filter((e) => e !== null)));
    });
    return () => {
      current = false;
    };
  }, [repos, key]);
  return details;
}

/**
 * Salles › Mes lieux (maquette D01, 02 §11) : le lieu principal d'abord ; toucher une salle ouvre directement
 * sa fiche, une maison la sienne (spec refonte §10.3), où vivent leurs actions. Dessous, l'ajout d'une salle
 * ou d'une maison (écrans ouverts sur place, focus rendu au bouton au retour), puis les dernières
 * modifications de la salle principale quand elles sont lisibles en ligne.
 */
export function PlacesPage() {
  const repos = useRepos();
  const me = useMe();
  const places = useLive(() => repos.places.list(), [repos]);
  const sub = useSubScreen<'gym' | 'home'>();
  const listId = useId();
  const addId = useId();
  const activityId = useId();
  const addGymId = useId();
  const addHomeId = useId();
  const gymIds = (places ?? []).flatMap((pl) => (pl.kind === 'gym' && pl.gymId ? [pl.gymId] : []));
  const details = useGymDetails(gymIds);

  if (!me || places === undefined) return null;

  if (sub.mode === 'gym') {
    return (
      <SubScreen title="Ajouter une salle" onBack={sub.close}>
        <GymPicker isPrimary={false} defaultVisible={me.ageBand !== 'minor'} onDone={sub.close} />
      </SubScreen>
    );
  }
  if (sub.mode === 'home') {
    return (
      <SubScreen title="Ajouter une maison" onBack={sub.close}>
        <HomeCreate onDone={sub.close} />
      </SubScreen>
    );
  }

  const featured =
    places.find((pl) => pl.isPrimary && pl.kind === 'gym') ?? places.find((pl) => pl.kind === 'gym');
  const activity = featured?.gymId ? details.get(featured.gymId) : undefined;

  return (
    <div className={sub.back ? styles.screenBack : undefined}>
      <Page title="Salles">
        <section aria-labelledby={listId} className={styles.group}>
          <div className={styles.groupHead}>
            <h2 id={listId} className={styles.groupTitle}>
              Mes lieux
            </h2>
            <span className={styles.groupMeta}>
              {places.length} {plural(places.length, 'lieu', 'lieux')}
            </span>
          </div>
          {places.length > 0 ? (
            <ul className={`stagger ${styles.placeList}`}>
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  detail={place.gymId ? details.get(place.gymId) : undefined}
                  me={me.username}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>Aucun lieu.</p>
          )}
          <p className={styles.primaryNote}>
            <StarIcon size={16} />
            <span>{PRIMARY_NOTE}</span>
          </p>
        </section>
        <section aria-labelledby={addId} className={styles.group}>
          <h2 id={addId} className={styles.groupTitle}>
            Ajouter un lieu
          </h2>
          <div className={styles.addGrid}>
            <AddTile
              id={addGymId}
              kind="gym"
              icon={<GymIcon size={22} />}
              title="Ajouter une salle"
              text="Partagée avec le cercle"
              onClick={() => sub.open('gym', addGymId)}
            />
            <AddTile
              id={addHomeId}
              kind="home"
              icon={<HomeIcon size={22} />}
              title="Ajouter une maison"
              text="Ton matériel à toi"
              onClick={() => sub.open('home', addHomeId)}
            />
          </div>
        </section>
        {featured?.gymId && activity && activity.history.length > 0 ? (
          <section aria-labelledby={activityId} className={styles.group}>
            <div className={styles.groupHead}>
              <h2 id={activityId} className={styles.groupTitle}>
                Dernières modifications
              </h2>
              <Link href={`/gyms/${featured.gymId}`} className={styles.groupLink}>
                Voir la salle
              </Link>
            </div>
            <div className={styles.card}>
              <GymHistory entries={activity.history.slice(0, PLACES_ACTIVITY_LIMIT)} />
            </div>
          </section>
        ) : null}
      </Page>
    </div>
  );
}

/**
 * Carte d'un lieu : un seul lien, nommé par le lieu et décrit par sa ligne (« Salle · Lyon », « Principal »).
 * Une salle montre aussi son matériel et, en ligne, ses membres visibles.
 */
function PlaceCard(p: { place: PlaceView; detail: GymDetail | undefined; me: string }) {
  const { place } = p;
  const nameId = useId();
  const metaId = useId();
  const gym = place.kind === 'gym';
  const href = gym && place.gymId ? `/gyms/${place.gymId}` : `/places/${place.id}`;
  const n = place.equipment.length;
  const equipment = plural(n, 'équipement', 'équipements');
  const meta = gym ? (place.city ? `Salle · ${place.city}` : 'Salle') : `Maison · ${n} ${equipment}`;
  const members = p.detail?.visibleMembers;
  return (
    <li>
      <Link
        href={href}
        aria-labelledby={nameId}
        aria-describedby={metaId}
        className={styles.placeCard}
        data-kind={place.kind}
      >
        <span className={styles.placeRow}>
          <span className={styles.placeIcon} aria-hidden="true">
            {gym ? <GymIcon /> : <HomeIcon />}
          </span>
          <span className={styles.placeText}>
            <span id={nameId} className={styles.placeName}>
              {place.name}
            </span>
            <span id={metaId} className={styles.placeMeta}>
              <span>{meta}</span>
              {place.isPrimary ? (
                <span className={styles.primaryBadge}>
                  <StarIcon size={13} />
                  Principal
                </span>
              ) : null}
            </span>
          </span>
          <span className={styles.placeChevron}>
            <ChevronIcon />
          </span>
        </span>
        {gym ? (
          <span className={styles.placeFoot}>
            <span className={styles.placeCount}>
              <span className={styles.bigNumber}>{n}</span>
              <span>{equipment}</span>
            </span>
            {members ? (
              <span className={styles.placeMembers}>
                <MemberAvatars names={membersOrder(members, p.me)} />
                <span>
                  {members.length} {plural(members.length, 'membre visible', 'membres visibles')}
                </span>
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Tuile d'ajout (maquette D01) : un bouton nommé par son titre, décrit par sa phrase. */
function AddTile(p: {
  id: string;
  kind: 'gym' | 'home';
  icon: ReactNode;
  title: string;
  text: string;
  onClick(): void;
}) {
  const titleId = useId();
  const textId = useId();
  return (
    <button
      id={p.id}
      type="button"
      aria-labelledby={titleId}
      aria-describedby={textId}
      className={styles.addTile}
      data-kind={p.kind}
      onClick={p.onClick}
    >
      <span className={styles.addTileTop}>
        <span className={styles.addTileIcon} aria-hidden="true">
          {p.icon}
        </span>
        <span className={styles.addTilePlus}>
          <PlusIcon />
        </span>
      </span>
      <span className={styles.addTileText}>
        <span id={titleId} className={styles.addTileTitle}>
          {p.title}
        </span>
        <span id={textId} className={styles.addTileHint}>
          {p.text}
        </span>
      </span>
    </button>
  );
}

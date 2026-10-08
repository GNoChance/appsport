import type { EquipmentCode } from '@appsport/contracts';
import { useEffect, useId, useState } from 'react';
import { Link } from 'wouter';
import { useLive } from '../../app-services';
import { type PlaceView, useRepos } from '../../repos';
import { Banner, Page, useAction } from '../../ui';
import { EquipmentChecklist, EquipmentList } from './EquipmentChecklist';
import styles from './places.module.css';

/**
 * Fiche d'un lieu (Profil › Lieux) : le matériel d'une maison se coche ici (R-LIEU-3) ; une salle
 * renvoie à sa fiche partagée, où se modifie son matériel (R-LIEU-2).
 */
export function PlaceDetail(p: { params: { id: string } }) {
  const repos = useRepos();
  const id = p.params.id;
  const place = useLive(() => repos.places.get(id), [repos, id]);
  if (place === undefined) return null;
  if (place === null) {
    return (
      <Page title="Lieu" back="/profile/places">
        <p>Lieu introuvable.</p>
      </Page>
    );
  }
  return place.kind === 'home' ? <HomeDetail place={place} /> : <GymPlaceDetail place={place} />;
}

/** « Salle · Lyon · lieu principal », « Maison ». */
const placeMeta = (place: PlaceView) =>
  [place.kind === 'gym' ? 'Salle' : 'Maison', place.city, place.isPrimary ? 'lieu principal' : null]
    .filter(Boolean)
    .join(' · ');

/**
 * Matériel d'une maison : chaque case envoie un ajout (PUT) ou un retrait (DELETE). La case suit
 * le choix pendant l'envoi et jusqu'à la lecture suivante du miroir ; un échec la remet.
 */
function HomeDetail(p: { place: PlaceView }) {
  const repos = useRepos();
  const titleId = useId();
  const [draft, setDraft] = useState<EquipmentCode[] | null>(null);
  const toggle = useAction(async (code: EquipmentCode, present: boolean) => {
    await repos.places.setEquipment(p.place.id, code, present);
    return true;
  });

  // Miroir relu (pull après l'envoi) : il fait foi.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du lieu efface le brouillon
  useEffect(() => setDraft(null), [p.place]);

  async function change(next: EquipmentCode[]) {
    const current = draft ?? p.place.equipment;
    const added = next.find((c) => !current.includes(c));
    const code = added ?? current.find((c) => !next.includes(c));
    if (code === undefined) return;
    setDraft(next);
    if (!(await toggle.run(code, added !== undefined))) setDraft(null);
  }

  return (
    <Page title={p.place.name} back="/profile/places">
      <p className={styles.meta}>{placeMeta(p.place)}</p>
      <section aria-labelledby={titleId} className={styles.section}>
        <h2 id={titleId}>Matériel</h2>
        <p className={styles.hint}>Coche le matériel disponible dans ce lieu.</p>
        {toggle.error ? <Banner tone="error">{toggle.error}</Banner> : null}
        <EquipmentChecklist
          kind="home"
          value={draft ?? p.place.equipment}
          onChange={(next) => void change(next)}
          disabled={toggle.pending}
        />
      </section>
    </Page>
  );
}

/** Lieu de type salle : matériel de la salle en lecture, lien vers sa fiche. */
function GymPlaceDetail(p: { place: PlaceView }) {
  const titleId = useId();
  return (
    <Page title={p.place.name} back="/profile/places">
      <p className={styles.meta}>{placeMeta(p.place)}</p>
      <section aria-labelledby={titleId} className={styles.section}>
        <h2 id={titleId}>Matériel</h2>
        <EquipmentList value={p.place.equipment} />
        <p className={styles.hint}>
          Le matériel d'une salle se modifie sur sa fiche, partagée par ses membres.
        </p>
        {p.place.gymId ? <Link href={`/gyms/${p.place.gymId}`}>Voir la salle</Link> : null}
      </section>
    </Page>
  );
}

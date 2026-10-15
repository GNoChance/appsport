import { useId } from 'react';
import { Redirect } from 'wouter';
import { useLive } from '../../app-services';
import { type PlaceView, useRepos } from '../../repos';
import { Page, plural } from '../../ui';
import { EquipmentChips } from './EquipmentChips';
import { EquipmentEditor } from './EquipmentEditor';
import { PencilIcon } from './icons';
import { PlaceActions } from './PlaceActions';
import styles from './places.module.css';
import { useSubScreen } from './SubScreen';

/**
 * Fiche d'un lieu. Une maison (maquette D05) : son matériel, son nom, « Lieu principal » et sa suppression.
 * Un lieu de type salle n'a pas de fiche à lui : son adresse est remplacée par celle de la fiche de la salle,
 * qui porte ses actions (spec refonte §10.3).
 */
export function PlaceDetail(p: { params: { id: string } }) {
  const repos = useRepos();
  const id = p.params.id;
  const places = useLive(() => repos.places.list(), [repos]);
  if (places === undefined) return null;
  const place = places.find((pl) => pl.id === id);
  if (place?.kind === 'gym' && place.gymId) return <Redirect to={`/gyms/${place.gymId}`} replace />;
  if (place?.kind !== 'home') {
    return (
      <Page title="Lieu" back="/places">
        <p>Lieu introuvable.</p>
      </Page>
    );
  }
  return <HomeSheet place={place} places={places} />;
}

/**
 * Fiche d'une maison : « Modifier le matériel » ouvre l'écran Matériel (brouillon, R-LIEU-3), dont le retour
 * rend le focus au bouton.
 */
function HomeSheet(p: { place: PlaceView; places: readonly PlaceView[] }) {
  const repos = useRepos();
  const { place } = p;
  const sub = useSubScreen<'equipment'>();
  const materialId = useId();
  const editId = useId();
  const n = place.equipment.length;

  if (sub.mode === 'equipment') {
    return (
      <EquipmentEditor
        kind="home"
        placeName={place.name}
        initial={place.equipment}
        send={(code, present) => repos.places.setEquipment(place.id, code, present)}
        // Chaque envoi relit le miroir (pull), que la fiche observe : rien de plus à relire.
        reread={async () => {}}
        onSaved={sub.close}
        onBack={sub.close}
      />
    );
  }

  return (
    <div className={sub.back ? styles.screenBack : undefined}>
      <Page title={place.name} back="/places">
        <p className={styles.subtitle}>{`Maison · ${n} ${plural(n, 'équipement', 'équipements')}`}</p>
        <div className={`stagger ${styles.stack}`}>
          <section aria-labelledby={materialId} className={styles.card}>
            <div className={styles.cardHead}>
              <h2 id={materialId} className={styles.cardTitle}>
                Matériel
              </h2>
              <span className={styles.countBadge}>
                {n}
                <span className={styles.srOnly}> {plural(n, 'équipement', 'équipements')}</span>
              </span>
              <button
                id={editId}
                type="button"
                className={styles.smallButton}
                onClick={() => sub.open('equipment', editId)}
              >
                <PencilIcon size={16} />
                Modifier<span className={styles.srOnly}> le matériel</span>
              </button>
            </div>
            <EquipmentChips kind="home" value={place.equipment} />
          </section>
          <PlaceActions place={place} places={p.places} />
        </div>
      </Page>
    </div>
  );
}

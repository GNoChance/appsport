import { useId } from 'react';
import { useLive } from '../../app-services';
import { type RejectionView, useRepos } from '../../repos';
import { Banner, Button, formatDateTime, Page, useAction } from '../../ui';
import styles from './status.module.css';

/** Libellé d'un code de rejet de synchro (R-SYN-18) ; un code inconnu s'affiche tel quel. */
export const REJECTION_CODE_LABELS: Record<string, string> = {
  validation: 'Données invalides',
  forbidden: 'Action non autorisée',
  parent_rejected: 'Élément parent refusé',
  stale_revision: 'Version périmée',
  unknown_entity: 'Type de donnée inconnu',
  protocol: "Version de l'appli trop ancienne",
};

/** Type de donnée d'un rejet ; un type inconnu s'affiche sous son nom. */
export const ENTITY_LABELS: Record<string, string> = {
  sync_rejection: 'Refus',
  training_profile: "Profil d'entraînement",
  health_screening: "Questionnaire d'alerte",
  limitation: 'Limitation',
  gym: 'Salle',
  gym_equipment: 'Matériel de salle',
  place: 'Lieu',
  home_equipment: 'Matériel à la maison',
};

/** Opération refusée (`kind` du détail). */
const KIND_LABELS: Record<string, string> = {
  create: 'création',
  patch: 'modification',
  delete: 'suppression',
  restore_upsert: 'restauration',
};

const labelOf = (labels: Record<string, string>, key: string): string =>
  Object.hasOwn(labels, key) ? (labels[key] ?? key) : key;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Détail d'un rejet (R-SYN-18), sans aucune valeur : type de donnée, opération et noms des champs
 * (`{ kind, fieldNames }` du serveur ou de la deadletter), « Lieu · modification · champs : name ».
 * Détail absent ou d'une autre forme : ce qui est lisible seulement.
 */
export function rejectionDetail(r: Pick<RejectionView, 'entity' | 'detail'>): string {
  const parts: string[] = [];
  if (r.entity !== '') parts.push(labelOf(ENTITY_LABELS, r.entity));
  const detail = isRecord(r.detail) ? r.detail : {};
  if (typeof detail.kind === 'string' && detail.kind !== '') parts.push(labelOf(KIND_LABELS, detail.kind));
  const fields = Array.isArray(detail.fieldNames)
    ? detail.fieldNames.filter((f): f is string => typeof f === 'string' && f !== '')
    : [];
  if (fields.length > 0) parts.push(`${fields.length === 1 ? 'champ' : 'champs'} : ${fields.join(', ')}`);
  return parts.join(' · ');
}

const TITLE = 'Éléments refusés';

/**
 * Rejets de synchro (R-SYN-18) : rejets du serveur non écartés et rejets reçus au push sur cet
 * appareil, chacun avec son détail. « Ignorer » écarte un rejet (écriture atomique du dépôt),
 * jamais en silence.
 */
export function RejectionsPage() {
  const repos = useRepos();
  const rejections = useLive(() => repos.rejections.list(), [repos]);
  const dismiss = useAction((id: string) => repos.rejections.dismiss(id));
  const listId = useId();
  return (
    <Page title={TITLE} back="/">
      {dismiss.error ? <Banner tone="error">{dismiss.error}</Banner> : null}
      {rejections === undefined ? null : rejections.length === 0 ? (
        <p>Aucun refus.</p>
      ) : (
        <>
          <p>Le serveur a refusé ces modifications : elles n'ont pas été enregistrées.</p>
          <ul aria-label={TITLE} className={styles.rejections}>
            {rejections.map((r) => (
              <RejectionItem
                key={r.id}
                rejection={r}
                labelId={`${listId}-${r.id}`}
                busy={dismiss.pending}
                onDismiss={() => void dismiss.run(r.id)}
              />
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

/** Un rejet : code, détail et date, qui décrivent aussi son « Ignorer » (deux refus de même code restent distincts). */
function RejectionItem(p: { rejection: RejectionView; labelId: string; busy: boolean; onDismiss(): void }) {
  const { rejection: r } = p;
  const detail = rejectionDetail(r);
  return (
    <li className={styles.rejection}>
      {/* Espaces entre les parties : la description de « Ignorer » ne les colle pas (invisibles en flex). */}
      <div id={p.labelId}>
        <strong>{labelOf(REJECTION_CODE_LABELS, r.code)}</strong>{' '}
        {detail !== '' ? <span>{detail}</span> : null}{' '}
        {r.at ? <span className={styles.meta}>{`Refusé le ${formatDateTime(r.at)}`}</span> : null}
      </div>
      <Button variant="secondary" aria-describedby={p.labelId} disabled={p.busy} onClick={p.onDismiss}>
        Ignorer
      </Button>
    </li>
  );
}

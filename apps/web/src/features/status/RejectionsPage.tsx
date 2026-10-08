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

const codeLabel = (code: string): string =>
  Object.hasOwn(REJECTION_CODE_LABELS, code) ? (REJECTION_CODE_LABELS[code] ?? code) : code;

const TITLE = 'Éléments refusés';

/**
 * Rejets de synchro (R-SYN-18) : rejets du serveur non écartés et rejets reçus au push sur cet
 * appareil. « Ignorer » écarte un rejet (écriture atomique du dépôt), jamais en silence.
 */
export function RejectionsPage() {
  const repos = useRepos();
  const rejections = useLive(() => repos.rejections.list(), [repos]);
  const dismiss = useAction((id: string) => repos.rejections.dismiss(id));
  const listId = useId();
  return (
    <Page title={TITLE} back="/">
      <p>Le serveur a refusé ces modifications : elles n'ont pas été enregistrées.</p>
      {dismiss.error ? <Banner tone="error">{dismiss.error}</Banner> : null}
      {rejections === undefined ? null : rejections.length === 0 ? (
        <p>Aucun refus.</p>
      ) : (
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
      )}
    </Page>
  );
}

function RejectionItem(p: { rejection: RejectionView; labelId: string; busy: boolean; onDismiss(): void }) {
  const { rejection: r } = p;
  return (
    <li className={styles.rejection}>
      <div>
        <strong id={p.labelId}>{codeLabel(r.code)}</strong>
        {r.at ? <span className={styles.meta}>{`Refusé le ${formatDateTime(r.at)}`}</span> : null}
      </div>
      <Button variant="secondary" aria-describedby={p.labelId} disabled={p.busy} onClick={p.onDismiss}>
        Ignorer
      </Button>
    </li>
  );
}

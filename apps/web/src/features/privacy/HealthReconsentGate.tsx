import { HEALTH_CONSENT_TEXT } from '@appsport/contracts';
import { useCallback, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, Dialog, useAction } from '../../ui';
import { ConsentWithdrawDialog } from './ConsentWithdrawDialog';
import styles from './privacy.module.css';

const ignore = () => {};

/**
 * Accord santé donné sur une version majeure antérieure du texte (R-CST-6, P-CST-1) : le texte en
 * vigueur est redemandé, case décochée. Seul l'accord ou le retrait lèvent la porte : pas de
 * fermeture, Échap sans effet ; « Je refuse » ouvre le retrait (mot de passe, P-AUT-5), et ce
 * dialogue fermé sans retrait ramène la porte. Rien pendant le changement de mot de passe imposé.
 */
export function HealthReconsentGate() {
  const repos = useRepos();
  const me = useMe();
  const needed = useLive(() => repos.consent.needsHealthReconsent(), [repos]);
  const [refusing, setRefusing] = useState(false);
  const backToGate = useCallback(() => setRefusing(false), []);

  // Le retrait ouvert reste affiché jusqu'à sa fermeture, même une fois l'accord retiré.
  if (refusing) return <ConsentWithdrawDialog open onClose={backToGate} />;
  if (needed !== true || !me || me.mustChangePassword) return null;
  return <ReconsentDialog onRefuse={() => setRefusing(true)} />;
}

function ReconsentDialog(p: { onRefuse(): void }) {
  const repos = useRepos();
  const [agreed, setAgreed] = useState(false);
  const grant = useAction(() => repos.consent.grantHealth());
  return (
    <Dialog
      open
      title="Le texte de l'accord santé a changé"
      onClose={ignore}
      actions={
        <>
          <Button variant="secondary" disabled={grant.pending} onClick={p.onRefuse}>
            Je refuse
          </Button>
          <Button disabled={!agreed || grant.pending} onClick={() => void grant.run()}>
            J'accepte
          </Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        <p>
          Relis le nouveau texte. Refuser revient à retirer ton accord : tes données de santé seront effacées.
        </p>
        <label className={styles.check}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{HEALTH_CONSENT_TEXT.text}</span>
        </label>
        {grant.error ? <Banner tone="error">{grant.error}</Banner> : null}
      </div>
    </Dialog>
  );
}

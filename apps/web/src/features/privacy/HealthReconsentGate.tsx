import { HEALTH_CONSENT_TEXT } from '@appsport/contracts';
import { useCallback, useState } from 'react';
import { useLive, useMe, useSyncState } from '../../app-services';
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
 * L'écran derrière est inerte (`inertOutside`) : aucune donnée de santé n'y est saisie sous
 * l'ancien texte, même au curseur virtuel d'un lecteur d'écran.
 *
 * Les deux réponses demandent le réseau (classe E) : la porte ne se lève qu'en ligne, d'après le
 * moteur de synchro ; hors ligne, l'appli reste utilisable et l'accord en cours vaut toujours. Une
 * fois levée, elle reste ; réseau perdu, « Nécessite le réseau » et ses boutons attendent.
 */
export function HealthReconsentGate() {
  const repos = useRepos();
  const me = useMe();
  const { connection } = useSyncState();
  const needed = useLive(() => repos.consent.needsHealthReconsent(), [repos]);
  const [refusing, setRefusing] = useState(false);
  const [raised, setRaised] = useState(false);
  const backToGate = useCallback(() => setRefusing(false), []);
  const online = connection === 'online';
  const due = needed === true && me !== null && !me.mustChangePassword;
  // État dérivé : levée au premier rendu en ligne, retombée une fois l'accord à jour.
  if (due && online && !raised) setRaised(true);
  if (!due && raised) setRaised(false);

  // Le retrait ouvert reste affiché jusqu'à sa fermeture, même une fois l'accord retiré.
  if (refusing) return <ConsentWithdrawDialog open onClose={backToGate} />;
  if (!due || !(raised || online)) return null;
  return <ReconsentDialog offline={!online} onRefuse={() => setRefusing(true)} />;
}

function ReconsentDialog(p: { offline: boolean; onRefuse(): void }) {
  const repos = useRepos();
  const [agreed, setAgreed] = useState(false);
  const grant = useAction(() => repos.consent.grantHealth());
  const waiting = grant.pending || p.offline;
  return (
    <Dialog
      open
      inertOutside
      title="Le texte de l'accord santé a changé"
      onClose={ignore}
      actions={
        <>
          <Button variant="secondary" disabled={waiting} onClick={p.onRefuse}>
            Je refuse
          </Button>
          <Button disabled={!agreed || waiting} onClick={() => void grant.run()}>
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
        {p.offline ? <Banner tone="warning">Nécessite le réseau</Banner> : null}
        {grant.error ? <Banner tone="error">{grant.error}</Banner> : null}
      </div>
    </Dialog>
  );
}

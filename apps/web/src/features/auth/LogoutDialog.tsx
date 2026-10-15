import { useId, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, BottomSheet, Button, ChoiceCard, errorMessage } from '../../ui';
import { DevicesIcon, PhoneIcon } from '../profile/icons';
import styles from './logout.module.css';
import { FORMER_ACCOUNT_NAME, pendingWarning } from './messages';

type Scope = 'current' | 'all';

type LogoutProps = {
  open: boolean;
  onClose(): void;
  /** Cet appareil seulement, sans choix (mot de passe à changer : le serveur n'accepte que lui, R-MDP-1). */
  currentOnly?: boolean;
};

export const LOGOUT_CURRENT_TEXT =
  'Les données de cet appareil seront effacées. Tu les retrouveras en te reconnectant.';
export const LOGOUT_ALL_TEXT =
  'Toutes tes sessions seront fermées, sur tous tes appareils, y compris celui-ci.';

const ignore = () => {};

/**
 * Feuille « Se déconnecter » (spec refonte §10.4, maquette C06) : on y choisit cet appareil (par défaut) ou
 * tous ses appareils. Les données locales sont effacées une fois la déconnexion faite : s'il reste des
 * éléments non envoyés, l'avertissement le dit d'abord et propose l'export (R-AUTH-9, R-SYN-14), quel que soit
 * le choix ; il décrit alors la feuille et le bouton qui confirme, pour qu'un lecteur d'écran l'annonce avant
 * qu'on agisse (maquette C06). Fermée, rien n'est monté : chaque ouverture repart de « Cet appareil », sans
 * l'erreur de la précédente.
 */
export function LogoutDialog(p: LogoutProps) {
  return p.open ? <OpenLogoutDialog {...p} /> : null;
}

function OpenLogoutDialog(p: LogoutProps) {
  const repos = useRepos();
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<Scope>('current');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warningTitleId = useId();
  const warningTextId = useId();
  const device = useLive(() => repos.me.deviceOwner(), [repos]);
  if (!device) return null;

  const unsent = device.pending > 0;
  const warning = unsent ? `${warningTitleId} ${warningTextId}` : undefined;
  const mode: Scope = p.currentOnly ? 'current' : scope;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await repos.me.logout(mode);
      navigate('/login', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const confirmLabel = unsent
    ? 'Se déconnecter quand même'
    : mode === 'all'
      ? 'Déconnecter tous les appareils'
      : 'Se déconnecter';

  return (
    <BottomSheet
      open
      title="Se déconnecter"
      describedBy={warning}
      // Pendant la requête, Échap ne ferme pas : l'issue (erreur ou écran de connexion) reste visible.
      onClose={busy ? ignore : p.onClose}
      actions={
        <>
          <Button variant="secondary" onClick={p.onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" aria-describedby={warning} onClick={() => void confirm()} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {p.currentOnly ? (
          <p className={styles.text}>{LOGOUT_CURRENT_TEXT}</p>
        ) : (
          <div role="radiogroup" aria-label="Appareils à déconnecter" className={styles.choices}>
            <ChoiceCard
              type="radio"
              name="logout-scope"
              value="current"
              checked={scope === 'current'}
              disabled={busy}
              onChange={() => setScope('current')}
              title="Cet appareil"
              description={LOGOUT_CURRENT_TEXT}
              icon={<PhoneIcon />}
            />
            <ChoiceCard
              type="radio"
              name="logout-scope"
              value="all"
              checked={scope === 'all'}
              disabled={busy}
              onChange={() => setScope('all')}
              title="Tous mes appareils"
              description={LOGOUT_ALL_TEXT}
              icon={<DevicesIcon />}
            />
          </div>
        )}
        {unsent ? (
          <Banner tone="warning">
            <p id={warningTitleId} className={styles.warningTitle}>
              Données non envoyées
            </p>
            <p id={warningTextId} className={styles.text}>
              {`${pendingWarning(device.pending, device.username ?? FORMER_ACCOUNT_NAME)}.`}
            </p>
            <Link href="/profile/privacy" onClick={p.onClose} className={styles.exportLink}>
              Exporter mes données
            </Link>
          </Banner>
        ) : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
      </div>
    </BottomSheet>
  );
}

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, Dialog, errorMessage } from '../../ui';
import { FORMER_ACCOUNT_NAME, pendingWarning } from './messages';

/**
 * Déconnexion de cet appareil (`current`) ou de tous (`all`). Les données locales sont effacées une
 * fois la déconnexion faite : s'il reste des éléments non envoyés, l'avertissement le dit d'abord
 * (R-AUTH-9, R-SYN-14) et propose l'export.
 */
export function LogoutDialog(p: { mode: 'current' | 'all'; open: boolean; onClose(): void }) {
  const repos = useRepos();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const device = useLive(() => (p.open ? repos.me.deviceOwner() : Promise.resolve(null)), [repos, p.open]);
  if (!p.open || !device) return null;

  const unsent = device.pending > 0;
  const all = p.mode === 'all';

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await repos.me.logout(p.mode);
      navigate('/login', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const title = unsent
    ? 'Données non envoyées'
    : all
      ? 'Déconnecter tous les appareils ?'
      : 'Se déconnecter de cet appareil ?';
  const confirmLabel = unsent
    ? 'Se déconnecter quand même'
    : all
      ? 'Déconnecter tous les appareils'
      : 'Se déconnecter';

  return (
    <Dialog
      open
      title={title}
      onClose={p.onClose}
      actions={
        <>
          <Button variant="secondary" onClick={p.onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {unsent ? (
        <>
          <p>{pendingWarning(device.pending, device.username ?? FORMER_ACCOUNT_NAME)}</p>
          <p>
            <Link href="/profile/privacy" onClick={p.onClose}>
              Exporter mes données
            </Link>
          </p>
        </>
      ) : all ? null : (
        <p>Les données de cet appareil seront effacées. Tu les retrouveras en te reconnectant.</p>
      )}
      {all ? <p>Toutes tes sessions seront fermées, sur tous tes appareils, y compris celui-ci.</p> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Dialog>
  );
}

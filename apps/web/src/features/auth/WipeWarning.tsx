import { type ReactElement, useCallback, useRef, useState } from 'react';
import { type DeviceOwner, useRepos } from '../../repos';
import { Button, Dialog } from '../../ui';
import { FORMER_ACCOUNT_NAME, pendingWarning } from './messages';

/**
 * Avertissement avant d'ouvrir la session d'un autre utilisateur que celui de l'appareil quand
 * celui-ci a des éléments non envoyés, que le dépôt effacera (R-AUTH-8, P-AUT-6) : connexion,
 * création du compte, réinitialisation. « Continuer » relance l'envoi par `onContinue`.
 */
export function useWipeWarning(onContinue: () => void): {
  /** Vrai : l'avertissement est affiché, l'envoi attend la réponse ; faux : rien à effacer. */
  warns(isDeviceOwner: (owner: DeviceOwner) => boolean): Promise<boolean>;
  dialog: ReactElement;
} {
  const repos = useRepos();
  const [warning, setWarning] = useState<string | null>(null);
  const latest = useRef(onContinue);
  latest.current = onContinue;
  const close = useCallback(() => setWarning(null), []);

  async function warns(isDeviceOwner: (owner: DeviceOwner) => boolean): Promise<boolean> {
    const owner = await repos.me.deviceOwner();
    if (owner.pending === 0 || isDeviceOwner(owner)) return false;
    setWarning(pendingWarning(owner.pending, owner.username ?? FORMER_ACCOUNT_NAME));
    return true;
  }

  const dialog = (
    <Dialog
      open={warning !== null}
      title="Données non envoyées"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close();
              latest.current();
            }}
          >
            Continuer
          </Button>
        </>
      }
    >
      <p>{warning}</p>
    </Dialog>
  );
  return { warns, dialog };
}

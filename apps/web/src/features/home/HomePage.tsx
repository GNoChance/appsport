import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, Page } from '../../ui';
import { OfflineReadyIndicator } from '../status/OfflineReadyIndicator';
import styles from './home.module.css';

/** R-AGE-6 : affiché une fois par appareil, au passage de mineur à adulte. */
export const ADULT_NOTICE_TEXT =
  "Tu as 18 ans : tu peux désormais choisir l'objectif « Perdre du gras » dans ton profil.";

export function HomePage() {
  const me = useMe();
  const repos = useRepos();
  const adultNotice = useLive(() => repos.me.adultNotice(), [repos]);
  if (!me) return null;
  return (
    <Page title={`Bonjour ${me.username}`}>
      {me.passwordReminderDue ? (
        <Banner tone="warning">Pense à changer ton mot de passe (rappel annuel).</Banner>
      ) : null}
      {adultNotice ? (
        <Banner tone="info">
          <p className={styles.notice}>{ADULT_NOTICE_TEXT}</p>
          <Button variant="secondary" onClick={() => void repos.me.dismissAdultNotice()}>
            J'ai compris
          </Button>
        </Banner>
      ) : null}
      <p className={styles.lead}>Tes programmes et tes séances arriveront ici.</p>
      <OfflineReadyIndicator />
    </Page>
  );
}

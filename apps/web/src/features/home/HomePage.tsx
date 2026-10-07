import { useMe } from '../../app-services';
import { Banner, Page } from '../../ui';
import styles from './home.module.css';

export function HomePage() {
  const me = useMe();
  if (!me) return null;
  return (
    <Page title={`Bonjour ${me.username}`}>
      {me.passwordReminderDue ? (
        <Banner tone="warning">Pense à changer ton mot de passe (rappel annuel).</Banner>
      ) : null}
      <p className={styles.lead}>Tes programmes et tes séances arriveront ici.</p>
    </Page>
  );
}

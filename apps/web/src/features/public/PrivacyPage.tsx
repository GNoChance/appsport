import { PRIVACY_POLICY_VERSION } from '@appsport/contracts';
import { Page } from '../../ui';
import { PRIVACY_SECTIONS } from './privacy-content';
import styles from './public.module.css';

export function PrivacyPage() {
  return (
    <Page title="Confidentialité et règles">
      <p className={styles.version}>Version {PRIVACY_POLICY_VERSION}</p>
      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2>{section.title}</h2>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}

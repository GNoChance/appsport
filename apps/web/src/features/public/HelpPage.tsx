import { HELP_RESOURCES } from '@appsport/contracts';
import { formatDate, Page } from '../../ui';
import styles from './public.module.css';

/** '15 / 112' → ['15', '112'] : chaque numéro tel qu'affiché. */
const numbers = (phone: string): string[] => phone.split('/').map((p) => p.trim());

export function HelpPage() {
  const verifiedOn = HELP_RESOURCES.map((r) => r.verifiedOn).sort()[0];
  return (
    <Page title="Aide">
      <p>En cas d'urgence, appelle le 15 ou le 112. Ces services sont gratuits et confidentiels.</p>
      <ul className={styles.resources}>
        {HELP_RESOURCES.map((r) => (
          <li key={r.id} className={styles.resource}>
            <span>{r.label}</span>
            {r.phone ? (
              <span className={styles.phones}>
                {numbers(r.phone).map((n) => (
                  <a key={n} href={`tel:${n.replace(/\s/g, '')}`}>
                    {n}
                  </a>
                ))}
              </span>
            ) : null}
            {r.hours ? <span className={styles.muted}>Horaires : {r.hours}</span> : null}
            {r.sourceUrl ? (
              <a className={styles.muted} href={r.sourceUrl} rel="noreferrer" target="_blank">
                Source
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {verifiedOn ? <p className={styles.muted}>Numéros vérifiés le {formatDate(verifiedOn)}</p> : null}
    </Page>
  );
}

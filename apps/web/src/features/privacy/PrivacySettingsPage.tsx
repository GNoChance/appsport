import { PRIVACY_POLICY_VERSION } from '@rune/contracts';
import { type ReactNode, useCallback, useId, useState } from 'react';
import { useMe } from '../../app-services';
import { Button, ListGroup, ListRow, Page } from '../../ui';
import { ChatIcon, DocumentIcon, HeartIcon } from '../profile/icons';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ExportButton } from './ExportButton';
import { consentLabel, DELETE_LIST_TEXT } from './messages';
import styles from './privacy.module.css';

/**
 * Profil › Confidentialité (02 §11, spec refonte §10.4, maquette C05) : texte en vigueur, état des accords
 * (l'accord santé mène à Santé, où il se donne et se retire ; l'accord coach est recueilli par la brique 4 :
 * ici, son état seulement), export (R-EXP-1) puis, isolée en bas, la suppression du compte (R-SUP-1).
 */
export function PrivacySettingsPage() {
  const me = useMe();
  const [deleting, setDeleting] = useState(false);
  const close = useCallback(() => setDeleting(false), []);
  if (!me) return null;
  return (
    <Page title="Confidentialité" back="/profile">
      <ListGroup>
        <ListRow
          icon={<DocumentIcon />}
          label="Confidentialité et règles"
          value={`Version en vigueur : ${PRIVACY_POLICY_VERSION}`}
          href="/privacy"
        />
      </ListGroup>
      <Section title="Accords">
        <ListGroup>
          <ListRow
            icon={<HeartIcon />}
            label="Accord santé"
            value={consentLabel(me.consents.health)}
            emphasis="value"
            href="/profile/health"
          />
          <ListRow
            icon={<ChatIcon />}
            label="Accord coach"
            value={consentLabel(me.consents.aiCoach)}
            emphasis="value"
          />
        </ListGroup>
      </Section>
      <Section title="Mes données">
        <p className={styles.lead}>Un fichier JSON avec tout ce que Rune garde sur ton compte.</p>
        <ExportButton />
      </Section>
      <Section title="Suppression du compte">
        <p className={styles.lead}>{DELETE_LIST_TEXT}</p>
        <Button variant="danger" className={styles.start} onClick={() => setDeleting(true)}>
          Supprimer mon compte
        </Button>
      </Section>
      <DeleteAccountDialog open={deleting} onClose={close} />
    </Page>
  );
}

/** Section titrée (h2), nommée par son titre. */
function Section(p: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

import { type ConsentStatus, PRIVACY_POLICY_VERSION } from '@appsport/contracts';
import { type ReactNode, type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useMe } from '../../app-services';
import { Button, formatDate, Page } from '../../ui';
import { ConsentWithdrawDialog } from './ConsentWithdrawDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ExportButton } from './ExportButton';
import styles from './privacy.module.css';

function consentLabel(c: ConsentStatus): string {
  if (!c.active) return 'Non donné';
  return c.at ? `Donné le ${formatDate(c.at)}` : 'Donné';
}

/**
 * Profil › Confidentialité (02 §11) : texte en vigueur, accords et retrait de l'accord santé
 * (R-CST-5), export (R-EXP-1) et suppression du compte (R-SUP-1). L'accord coach est recueilli par
 * la brique 4 : ici, son état seulement.
 */
export function PrivacySettingsPage() {
  const me = useMe();
  const [dialog, setDialog] = useState<'withdraw' | 'delete' | null>(null);
  const consentsHeading = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const close = useCallback(() => setDialog(null), []);

  // Dialogue fermé après un retrait : le bouton qui l'avait ouvert a disparu (le focus n'a pas pu
  // lui revenir), le focus va au titre des accords.
  useEffect(() => {
    if (dialog !== null) {
      opened.current = true;
      return;
    }
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (opened.current && lost) consentsHeading.current?.focus();
    opened.current = false;
  }, [dialog]);

  if (!me) return null;
  const health = me.consents.health;
  return (
    <Page title="Confidentialité" back="/profile">
      <Section title="Confidentialité et règles">
        <p>{`Version en vigueur : ${PRIVACY_POLICY_VERSION}`}</p>
        <p>
          <Link href="/privacy">Lire la page Confidentialité et règles</Link>
        </p>
      </Section>
      <Section title="Accords" headingRef={consentsHeading}>
        <dl className={styles.consents}>
          <div>
            <dt>Accord santé</dt>
            <dd>{consentLabel(health)}</dd>
          </div>
          <div>
            <dt>Accord coach</dt>
            <dd>{consentLabel(me.consents.aiCoach)}</dd>
          </div>
        </dl>
        {health.active ? (
          <Button variant="danger" className={styles.start} onClick={() => setDialog('withdraw')}>
            Retirer mon accord santé
          </Button>
        ) : (
          <p>
            <Link href="/profile/health">Donner mon accord santé</Link>
          </p>
        )}
      </Section>
      <Section title="Mes données">
        <p>Un fichier JSON avec tout ce qu'appsport garde sur ton compte.</p>
        <ExportButton />
      </Section>
      <Section title="Suppression du compte">
        <Button variant="danger" className={styles.start} onClick={() => setDialog('delete')}>
          Supprimer mon compte
        </Button>
      </Section>
      <ConsentWithdrawDialog open={dialog === 'withdraw'} onClose={close} />
      <DeleteAccountDialog open={dialog === 'delete'} onClose={close} />
    </Page>
  );
}

/** Section titrée (h2), nommée par son titre ; `headingRef` : titre focalisable. */
function Section(p: {
  title: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} ref={p.headingRef} tabIndex={p.headingRef ? -1 : undefined}>
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

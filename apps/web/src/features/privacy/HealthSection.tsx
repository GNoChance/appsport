import { type ReactNode, type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Badge, Banner, Button, formatDate, HealthWarning, ListGroup, ListRow, Page } from '../../ui';
import { HealthConsentPanel, ScreeningQuestions } from '../onboarding/HealthStep';
import { GaugeIcon, ShieldIcon } from '../profile/icons';
import { ConsentWithdrawDialog } from './ConsentWithdrawDialog';
import { HealthLimitations } from './HealthLimitations';
import { consentLabel, WITHDRAW_LIST_TEXT } from './messages';
import styles from './privacy.module.css';

/** Titre de la section du questionnaire d'alerte (glossaire, 02 §11). */
const SCREENING_TITLE = "Questionnaire d'alerte";

/**
 * Profil › Santé (02 §11, E7, spec refonte §10.4, maquette C04) : sans accord, l'accord est proposé, puis les
 * questions s'affichent en auto-vérification dans leur propre section (P-CST-2), suivies de la ligne « Mode
 * prudent » qui mène à Mon profil (E7.4) ; avec accord, son état en tête, dernière réponse au questionnaire
 * (« Répondre de nouveau »), limitations ouvertes depuis une ligne (P-DRT-2), puis, isolé en bas, le retrait de
 * l'accord (R-CST-5), avec ses textes, sa confirmation et le mot de passe ressaisi. Le mode prudent se règle
 * dans Mon profil seulement.
 */
export function HealthSection() {
  const me = useMe();
  const [withdrawing, setWithdrawing] = useState(false);
  const consentHeading = useRef<HTMLHeadingElement>(null);
  const withdrawId = useId();
  const opened = useRef(false);
  const close = useCallback(() => setWithdrawing(false), []);

  // Dialogue fermé sans focus à rendre (Safari, ou retrait fait : son bouton a disparu) : le focus va au
  // titre de l'accord proposé de nouveau, sinon au bouton du retrait.
  useEffect(() => {
    if (withdrawing) {
      opened.current = true;
      return;
    }
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (opened.current && lost) (consentHeading.current ?? document.getElementById(withdrawId))?.focus();
    opened.current = false;
  }, [withdrawing, withdrawId]);

  if (!me) return null;
  const consent = me.consents.health;
  return (
    <Page title="Santé" back="/profile">
      {consent.active ? (
        <>
          <ListGroup>
            <ListRow
              icon={<ShieldIcon />}
              label="Accord santé"
              value={consentLabel(consent)}
              badge={<Badge tone="success">Actif</Badge>}
            />
          </ListGroup>
          <ScreeningSection />
          <HealthLimitations />
        </>
      ) : (
        <>
          <Section title="Accord santé" headingRef={consentHeading}>
            <HealthConsentPanel onGranted={() => {}} />
          </Section>
          <Section title={SCREENING_TITLE}>
            <ScreeningQuestions record={false} />
            <ListGroup>
              <ListRow
                icon={<GaugeIcon />}
                label="Mode prudent"
                value="Dans Mon profil"
                href="/profile/edit"
              />
            </ListGroup>
          </Section>
        </>
      )}
      <HealthWarning />
      {consent.active ? (
        <Section title="Retirer l'accord santé" isolated>
          <p className={styles.lead}>{WITHDRAW_LIST_TEXT}</p>
          <Button id={withdrawId} variant="danger" block onClick={() => setWithdrawing(true)}>
            Retirer mon accord santé
          </Button>
        </Section>
      ) : null}
      <ConsentWithdrawDialog open={withdrawing} onClose={close} />
    </Page>
  );
}

/**
 * Section titrée (h2), nommée par son titre ; `headingRef` : titre focalisable ; `isolated` : séparée du reste
 * par un trait (action dangereuse).
 */
function Section(p: {
  title: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  isolated?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={p.isolated ? `${styles.section} ${styles.isolated}` : styles.section}
    >
      <h2 id={id} ref={p.headingRef} tabIndex={p.headingRef ? -1 : undefined} className={styles.sectionTitle}>
        {p.title}
      </h2>
      {p.children}
    </section>
  );
}

/**
 * Questionnaire d'alerte : seuls l'indicateur, la version et la date sont gardés (E7.2). Déjà
 * répondu : date et indicateur, puis « Répondre de nouveau » ouvre les questions. Enregistrées, le
 * résumé revient avec « Réponses enregistrées. » jusqu'à la prochaine ouverture.
 */
function ScreeningSection() {
  const repos = useRepos();
  const screening = useLive(() => repos.consent.screening(), [repos]);
  const [answering, setAnswering] = useState(false);
  const [saved, setSaved] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const hadQuestions = useRef(false);
  const summary = Boolean(screening) && !answering;
  const questions = screening !== undefined && !summary;

  // Questions fermées (enregistrées, relues avant la fin de l'envoi, ou « Annuler ») : le focus,
  // perdu avec elles, revient à « Répondre de nouveau ». Placé ailleurs entre-temps, il y reste.
  useEffect(() => {
    const closed = hadQuestions.current && !questions;
    hadQuestions.current = questions;
    if (!closed) return;
    const active = document.activeElement;
    if (active === null || active === document.body) summaryRef.current?.querySelector('button')?.focus();
  }, [questions]);

  if (screening === undefined) return null;
  const reopen = () => {
    setSaved(false);
    setAnswering(true);
  };
  const onSaved = () => {
    setSaved(true);
    setAnswering(false);
  };
  return (
    <Section title={SCREENING_TITLE}>
      {screening && summary ? (
        <div ref={summaryRef} className={styles.summary}>
          {saved ? <Banner tone="info">Réponses enregistrées.</Banner> : null}
          <div className={styles.screeningCard}>
            <p className={styles.strong}>{`Dernière réponse le ${formatDate(screening.answeredAt)}`}</p>
            <p
              className={styles.muted}
            >{`Indicateur de prudence : ${screening.caution ? 'actif' : 'inactif'}`}</p>
            <Button variant="secondary" onClick={reopen}>
              Répondre de nouveau
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ScreeningQuestions record onSaved={onSaved} />
          {screening ? (
            <Button variant="secondary" className={styles.start} onClick={() => setAnswering(false)}>
              Annuler
            </Button>
          ) : null}
        </>
      )}
    </Section>
  );
}

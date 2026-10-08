import type { MeResponse } from '@appsport/contracts';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, formatDate, HealthWarning, Page, useAction } from '../../ui';
import {
  CautiousModeToggle,
  HealthConsentPanel,
  LimitationsEditor,
  ScreeningQuestions,
} from '../onboarding/HealthStep';
import styles from './privacy.module.css';

/**
 * Profil › Santé (02 §11, E7) : sans accord, l'accord est proposé et les questions s'affichent en
 * auto-vérification (P-CST-2) ; avec accord, dernière réponse au questionnaire (« Répondre de
 * nouveau »), limitations modifiables (P-DRT-2). Le mode prudent (C1) est réglable dans tous les cas.
 * Le retrait de l'accord se fait dans Confidentialité (R-CST-5).
 */
export function HealthSection() {
  const me = useMe();
  if (!me) return null;
  const consented = me.consents.health.active;
  return (
    <Page title="Santé" back="/profile">
      {consented ? (
        <>
          <ScreeningSection />
          <LimitationsEditor editable headingLevel={2} />
          <p className={styles.note}>
            Ton accord santé se retire dans <Link href="/profile/privacy">Confidentialité</Link>.
          </p>
        </>
      ) : (
        <Section title="Accord santé">
          <HealthConsentPanel onGranted={() => {}} />
          <ScreeningQuestions record={false} />
        </Section>
      )}
      <CautiousSection me={me} />
      <HealthWarning />
    </Page>
  );
}

/** Section titrée (h2), nommée par son titre. */
function Section(p: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id}>{p.title}</h2>
      {p.children}
    </section>
  );
}

/**
 * Questionnaire de prudence : seuls l'indicateur, la version et la date sont gardés (E7.2). Déjà
 * répondu : date et indicateur, puis « Répondre de nouveau » ouvre les questions ; enregistrées, le
 * résumé revient et reprend le focus.
 */
function ScreeningSection() {
  const repos = useRepos();
  const screening = useLive(() => repos.consent.screening(), [repos]);
  const [answering, setAnswering] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const summary = Boolean(screening) && !answering;

  // Questions fermées (enregistrées ou « Annuler ») : le focus revient à « Répondre de nouveau ».
  useEffect(() => {
    if (!summary || !returnFocus.current) return;
    returnFocus.current = false;
    summaryRef.current?.querySelector('button')?.focus();
  }, [summary]);

  if (screening === undefined) return null;
  const close = () => {
    returnFocus.current = true;
    setAnswering(false);
  };
  return (
    <Section title="Questionnaire de prudence">
      {screening && summary ? (
        <div ref={summaryRef} className={styles.summary}>
          <p>{`Dernière réponse le ${formatDate(screening.answeredAt)}`}</p>
          <p>{`Indicateur de prudence : ${screening.caution ? 'actif' : 'inactif'}`}</p>
          <Button variant="secondary" onClick={() => setAnswering(true)}>
            Répondre de nouveau
          </Button>
        </div>
      ) : (
        <>
          <ScreeningQuestions record onSaved={close} />
          {screening ? (
            <Button variant="secondary" className={styles.start} onClick={close}>
              Annuler
            </Button>
          ) : null}
        </>
      )}
    </Section>
  );
}

/**
 * Mode prudent (E7.5, C1) : envoyé au changement ; le choix s'affiche jusqu'à la relecture du
 * profil, interrupteur désactivé pendant l'envoi.
 */
function CautiousSection(p: { me: MeResponse }) {
  const repos = useRepos();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const [draft, setDraft] = useState<boolean | null>(null);
  const save = useAction(async (cautiousMode: boolean) => {
    await repos.profile.update({ cautiousMode });
    return true;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du profil efface le brouillon
  useEffect(() => setDraft(null), [profile]);

  if (profile === undefined) return null;
  async function change(v: boolean) {
    setDraft(v);
    if (!(await save.run(v))) setDraft(null);
  }
  return (
    <Section title="Mode prudent">
      <CautiousModeToggle
        value={draft ?? profile?.cautiousMode ?? false}
        minor={p.me.ageBand === 'minor'}
        disabled={save.pending}
        onChange={(v) => void change(v)}
      />
      {save.error ? <Banner tone="error">{save.error}</Banner> : null}
    </Section>
  );
}

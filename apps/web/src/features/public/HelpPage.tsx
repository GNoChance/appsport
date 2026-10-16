import { HELP_RESOURCES, type HelpResource } from '@rune/contracts';
import { type ReactNode, useId } from 'react';
import { formatDate, Page } from '../../ui';
import { InstallSteps } from '../auth/InstallSteps';
import { installHelp } from '../auth/install-help';
import { CreditsContent } from './CreditsPage';
import styles from './public.module.css';
import { usePublicBack } from './use-public-back';

/** '15 / 112' → ['15', '112'] : chaque numéro tel qu'affiché. */
const numbers = (phone: string): string[] => phone.split('/').map((p) => p.trim());
const telHref = (n: string) => `tel:${n.replace(/\s/g, '')}`;

/** Nom de chaque numéro d'urgence : affiché sous le numéro, puis lu dans le nom du lien. */
const EMERGENCY_NAMES: Record<string, { shown: string; spoken: string }> = {
  '15': { shown: 'SAMU', spoken: 'SAMU' },
  '112': { shown: 'Numéro européen', spoken: 'numéro européen' },
};

function Glyph(p: { size: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={p.size}
      height={p.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p.children}
    </svg>
  );
}

const PHONE_PATH = (
  <path d="M5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
);

/** Encadré d'urgence (A05), en tête : la phrase, puis un bouton d'appel par numéro. */
function Emergency(p: { resource: HelpResource | undefined }) {
  const id = useId();
  const phones = p.resource?.phone ? numbers(p.resource.phone) : [];
  return (
    <section aria-labelledby={id} className={styles.emergency}>
      <p id={id} className={styles.emergencyText}>
        En cas d'urgence, appelle le 15 ou le 112.
      </p>
      {phones.length > 0 ? (
        <div className={styles.emergencyCalls}>
          {phones.map((n) => {
            const name = EMERGENCY_NAMES[n];
            return (
              <a
                key={n}
                href={telHref(n)}
                aria-label={name ? `Appeler le ${n}, ${name.spoken}` : `Appeler le ${n}`}
                className={styles.emergencyCall}
              >
                <Glyph size={20}>{PHONE_PATH}</Glyph>
                <span className={styles.emergencyNumber}>
                  <span>{n}</span>
                  {name ? <span className={styles.emergencyName}>{name.shown}</span> : null}
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SourceLink(p: { href: string }) {
  return (
    <a href={p.href} target="_blank" rel="noreferrer" className={styles.source}>
      Source
      <Glyph size={14}>
        <path d="M14 4h6v6" />
        <path d="M20 4 11 13" />
        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </Glyph>
      <span className={styles.srOnly}> (nouvel onglet)</span>
    </a>
  );
}

/** Numéros utiles (A05) : un libellé, puis l'appel et la source sur une ligne, les horaires dessous. */
function UsefulNumbers(p: { resources: readonly HelpResource[]; verifiedOn: string | undefined }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id={id}>Numéros utiles</h2>
        {p.verifiedOn ? <p className={styles.muted}>Numéros vérifiés le {formatDate(p.verifiedOn)}</p> : null}
      </div>
      {/* biome-ignore lint/a11y/noRedundantRoles: sans puces, Safari ôte la sémantique de liste (VoiceOver) ; le rôle explicite la garde */}
      <ul role="list" className={`${styles.card} ${styles.resources}`}>
        {p.resources.map((r) => (
          <li key={r.id} className={styles.resource}>
            <span>{r.label}</span>
            {r.phone || r.sourceUrl ? (
              <span className={styles.resourceActions}>
                {r.phone ? (
                  <span className={styles.phones}>
                    {numbers(r.phone).map((n) => (
                      <a key={n} href={telHref(n)} aria-label={`Appeler le ${n}`} className={styles.phone}>
                        <Glyph size={18}>{PHONE_PATH}</Glyph>
                        {n}
                      </a>
                    ))}
                  </span>
                ) : null}
                {r.sourceUrl ? <SourceLink href={r.sourceUrl} /> : null}
              </span>
            ) : null}
            {r.hours ? <span className={styles.muted}>Horaires : {r.hours}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Une section titrée en h2 de l'aide, nommée par son titre. */
function HelpSection(p: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id}>{p.title}</h2>
      {p.children}
    </section>
  );
}

/**
 * Aide (spec refonte §10.6, maquette A05) : l'encadré d'urgence (15, 112) d'abord, puis « Installer Rune »
 * (les consignes de l'invitation, pour les deux systèmes), les numéros utiles et les Crédits (P10). Tout est
 * statique : la page se lit hors ligne, sans requête.
 */
export function HelpPage() {
  const back = usePublicBack();
  const emergency = HELP_RESOURCES.find((r) => r.id === 'emergency');
  const useful = HELP_RESOURCES.filter((r) => r.id !== 'emergency');
  const verifiedOn = HELP_RESOURCES.map((r) => r.verifiedOn).sort()[0];
  return (
    <Page title="Aide" back={back}>
      <div className={`stagger ${styles.stack}`}>
        <Emergency resource={emergency} />
        <HelpSection title="Installer Rune">
          <div className={`${styles.card} ${styles.install}`}>
            <InstallSteps guides={installHelp('other')} headingLevel={3} />
          </div>
        </HelpSection>
        <UsefulNumbers resources={useful} verifiedOn={verifiedOn} />
        <HelpSection title="Crédits">
          <CreditsContent />
        </HelpSection>
      </div>
    </Page>
  );
}

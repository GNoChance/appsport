import type { ReactNode } from 'react';
import styles from './auth.module.css';
import type { InstallGuide, InstallIcon } from './install-help';

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

/** Tracés des pictogrammes des boutons du système (maquette A05). */
const ICONS: Record<InstallIcon, ReactNode> = {
  share: (
    <>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </>
  ),
  add: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7" />
      <path d="M8.5 12h7" />
    </>
  ),
  menu: (
    <>
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
};

/** Pastille du bouton à toucher ; décorative, sauf quand elle porte le nom du bouton (le menu ⋮). */
function StepIcon(p: { icon: InstallIcon; label?: string }) {
  return (
    <span className={styles.stepIcon} aria-hidden={p.label ? undefined : 'true'}>
      <Glyph size={16}>{ICONS[p.icon]}</Glyph>
      {p.label ? <span className={styles.srOnly}>{p.label}</span> : null}
    </span>
  );
}

/**
 * Consignes d'installation (maquette A05) : par système, un titre avec un téléphone, puis les étapes numérotées,
 * chacune avec la pastille du bouton à toucher. Aide et l'invitation dans un navigateur les partagent.
 * `headingLevel` suit le plan de la page (3 sous « Installer Rune », 2 sous le titre de l'invitation).
 */
export function InstallSteps(p: { guides: readonly InstallGuide[]; headingLevel: 2 | 3 }) {
  const Heading = `h${p.headingLevel}` as const;
  return (
    <div className={styles.guides}>
      {p.guides.map((guide) => (
        <div key={guide.title} className={styles.guide}>
          <Heading className={styles.guideTitle}>
            <Glyph size={18}>
              <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </Glyph>
            {guide.title}
          </Heading>
          {/* biome-ignore lint/a11y/noRedundantRoles: sans puces, Safari ôte la sémantique de liste (VoiceOver ne dirait ni le nombre d'étapes ni la position) ; le rôle explicite la garde */}
          <ol role="list" className={styles.steps}>
            {guide.steps.map((step, index) => (
              <li key={step.text} className={styles.step}>
                <span aria-hidden="true" className={styles.stepNumber}>
                  {index + 1}
                </span>
                <span>
                  {step.text}
                  {step.icon ? (
                    <>
                      {' '}
                      <StepIcon icon={step.icon} label={step.iconLabel} />
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

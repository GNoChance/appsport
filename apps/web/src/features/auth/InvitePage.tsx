import type { Role } from '@rune/contracts';
import { formatSecretCode } from '@rune/domain';
import { useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, CopyButton, Page } from '../../ui';
import { RuneMark } from '../../ui/Logo';
import { useColorScheme } from '../../ui/use-color-scheme';
import { OWNER_FIRST_NAME } from '../public/privacy-content';
import styles from './auth.module.css';
import { CodeStep, type FragmentCode, useFragmentCode } from './CodeStep';
import { CreateAccountForm } from './CreateAccountForm';
import { InstallSteps } from './InstallSteps';
import { detectPlatform, installHelp, isStandalone } from './install-help';
import { accessErrorMessage, INCOMPLETE_CODE_MESSAGE } from './messages';
import { useSessionRedirect } from './use-session-redirect';

interface CheckedInvitation {
  code: string;
  birthDate: string;
  role: Role;
}

const ASK_FOR_CODE = "Demande à l'administrateur le lien complet ou le code.";

/** Premier écran de l'invitation (03 §13.1), rappelé sur « Crée ton compte ». */
function Welcome(p: { className?: string }) {
  return (
    <p className={p.className}>
      Rune est un outil de suivi entre proches, hébergé chez {OWNER_FIRST_NAME}. Ce n'est pas un service
      médical.
    </p>
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

/**
 * Carte « À propos de Rune » (maquette A02) : le logo, le rappel et le lien vers Confidentialité.
 * Nouvel onglet : l'adresse n'a plus le code, revenir en arrière le ferait perdre ; le lien l'annonce.
 */
function About() {
  const dark = useColorScheme() === 'dark';
  return (
    <section aria-label="À propos de Rune" className={styles.about}>
      <RuneMark size={40} glow={dark} />
      <div className={styles.aboutText}>
        <Welcome />
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
          Confidentialité et règles
          <ExternalIcon />
          <span className={styles.srOnly}> (nouvel onglet)</span>
        </a>
      </div>
    </section>
  );
}

/**
 * Aide à l'installation avec le code en clair (R-ARR-2). La page ne s'ouvre pas à la création du
 * compte hors de l'appli installée : le code est copiable, l'adresse ne le garde plus. Un lien
 * tronqué (fragment illisible) est annoncé : il n'y a rien à copier.
 */
function InstallGuide(p: { fragment: FragmentCode; onContinue(): void }) {
  const { code, present } = p.fragment;
  return (
    <div className={styles.install}>
      <div className={styles.card}>
        <InstallSteps guides={installHelp(detectPlatform(navigator.userAgent))} headingLevel={2} />
      </div>
      {code ? (
        <div className={styles.codeRow}>
          <code className={styles.code}>{formatSecretCode(code)}</code>
          <CopyButton text={formatSecretCode(code)} />
        </div>
      ) : present ? (
        <Banner tone="error">
          {INCOMPLETE_CODE_MESSAGE} {ASK_FOR_CODE}
        </Banner>
      ) : null}
      <Button variant="secondary" onClick={p.onContinue}>
        Continuer dans ce navigateur
      </Button>
    </div>
  );
}

/**
 * Arrivée d'un proche (02 §3.3 et §3.4) : lien ou code d'invitation, puis création du compte
 * (maquettes A02 et A03). Retour mène à la connexion, d'une étape comme de l'autre : revenir à la
 * saisie relancerait la vérification du lien reçu.
 */
export function InvitePage() {
  const repos = useRepos();
  const redirect = useSessionRedirect();
  const fragment = useFragmentCode();
  const [standalone] = useState(() => isStandalone());
  const [inBrowser, setInBrowser] = useState(false);
  const [checked, setChecked] = useState<CheckedInvitation | null>(null);
  // Hors appli installée, l'avertissement accompagne la saisie du code puis la création du compte.
  const browserWarning = standalone ? null : (
    <Banner tone="warning">
      Attention : sur téléphone, tes données ne seront pas dans l'appli installée.
    </Banner>
  );

  if (checked) {
    return (
      <Page title="Crée ton compte" back="/login">
        {/* Le lien vers Confidentialité est celui de la case « J'ai lu la page… ». */}
        <Welcome className={styles.lead} />
        {browserWarning}
        <CreateAccountForm
          code={checked.code}
          birthDate={checked.birthDate}
          role={checked.role}
          onCreated={(me) => redirect(me.id, '/onboarding')}
        />
      </Page>
    );
  }

  return (
    <Page title="Bienvenue sur Rune" back="/login">
      <About />
      {browserWarning}
      {standalone || inBrowser ? (
        <>
          <CodeStep
            label="Lien ou code d'invitation"
            fragment={fragment}
            check={repos.me.checkInvitation}
            onChecked={(code, r) => setChecked({ code, birthDate: r.birthDate, role: r.role })}
            describeError={(e) => accessErrorMessage(e, 'member')}
          />
          <p className={styles.noCode}>Pas de code ? {ASK_FOR_CODE}</p>
        </>
      ) : (
        <InstallGuide fragment={fragment} onContinue={() => setInBrowser(true)} />
      )}
    </Page>
  );
}

import type { Role } from '@appsport/contracts';
import { formatSecretCode } from '@appsport/domain';
import { useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, CopyButton, Page } from '../../ui';
import { OWNER_FIRST_NAME } from '../public/privacy-content';
import styles from './auth.module.css';
import { CodeStep, useFragmentCode } from './CodeStep';
import { CreateAccountForm } from './CreateAccountForm';
import { detectPlatform, installHelp, isStandalone } from './install-help';
import { accessErrorMessage } from './messages';
import { useSessionRedirect } from './use-session-redirect';

interface CheckedInvitation {
  code: string;
  birthDate: string;
  role: Role;
}

/**
 * Aide à l'installation avec le code en clair (R-ARR-2). La page ne s'ouvre pas à la création du
 * compte hors de l'appli installée : le code est copiable, l'adresse ne le garde plus.
 */
function InstallGuide(p: { code: string | null; onContinue(): void }) {
  return (
    <div className={styles.install}>
      {installHelp(detectPlatform(navigator.userAgent)).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {p.code ? (
        <div className={styles.codeRow}>
          <code className={styles.code}>{formatSecretCode(p.code)}</code>
          <CopyButton text={formatSecretCode(p.code)} />
        </div>
      ) : null}
      <Button variant="secondary" onClick={p.onContinue}>
        Continuer dans ce navigateur
      </Button>
    </div>
  );
}

/** Arrivée d'un proche (02 §3.3 et §3.4) : lien ou code d'invitation, puis création du compte. */
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
      <Page title="Crée ton compte">
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
    <Page title="Bienvenue sur appsport">
      <p>
        appsport est un outil de suivi entre proches, hébergé chez {OWNER_FIRST_NAME}. Ce n'est pas un service
        médical.
      </p>
      {/* Nouvel onglet : l'adresse n'a plus le code, revenir en arrière le ferait perdre. */}
      <a href="/privacy" target="_blank" rel="noopener noreferrer">
        Confidentialité et règles
      </a>
      {browserWarning}
      {standalone || inBrowser ? (
        <CodeStep
          label="Lien ou code d'invitation"
          fragment={fragment}
          check={repos.me.checkInvitation}
          onChecked={(code, r) => setChecked({ code, birthDate: r.birthDate, role: r.role })}
          describeError={(e) => accessErrorMessage(e, 'member')}
        />
      ) : (
        <InstallGuide code={fragment.code} onContinue={() => setInBrowser(true)} />
      )}
    </Page>
  );
}

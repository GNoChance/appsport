import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useMe } from '../app-services';
import { ConnectionStatus } from '../features/status/ConnectionStatus';
import { PendingCounter, RejectedCounter } from '../features/status/PendingCounter';
import styles from './ui.module.css';

/**
 * Cadre des écrans connectés : navigation, zone d'état (connexion, éléments en attente et refusés,
 * R-SYN-34), liens vers les pages publiques.
 */
export function AppShell(p: { children: ReactNode }) {
  const me = useMe();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          appsport
        </Link>
        <nav aria-label="Navigation principale" className={styles.nav}>
          <Link href="/">Accueil</Link>
          <Link href="/profile">Profil</Link>
          {me?.role === 'admin' ? <Link href="/admin/members">Administration</Link> : null}
        </nav>
        <div className={styles.status}>
          <ConnectionStatus />
          <PendingCounter />
          <RejectedCounter />
        </div>
      </header>
      <main className={styles.main}>{p.children}</main>
      <PublicLinks />
    </div>
  );
}

/**
 * Cadre des pages publiques, lisibles sans session, et de l'onboarding : pas de navigation de
 * compte. `homeLink` faux (onboarding) : la marque est un simple texte, l'accueil ramènerait à
 * l'onboarding en perdant l'écran en cours.
 */
export function PublicShell(p: { children: ReactNode; homeLink?: boolean }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {p.homeLink === false ? (
          <span className={styles.brand}>appsport</span>
        ) : (
          <Link href="/" className={styles.brand}>
            appsport
          </Link>
        )}
      </header>
      <main className={styles.main}>{p.children}</main>
      <PublicLinks />
    </div>
  );
}

/** Liens vers les pages lisibles sans compte (03 §13). */
export function PublicLinks() {
  return (
    <footer className={styles.footer}>
      <Link href="/privacy">Confidentialité et règles</Link>
      <Link href="/help">Aide</Link>
      <Link href="/credits">Crédits</Link>
    </footer>
  );
}

import { type ReactNode, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useMe } from '../app-services';
import { UpdateBanner } from '../sw/UpdateBanner';
import { ConnectionPill } from './ConnectionPill';
import { RuneMark, RuneWordmark } from './Logo';
import { SideNav } from './SideNav';
import { useScreenEntrance, useScreenTransition } from './screen-transition';
import shell from './shell.module.css';
import { activeTab, TabBar } from './TabBar';
import styles from './ui.module.css';
import { useColorScheme } from './use-color-scheme';
import { useMediaQuery } from './use-media-query';

/** Largeur à partir de laquelle la barre d'onglets laisse la place à la navigation latérale (spec refonte §5). */
export const WIDE_QUERY = '(min-width: 900px)';

/**
 * Cadre des écrans connectés (spec refonte §5) : en-tête de l'accueil, bandeau de mise à jour juste dessous
 * (R-PWA-2), l'écran qui entre selon la navigation (avant, retour, onglet), la barre d'onglets flottante sur
 * téléphone ou la navigation latérale à partir de 900 px. Les compteurs de synchro sont dans Réglages.
 */
export function AppShell(p: { children: ReactNode }) {
  const [path] = useLocation();
  const wide = useMediaQuery(WIDE_QUERY);
  const transition = useScreenTransition(path);
  const screen = useRef<HTMLElement>(null);
  useScreenEntrance(screen, path, transition);
  return (
    <div className={shell.shell} data-wide={wide ? '' : undefined}>
      {wide ? <SideNav /> : null}
      <div className={shell.column}>
        {activeTab(path) === '/' ? <HomeHeader brand={!wide} /> : null}
        <div className={shell.bannerSlot}>
          <UpdateBanner />
        </div>
        <main ref={screen} className={shell.main} data-screen-transition={transition}>
          {p.children}
        </main>
        <PublicLinks />
      </div>
      {wide ? null : <TabBar />}
    </div>
  );
}

/**
 * En-tête de l'accueil (maquettes MixSombre / MixClair) : logo et RUNE vers l'accueil, pastille de connexion,
 * rond de l'initiale vers le Profil. Les pages internes ont leur Retour et leur titre (`PageHeader`).
 * `brand` faux sur PC : la navigation latérale porte déjà la marque (une seule annonce, un seul arrêt de
 * tabulation) ; pastille et initiale restent seules, à droite.
 * Le rond s'appelle « Profil », comme l'onglet qui mène au même hub : « Mon profil » est la ligne du hub vers
 * /profile/edit (un nom, une destination, WCAG 3.2.4).
 */
function HomeHeader(p: { brand: boolean }) {
  const me = useMe();
  const dark = useColorScheme() === 'dark';
  return (
    <header className={shell.header}>
      {p.brand ? (
        <Link href="/" className={shell.brand} aria-label="Rune">
          <RuneMark glow={dark} />
          <RuneWordmark />
        </Link>
      ) : null}
      <div className={shell.headerEnd}>
        <ConnectionPill />
        {me ? (
          <Link href="/profile" aria-label="Profil" className={shell.avatar}>
            <span aria-hidden="true">{me.username.charAt(0).toUpperCase()}</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Cadre des pages publiques, lisibles sans session, et de l'onboarding : pas de navigation de
 * compte ni de bandeau de mise à jour (R-PWA-3). `homeLink` faux (onboarding) : la marque est un simple texte, l'accueil ramènerait à
 * l'onboarding en perdant l'écran en cours.
 */
export function PublicShell(p: { children: ReactNode; homeLink?: boolean }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {p.homeLink === false ? (
          <span className={styles.brand}>Rune</span>
        ) : (
          <Link href="/" className={styles.brand}>
            Rune
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

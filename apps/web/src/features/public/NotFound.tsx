import { useId } from 'react';
import { Link } from 'wouter';
import { useSyncState } from '../../app-services';
import { SystemPanel } from '../../ui';
import styles from './public.module.css';

/** Cadre brisé du logo (docs/brand), sans la rune : le 404 s'y inscrit. */
const FRAME = 'M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1';
const TICKS = 'M24 247H50V265H24ZM462 247H488V265H462Z';

/**
 * Emblème de la 404 (maquette A06) : le cadre du logo au dégradé glacé → violet, un fond teinté, « 404 » au
 * centre ; une lueur en sombre. Décoratif : le titre dit tout. Identifiants propres à l'instance.
 */
function Emblem() {
  const prefix = `rune-404-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const gradient = `${prefix}-frame`;
  const glow = `${prefix}-glow`;
  return (
    <div aria-hidden="true" className={styles.emblem}>
      <svg viewBox="0 0 512 512" width="150" height="150" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
            <stop offset="0" className={styles.stopStart} />
            <stop offset="1" className={styles.stopEnd} />
          </linearGradient>
          <filter id={glow} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        <polygon points="256,46 424,139 424,373 256,466 88,373 88,139" className={styles.emblemFill} />
        <g filter={`url(#${glow})`} className={styles.emblemGlow}>
          <path d={FRAME} fill="none" strokeWidth="22" />
        </g>
        <path
          d={FRAME}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="22"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d={TICKS} fill={`url(#${gradient})`} />
      </svg>
      <span className={styles.emblemCode}>404</span>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function OfflineIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 3 18 18" />
      <path d="M8.6 16.4a5 5 0 0 1 6.8 0" />
      <path d="M5.1 12.9a10 10 0 0 1 4.4-2.6" />
      <path d="M18.9 12.9a10 10 0 0 0-2.3-1.6" />
      <path d="M2 9a15 15 0 0 1 4.2-2.7" />
      <path d="M22 9a15 15 0 0 0-11.2-4" />
      <path d="M12 20h.01" />
    </svg>
  );
}

/** Encadré « Hors ligne » (A06) : ce qui reste lisible, et ce qui demande le réseau. */
function OfflineNotice() {
  return (
    <div role="status" className={styles.offline}>
      <OfflineIcon />
      <div className={styles.offlineText}>
        <p className={styles.offlineTitle}>
          <span aria-hidden="true" className={styles.offlineDot} />
          Hors ligne
        </p>
        <p>Les pages Aide, Confidentialité et Crédits restent lisibles. La connexion nécessite le réseau.</p>
      </div>
    </div>
  );
}

/**
 * Page introuvable (spec refonte §10.7, maquette A06) : l'emblème 404, la voix du Système « Zone inconnue. »
 * et le retour à l'accueil. Hors ligne, d'après l'état de connexion unique de la synchro (jamais
 * `navigator.onLine`), l'encadré « Hors ligne » le dit.
 */
export function NotFound() {
  const { connection } = useSyncState();
  return (
    <div className={`stagger ${styles.notFound}`}>
      <Emblem />
      <div className={styles.notFoundPanel}>
        <SystemPanel title="Page introuvable" headingLevel={1}>
          <p>Zone inconnue. Cette page n'existe pas ou n'est pas encore disponible.</p>
          <Link href="/" className={styles.homeLink}>
            <HomeIcon />
            Retour à l'accueil
          </Link>
        </SystemPanel>
      </div>
      {connection === 'offline' ? <OfflineNotice /> : null}
    </div>
  );
}

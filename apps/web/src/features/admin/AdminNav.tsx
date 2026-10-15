import { Link, useLocation } from 'wouter';
import styles from './admin.module.css';

const LINKS: readonly { href: string; label: string }[] = [
  { href: '/admin/members', label: 'Membres' },
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/gyms', label: 'Salles' },
  { href: '/admin/health', label: 'Serveur' },
];

/**
 * Sous-navigation de l'administration (02 §6, spec refonte §10.5, maquettes E01 à E05) : Membres · Invitations ·
 * Salles · Serveur, en pilule segmentée ; la section affichée porte `aria-current="page"` (adresse comparée sans
 * tenir compte de la casse ni de la barre finale, comme les routes).
 */
export function AdminNav() {
  const [location] = useLocation();
  const current = location.toLowerCase().replace(/\/+$/, '');
  return (
    <nav aria-label="Administration" className={styles.nav}>
      <ul>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={current === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

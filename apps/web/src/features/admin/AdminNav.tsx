import { Link, useLocation } from 'wouter';
import styles from './admin.module.css';

const LINKS: readonly { href: string; label: string }[] = [
  { href: '/admin/members', label: 'Membres' },
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/gyms', label: 'Salles' },
  { href: '/admin/health', label: 'État du serveur' },
];

/** Écrans d'administration (02 §6) : Membres · Invitations · Salles · État du serveur. */
export function AdminNav() {
  const [location] = useLocation();
  const current = location.replace(/\/+$/, '');
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

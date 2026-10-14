import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import styles from './shell.module.css';

export type TabHref = '/' | '/progression' | '/places' | '/profile';

/** Onglets du socle (spec refonte §5) ; à la brique 5, Nutrition prend la place de Salles. */
export const TAB_ITEMS: readonly { href: TabHref; label: string }[] = [
  { href: '/', label: 'Accueil' },
  { href: '/progression', label: 'Progression' },
  { href: '/places', label: 'Salles' },
  { href: '/profile', label: 'Profil' },
];

/** Préfixes rangés sous chaque onglet : les salles sous Salles, les réglages et l'administration sous Profil. */
const SECTIONS: readonly { tab: TabHref; prefixes: readonly string[] }[] = [
  { tab: '/progression', prefixes: ['/progression'] },
  { tab: '/places', prefixes: ['/places', '/gyms'] },
  { tab: '/profile', prefixes: ['/profile', '/settings', '/rejections', '/admin'] },
];

/**
 * Onglet d'une adresse, par préfixe de chemin (sans tenir compte de la casse ni de la barre finale, comme
 * les routes) : « Accueil » sur `/` exactement, `null` hors des onglets (page inconnue).
 */
export function activeTab(path: string): TabHref | null {
  const p = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/') return '/';
  for (const { tab, prefixes } of SECTIONS) {
    if (prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) return tab;
  }
  return null;
}

function Icon(p: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p.children}
    </svg>
  );
}

/** Icônes des onglets (maquettes MixSombre / MixClair). */
export const TAB_ICONS: Record<TabHref, ReactNode> = {
  '/': (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  ),
  '/progression': (
    <Icon>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </Icon>
  ),
  '/places': (
    <Icon>
      <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
    </Icon>
  ),
  '/profile': (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Icon>
  ),
};

/**
 * Barre d'onglets flottante en pilule, sur téléphone (maquettes MixSombre / MixClair) : l'onglet actif porte
 * `aria-current="page"` et la pastille glisse jusqu'à lui ; sans onglet actif, elle se cache.
 */
export function TabBar() {
  const [path] = useLocation();
  const active = activeTab(path);
  const index = TAB_ITEMS.findIndex((t) => t.href === active);
  return (
    <nav aria-label="Navigation principale" data-testid="tab-bar" className={styles.tabBar}>
      <span
        aria-hidden="true"
        data-tab-pill=""
        data-index={index < 0 ? undefined : String(index)}
        hidden={index < 0}
        className={styles.tabPill}
        style={{ '--tab-index': Math.max(index, 0) } as CSSProperties}
      />
      {TAB_ITEMS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? 'page' : undefined}
          className={styles.tab}
        >
          {TAB_ICONS[t.href]}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

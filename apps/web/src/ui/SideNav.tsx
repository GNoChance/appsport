import { Link, useLocation } from 'wouter';
import { RuneMark, RuneWordmark } from './Logo';
import styles from './shell.module.css';
import { activeTab, TAB_ICONS, TAB_ITEMS } from './TabBar';
import { useColorScheme } from './use-color-scheme';

/**
 * Navigation latérale sur PC (largeur ≥ 900 px, spec refonte §5) : la marque, puis les mêmes entrées que la
 * barre d'onglets, l'entrée active portant `aria-current="page"`.
 */
export function SideNav() {
  const [path] = useLocation();
  const active = activeTab(path);
  const dark = useColorScheme() === 'dark';
  return (
    <div className={styles.sideNav} data-testid="side-nav">
      <Link href="/" className={styles.brand} aria-label="Rune">
        <RuneMark glow={dark} />
        <RuneWordmark />
      </Link>
      <nav aria-label="Navigation principale">
        <ul className={styles.sideList}>
          {TAB_ITEMS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={t.href === active ? 'page' : undefined}
                className={styles.sideItem}
              >
                {TAB_ICONS[t.href]}
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

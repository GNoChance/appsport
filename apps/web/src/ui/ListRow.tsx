import { type ReactNode, useId } from 'react';
import { Link } from 'wouter';
import styles from './ui.module.css';

/**
 * Lignes regroupées dans une carte, séparées d'un trait ; `title` : petit titre de groupe au-dessus
 * (la section est alors nommée par lui).
 */
export function ListGroup(p: { title?: string; children: ReactNode }) {
  const titleId = useId();
  const list = <ul className={styles.listGroup}>{p.children}</ul>;
  if (!p.title) return list;
  return (
    <section aria-labelledby={titleId} className={styles.listSection}>
      <h2 id={titleId} className={styles.listTitle}>
        {p.title}
      </h2>
      {list}
    </section>
  );
}

function Chevron() {
  return (
    <svg
      data-chevron=""
      className={styles.rowChevron}
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Ligne de liste de 56 px : icône, libellé, valeur, badge. Avec `href`, un lien ; avec `onClick`, un
 * bouton (chevron dans les deux cas, sauf l'action dangereuse, isolée sans chevron comme « Se
 * déconnecter ») ; avec les deux, un lien qui appelle `onClick` avant de naviguer ; sans l'un ni
 * l'autre, une ligne d'information. Le lien ou le bouton est nommé par le libellé seul et décrit par
 * la valeur et le badge.
 * - `name` : nom du lien ou du bouton quand le libellé seul ne dit pas l'action (« Modifier l'objectif » pour la
 *   ligne « Objectif ») ; il reprend toujours le libellé visible (WCAG 2.5.3).
 * - `emphasis="value"` : ligne d'état ou de réponse (maquettes C02, C03, C05), le libellé en petit au-dessus et
 *   la valeur en gras ; par défaut, le libellé est en gras et la valeur en petit (ligne qui mène ailleurs,
 *   C01). Le nom et la description ne changent pas.
 * - `tone="accent"` : ligne d'action qui ouvre un formulaire sur place (« Ajouter une limitation », maquette C04),
 *   libellé en accent et sans chevron.
 */
export function ListRow(p: {
  icon?: ReactNode;
  label: string;
  name?: string;
  value?: ReactNode;
  href?: string;
  onClick?(): void;
  badge?: ReactNode;
  tone?: 'danger' | 'accent';
  emphasis?: 'value';
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const badgeId = `${id}-badge`;
  const interactive = p.href !== undefined || p.onClick !== undefined;
  const content = (
    <>
      {p.icon ? (
        <span className={styles.rowIcon} aria-hidden="true">
          {p.icon}
        </span>
      ) : null}
      <span className={styles.rowText}>
        <span id={labelId} className={styles.rowLabel}>
          {p.label}
        </span>
        {p.value !== undefined ? (
          <span id={valueId} className={styles.rowValue}>
            {p.value}
          </span>
        ) : null}
      </span>
      {p.badge ? (
        <span id={badgeId} className={styles.rowBadge}>
          {p.badge}
        </span>
      ) : null}
      {interactive && p.tone === undefined ? <Chevron /> : null}
    </>
  );
  const named = {
    className: styles.row,
    'data-tone': p.tone,
    'data-emphasis': p.emphasis,
    'aria-label': p.name,
    'aria-labelledby': p.name === undefined ? labelId : undefined,
    'aria-describedby':
      [p.value !== undefined ? valueId : null, p.badge ? badgeId : null].filter(Boolean).join(' ') ||
      undefined,
  };
  return (
    <li className={styles.listItem}>
      {p.href !== undefined ? (
        <Link href={p.href} onClick={p.onClick} {...named}>
          {content}
        </Link>
      ) : p.onClick !== undefined ? (
        <button type="button" onClick={p.onClick} {...named}>
          {content}
        </button>
      ) : (
        <div className={styles.row} data-tone={p.tone} data-emphasis={p.emphasis}>
          {content}
        </div>
      )}
    </li>
  );
}

import { type ReactNode, useId } from 'react';
import styles from './ui.module.css';

/** Coche des choix faits (carte, pastille) : la sélection ne passe jamais par la seule couleur. */
export function CheckGlyph() {
  return (
    <svg
      data-check=""
      aria-hidden="true"
      className={styles.checkGlyph}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Carte de choix unique (radio) ou multiple (case à cocher) : un `<label>` qui contient le vrai
 * `<input>`, transparent et posé sur toute la carte. Nommée par son titre, décrite par sa description
 * (et par `describedBy`, l'id d'un texte qui l'explique, par exemple la raison d'un choix désactivé).
 * Cochée : bord accent, teinte et coche.
 */
export function ChoiceCard(p: {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  onChange(): void;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const describedBy = [p.description ? descriptionId : null, p.describedBy ?? null].filter(Boolean).join(' ');
  return (
    <label className={styles.choiceCard}>
      <input
        type={p.type}
        name={p.name}
        value={p.value}
        checked={p.checked}
        disabled={p.disabled}
        onChange={() => p.onChange()}
        aria-labelledby={titleId}
        aria-describedby={describedBy || undefined}
        className={styles.overlayInput}
      />
      {p.icon ? (
        <span className={styles.choiceIcon} aria-hidden="true">
          {p.icon}
        </span>
      ) : null}
      <span className={styles.choiceText}>
        <span id={titleId} className={styles.choiceTitle}>
          {p.title}
        </span>
        {p.description ? (
          <span id={descriptionId} className={styles.choiceDescription}>
            {p.description}
          </span>
        ) : null}
      </span>
      <span className={styles.choiceMark} data-type={p.type} aria-hidden="true">
        {p.checked ? <CheckGlyph /> : null}
      </span>
    </label>
  );
}

/** Groupe de cartes de choix sous une légende (`<fieldset>`). */
export function ChoiceGroup(p: { legend: string; children: ReactNode }) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend className={styles.legend}>{p.legend}</legend>
      <div className={styles.choiceStack}>{p.children}</div>
    </fieldset>
  );
}

import { type ReactNode, useId } from 'react';
import styles from './voice.module.css';

/**
 * Fenêtre du Système (sa voix froide, aux moments clés seulement) : étiquette « [ SYSTÈME ] », titre, texte.
 * En sombre et en Salle de nuit, un coin HUD ; en clair et en Carnet, une barre dégradée en haut.
 * `success` : la même fenêtre au vert du succès (quête remplie, action réussie).
 * Un groupe nommé par son titre, pas un repère de page (plusieurs fenêtres n'encombrent pas la liste des
 * régions). `headingLevel` (2 par défaut) suit le plan de la page : 3 dans une feuille du bas ou une section
 * titrée en h2. Les crochets de l'étiquette sont tus : le lecteur d'écran lit « SYSTÈME ».
 */
export function SystemPanel(p: {
  title: string;
  children: ReactNode;
  tone?: 'default' | 'success';
  headingLevel?: 2 | 3 | 4;
}) {
  const titleId = useId();
  const tone = p.tone ?? 'default';
  const Heading = `h${p.headingLevel ?? 2}` as const;
  return (
    // Un groupe de texte, pas des champs de formulaire : un fieldset serait faux ici.
    // biome-ignore lint/a11y/useSemanticElements: role group voulu, la fenêtre ne contient pas de champs
    <div
      role="group"
      aria-labelledby={titleId}
      data-tone={tone}
      className={[styles.panel, tone === 'success' ? styles.success : null].filter(Boolean).join(' ')}
    >
      <span className={styles.hudCorner} aria-hidden="true" />
      <div className={styles.panelHead}>
        <div className={styles.systemLabel} data-system-label="">
          <span aria-hidden="true">[ </span>SYSTÈME<span aria-hidden="true"> ]</span>
        </div>
        <Heading id={titleId} className={styles.panelTitle}>
          {p.title}
        </Heading>
      </div>
      <div className={styles.panelBody}>{p.children}</div>
    </div>
  );
}

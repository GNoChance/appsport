import type { CoachId } from '@rune/contracts';
import type { ArtSvgProps, CoachMode } from './art/art-types';
import { CoachOmbre } from './art/CoachOmbre';
import { CoachScribe } from './art/CoachScribe';
import { CoachSkald } from './art/CoachSkald';
import styles from './art.module.css';
import { useArtId } from './use-art-id';
import { useColorScheme } from './use-color-scheme';

/** Nom affiché de chaque coach (spec refonte §8). */
export const COACH_NAMES: Readonly<Record<CoachId, string>> = {
  ombre: "L'Ombre",
  skald: 'Le Skald',
  scribe: 'Le Scribe',
};

const ART = { ombre: CoachOmbre, skald: CoachSkald, scribe: CoachScribe } as const;

/**
 * Avatar d'un coach, nommé (« Le Skald », « Le Skald, mode nutrition »), en version claire ou sombre selon le
 * thème effectif. `animated` : animation de repos discrète (respiration, clignement, visière), éteinte sous
 * mouvement réduit ; `true` boucle (grand avatar de présentation), `'brief'` joue deux cycles puis se pose
 * (avatar à côté d'un texte). Le dessin est entier dès le premier rendu : l'animation ne cache jamais rien.
 * `decorative` : à côté du nom écrit du coach, l'avatar est caché aux lecteurs d'écran, sans rôle ni nom,
 * pour que le nom ne soit pas lu deux fois.
 */
export function CoachAvatar({
  coach,
  mode = 'training',
  size,
  animated = false,
  decorative = false,
}: {
  coach: CoachId;
  mode?: CoachMode;
  size: number;
  animated?: boolean | 'brief';
  decorative?: boolean;
}) {
  const idPrefix = useArtId(`coach-${coach}`);
  const scheme = useColorScheme();
  const Art = ART[coach];
  const name = mode === 'nutrition' ? `${COACH_NAMES[coach]}, mode nutrition` : COACH_NAMES[coach];
  const svg: ArtSvgProps = {
    ...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name }),
    width: size,
    height: size,
    className: styles.art,
  };
  return (
    <span
      className={[
        styles.avatar,
        animated ? styles.animated : null,
        animated === 'brief' ? styles.brief : null,
      ]
        .filter(Boolean)
        .join(' ')}
      data-animated={animated}
    >
      <Art mode={mode} scheme={scheme} idPrefix={idPrefix} {...svg} />
    </span>
  );
}

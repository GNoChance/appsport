import type { ArtSvgProps, CoachMode } from './art/art-types';
import { CoachOmbre } from './art/CoachOmbre';
import { CoachScribe } from './art/CoachScribe';
import { CoachSkald } from './art/CoachSkald';
import type { CoachId } from './art/coach-id';
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
 * mouvement réduit. Le dessin est entier dès le premier rendu : l'animation ne cache jamais rien.
 */
export function CoachAvatar({
  coach,
  mode = 'training',
  size,
  animated = false,
}: {
  coach: CoachId;
  mode?: CoachMode;
  size: number;
  animated?: boolean;
}) {
  const idPrefix = useArtId(`coach-${coach}`);
  const scheme = useColorScheme();
  const Art = ART[coach];
  const name = mode === 'nutrition' ? `${COACH_NAMES[coach]}, mode nutrition` : COACH_NAMES[coach];
  const svg: ArtSvgProps = {
    role: 'img',
    'aria-label': name,
    width: size,
    height: size,
    className: styles.art,
  };
  return (
    <span
      className={[styles.avatar, animated ? styles.animated : null].filter(Boolean).join(' ')}
      data-animated={animated}
    >
      <Art mode={mode} scheme={scheme} idPrefix={idPrefix} {...svg} />
    </span>
  );
}

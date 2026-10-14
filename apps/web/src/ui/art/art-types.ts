import type { SVGProps } from 'react';

/** Props de la racine `<svg>` d'un dessin généré : taille, nom accessible, classe ; jamais son contenu. */
export type ArtSvgProps = Omit<
  SVGProps<SVGSVGElement>,
  'children' | 'viewBox' | 'dangerouslySetInnerHTML' | 'mode'
>;

/** Mode du coach : entraînement (visière glacée) ou nutrition (or, épi, pomme). */
export type CoachMode = 'training' | 'nutrition';

/** Version du dessin : sombre ou claire, d'après le thème effectif. */
export type ColorScheme = 'dark' | 'light';

export type CoachArtProps = ArtSvgProps & {
  mode: CoachMode;
  scheme: ColorScheme;
  /** Préfixe des identifiants du dessin, propre à chaque instance ([A-Za-z0-9_-]). */
  idPrefix: string;
};

/** Rangs « Pierre runique », du galet griffé au monolithe éveillé (spec refonte §9). */
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type RankStoneProps = ArtSvgProps & {
  rank: Rank;
  /** Version dessinée pour 24–32 px. */
  mini?: boolean;
  idPrefix: string;
};

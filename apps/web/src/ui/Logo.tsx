import { type CSSProperties, useId } from 'react';

/*
 * Logo « Rang brisé » (spec refonte §3), dessiné en JSX d'après docs/brand/ : rune-mark-mono.svg sans lueur,
 * rune-mark.svg avec. Mêmes tracés, mêmes valeurs ; seuls les identifiants changent, préfixés par marque.
 */

/** Cadre hexagonal brisé du badge de rang. */
const FRAME = 'M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1';
/** Repères de part et d'autre du cadre. */
const TICKS = 'M24 247H50V265H24ZM462 247H488V265H462Z';
/** La rune, évidée. */
const RUNE =
  'M185.6 102L342.4 215.9L255.5 279.1L341.6 406.8L341.6 481.2L227.2 311.6L227.2 414L185.6 383.8ZM271.6 215.9L227.2 248.2L227.2 183.6Z';

const FRAME_STROKE = { strokeWidth: '24', strokeLinejoin: 'miter', strokeMiterlimit: '4' } as const;

/**
 * Sans lueur, cadre et repères prennent `--rune-mark-frame` quand un parent la pose (en clair, les maquettes
 * les veulent à l'accent et la rune à l'encre), sinon la couleur du texte comme la rune.
 */
const FRAME_COLOR: CSSProperties = { color: 'var(--rune-mark-frame, currentColor)' };

export interface RuneMarkProps {
  /** Côté en px ; 28 par défaut, la taille de l'en-tête. */
  size?: number;
  /** Dégradé glacé et lueur de rune-mark.svg, à la place de la couleur du texte. */
  glow?: boolean;
  /** Nom lu par les lecteurs d'écran ; sans titre, la marque est décorative. */
  title?: string;
}

/** Marque Rune en SVG en ligne : `currentColor` (mono), ou dégradés et lueur du logo (`glow`). */
export function RuneMark({ size = 28, glow = false, title }: RuneMarkProps) {
  // Identifiants propres à chaque marque : deux logos d'une même page ne se volent ni titre ni dégradé.
  const prefix = `rune-mark-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const ids = {
    title: `${prefix}-title`,
    rune: `${prefix}-rune`,
    frame: `${prefix}-frame`,
    glow: `${prefix}-glow`,
  };
  const art = glow ? (
    <>
      <defs>
        <linearGradient id={ids.rune} x1="0" y1="80" x2="0" y2="490" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F2FDFF" />
          <stop offset="0.5" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#8C6BFF" />
        </linearGradient>
        <linearGradient id={ids.frame} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#7A5CFF" />
        </linearGradient>
        <filter id={ids.glow} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g filter={`url(#${ids.glow})`} opacity="0.8">
        <path d={FRAME} fill="none" stroke="#3FB8FF" {...FRAME_STROKE} />
        <path d={TICKS} fill="#3FB8FF" />
        <path d={RUNE} fill="#4FD8FF" fillRule="evenodd" />
      </g>
      <path d={FRAME} fill="none" stroke={`url(#${ids.frame})`} {...FRAME_STROKE} />
      <path d={TICKS} fill={`url(#${ids.frame})`} />
      <path d={RUNE} fill={`url(#${ids.rune})`} fillRule="evenodd" />
    </>
  ) : (
    <>
      <g style={FRAME_COLOR}>
        <path d={FRAME} fill="none" stroke="currentColor" {...FRAME_STROKE} />
        <path d={TICKS} fill="currentColor" />
      </g>
      <path d={RUNE} fill="currentColor" fillRule="evenodd" />
    </>
  );
  // Nommée par son titre, ou décorative (à côté du mot RUNE, par exemple) et masquée aux lecteurs d'écran.
  return title ? (
    <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-labelledby={ids.title}>
      <title id={ids.title}>{title}</title>
      {art}
    </svg>
  ) : (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      {art}
    </svg>
  );
}

/** Le mot RUNE des maquettes ; taille et couleur viennent du parent. */
const WORDMARK: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  letterSpacing: '0.22em',
  // L'espacement suit aussi le E final : la marge négative le retire, le mot se centre sur ses lettres.
  marginInlineEnd: '-0.22em',
};

/** Le mot « RUNE » en Chakra Petch espacé, identique dans les 5 thèmes. */
export function RuneWordmark() {
  return <span style={WORDMARK}>RUNE</span>;
}

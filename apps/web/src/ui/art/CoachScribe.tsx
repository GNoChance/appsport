// fichier généré par svg-to-tsx.mjs : ne pas modifier à la main, relancer le script.
// Avatar du coach scribe, direction emblème (plume dans le badge), d'après docs/brand/coachs/scribe/.
import type { JSX } from 'react';
import type { ArtSvgProps, CoachArtProps, CoachMode, ColorScheme } from './art-types';

/** docs/brand/coachs/scribe/scribe.svg */
function trainingDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-dark" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-emb-skald-d-plate`}
          cx="256"
          cy="200"
          r="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#14223F" />
          <stop offset="0.6" stopColor="#0B1224" />
          <stop offset="1" stopColor="#080C18" />
        </radialGradient>
        <linearGradient
          id={`${p}-emb-skald-d-frame-stroke`}
          x1="68"
          y1="24"
          x2="444"
          y2="488"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#7A5CFF" />
        </linearGradient>
        <linearGradient
          id={`${p}-emb-skald-d-glyph-fill`}
          x1="0"
          y1="-372"
          x2="0"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F2FDFF" />
          <stop offset="0.5" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#8C6BFF" />
        </linearGradient>
        <filter id={`${p}-emb-skald-d-glow-blur`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g id={`${p}-emb-plate`} data-g="emb-plate">
        <path
          d="M256 37.9L432.7 135.7L432.7 376.3L256 474.1L79.3 376.3L79.3 135.7Z"
          fill={`url(#${p}-emb-skald-d-plate)`}
        />
      </g>
      <g id={`${p}-emb-glow`} data-g="emb-glow" filter={`url(#${p}-emb-skald-d-glow-blur)`} opacity="0.6">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke="#3FB8FF"
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill="#3FB8FF" />
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M0 40L19 -30L12 -40L12 -92L56 -126L90 -178L44 -214L102 -206L110 -248L52 -296L104 -272L100 -300L80 -330L50 -356L10 -376L-16 -344L-32 -284L-36 -206L-28 -146L-12 -104L-12 -40L-19 -30ZM-4 -112L4 -112L6 -348ZM0 26L2.6 -9L6.5 -16L0 -23L-6.5 -16L-2.6 -9Z"
          fill="#3FB8FF"
          fillRule="evenodd"
        />
      </g>
      <g id={`${p}-emb-frame`} data-g="emb-frame">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke={`url(#${p}-emb-skald-d-frame-stroke)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill={`url(#${p}-emb-skald-d-frame-stroke)`} />
      </g>
      <g id={`${p}-emb-glyph`} data-g="emb-glyph">
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M0 40L19 -30L12 -40L12 -92L56 -126L90 -178L44 -214L102 -206L110 -248L52 -296L104 -272L100 -300L80 -330L50 -356L10 -376L-16 -344L-32 -284L-36 -206L-28 -146L-12 -104L-12 -40L-19 -30ZM-4 -112L4 -112L6 -348ZM0 26L2.6 -9L6.5 -16L0 -23L-6.5 -16L-2.6 -9Z"
          fill={`url(#${p}-emb-skald-d-glyph-fill)`}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/scribe/scribe-light.svg */
function trainingLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-light" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-emb-skald-l-plate`}
          cx="256"
          cy="200"
          r="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F6F9FD" />
          <stop offset="1" stopColor="#E9F0F9" />
        </radialGradient>
        <linearGradient
          id={`${p}-emb-skald-l-frame-stroke`}
          x1="68"
          y1="24"
          x2="444"
          y2="488"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1C6FB5" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
        <linearGradient
          id={`${p}-emb-skald-l-glyph-fill`}
          x1="0"
          y1="-372"
          x2="0"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0D2C52" />
          <stop offset="0.5" stopColor="#1C6FB5" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
      </defs>
      <g id={`${p}-emb-plate`} data-g="emb-plate">
        <path
          d="M256 37.9L432.7 135.7L432.7 376.3L256 474.1L79.3 376.3L79.3 135.7Z"
          fill={`url(#${p}-emb-skald-l-plate)`}
        />
      </g>
      <g id={`${p}-emb-frame`} data-g="emb-frame">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke={`url(#${p}-emb-skald-l-frame-stroke)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill={`url(#${p}-emb-skald-l-frame-stroke)`} />
      </g>
      <g id={`${p}-emb-glyph`} data-g="emb-glyph">
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M0 40L19 -30L12 -40L12 -92L56 -126L90 -178L44 -214L102 -206L110 -248L52 -296L104 -272L100 -300L80 -330L50 -356L10 -376L-16 -344L-32 -284L-36 -206L-28 -146L-12 -104L-12 -40L-19 -30ZM-4 -112L4 -112L6 -348ZM0 26L2.6 -9L6.5 -16L0 -23L-6.5 -16L-2.6 -9Z"
          fill={`url(#${p}-emb-skald-l-glyph-fill)`}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/scribe/scribe-nutrition.svg */
function nutritionDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-dark" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-emb-nutrition-d-plate`}
          cx="256"
          cy="200"
          r="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#14223F" />
          <stop offset="0.6" stopColor="#0B1224" />
          <stop offset="1" stopColor="#080C18" />
        </radialGradient>
        <linearGradient
          id={`${p}-emb-nutrition-d-frame-stroke`}
          x1="68"
          y1="24"
          x2="444"
          y2="488"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFD978" />
          <stop offset="1" stopColor="#E8922E" />
        </linearGradient>
        <linearGradient
          id={`${p}-emb-nutrition-d-glyph-fill`}
          x1="0"
          y1="-372"
          x2="0"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFF6DC" />
          <stop offset="0.5" stopColor="#F4C25B" />
          <stop offset="1" stopColor="#E8922E" />
        </linearGradient>
        <filter id={`${p}-emb-nutrition-d-glow-blur`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g id={`${p}-emb-plate`} data-g="emb-plate">
        <path
          d="M256 37.9L432.7 135.7L432.7 376.3L256 474.1L79.3 376.3L79.3 135.7Z"
          fill={`url(#${p}-emb-nutrition-d-plate)`}
        />
      </g>
      <g id={`${p}-emb-glow`} data-g="emb-glow" filter={`url(#${p}-emb-nutrition-d-glow-blur)`} opacity="0.6">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke="#FFB23F"
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill="#FFB23F" />
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M-10 -100L10 -100L10 30L-10 46ZM-4 -100L-6.2 -131.5L-29.3 -158.1L-59.1 -163.4L-58 -133.2L-34.9 -106.6ZM4 -100L34.9 -106.6L58 -133.2L59.1 -163.4L29.3 -158.1L6.2 -131.5ZM-4 -178L-6.2 -209.5L-29.3 -236.1L-59.1 -241.4L-58 -211.2L-34.9 -184.6ZM4 -178L34.9 -184.6L58 -211.2L59.1 -241.4L29.3 -236.1L6.2 -209.5ZM-4 -256L-6.2 -287.5L-29.3 -314.1L-59.1 -319.4L-58 -289.2L-34.9 -262.6ZM4 -256L34.9 -262.6L58 -289.2L59.1 -319.4L29.3 -314.1L6.2 -287.5ZM0 -298L18 -320.8L18 -352.7L0 -374L-18 -352.7L-18 -320.8Z"
          fill="#FFB23F"
          fillRule="evenodd"
        />
      </g>
      <g id={`${p}-emb-frame`} data-g="emb-frame">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke={`url(#${p}-emb-nutrition-d-frame-stroke)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill="#5ED8FF" />
      </g>
      <g id={`${p}-emb-glyph`} data-g="emb-glyph">
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M-10 -100L10 -100L10 30L-10 46ZM-4 -100L-6.2 -131.5L-29.3 -158.1L-59.1 -163.4L-58 -133.2L-34.9 -106.6ZM4 -100L34.9 -106.6L58 -133.2L59.1 -163.4L29.3 -158.1L6.2 -131.5ZM-4 -178L-6.2 -209.5L-29.3 -236.1L-59.1 -241.4L-58 -211.2L-34.9 -184.6ZM4 -178L34.9 -184.6L58 -211.2L59.1 -241.4L29.3 -236.1L6.2 -209.5ZM-4 -256L-6.2 -287.5L-29.3 -314.1L-59.1 -319.4L-58 -289.2L-34.9 -262.6ZM4 -256L34.9 -262.6L58 -289.2L59.1 -319.4L29.3 -314.1L6.2 -287.5ZM0 -298L18 -320.8L18 -352.7L0 -374L-18 -352.7L-18 -320.8Z"
          fill={`url(#${p}-emb-nutrition-d-glyph-fill)`}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/scribe/scribe-nutrition-light.svg */
function nutritionLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-light" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-emb-nutrition-l-plate`}
          cx="256"
          cy="200"
          r="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#FDF9F0" />
          <stop offset="1" stopColor="#F7EEDB" />
        </radialGradient>
        <linearGradient
          id={`${p}-emb-nutrition-l-frame-stroke`}
          x1="68"
          y1="24"
          x2="444"
          y2="488"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#B47A0C" />
          <stop offset="1" stopColor="#9A5C00" />
        </linearGradient>
        <linearGradient
          id={`${p}-emb-nutrition-l-glyph-fill`}
          x1="0"
          y1="-372"
          x2="0"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4A3000" />
          <stop offset="0.5" stopColor="#A86A00" />
          <stop offset="1" stopColor="#B8740A" />
        </linearGradient>
      </defs>
      <g id={`${p}-emb-plate`} data-g="emb-plate">
        <path
          d="M256 37.9L432.7 135.7L432.7 376.3L256 474.1L79.3 376.3L79.3 135.7Z"
          fill={`url(#${p}-emb-nutrition-l-plate)`}
        />
      </g>
      <g id={`${p}-emb-frame`} data-g="emb-frame">
        <path
          d="M296.9 465.4L256 488L68 384L68 128L256 24L444 128L444 384L369.7 425.1"
          fill="none"
          stroke={`url(#${p}-emb-nutrition-l-frame-stroke)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247H50V265H24ZM462 247H488V265H462Z" fill="#1C6FB5" />
      </g>
      <g id={`${p}-emb-glyph`} data-g="emb-glyph">
        <path
          transform="translate(333.3 445.25) rotate(-22.22)"
          d="M-10 -100L10 -100L10 30L-10 46ZM-4 -100L-6.2 -131.5L-29.3 -158.1L-59.1 -163.4L-58 -133.2L-34.9 -106.6ZM4 -100L34.9 -106.6L58 -133.2L59.1 -163.4L29.3 -158.1L6.2 -131.5ZM-4 -178L-6.2 -209.5L-29.3 -236.1L-59.1 -241.4L-58 -211.2L-34.9 -184.6ZM4 -178L34.9 -184.6L58 -211.2L59.1 -241.4L29.3 -236.1L6.2 -209.5ZM-4 -256L-6.2 -287.5L-29.3 -314.1L-59.1 -319.4L-58 -289.2L-34.9 -262.6ZM4 -256L34.9 -262.6L58 -289.2L59.1 -319.4L29.3 -314.1L6.2 -287.5ZM0 -298L18 -320.8L18 -352.7L0 -374L-18 -352.7L-18 -320.8Z"
          fill={`url(#${p}-emb-nutrition-l-glyph-fill)`}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

const VARIANTS: Record<CoachMode, Record<ColorScheme, (p: string, svg: ArtSvgProps) => JSX.Element>> = {
  training: { dark: trainingDark, light: trainingLight },
  nutrition: { dark: nutritionDark, light: nutritionLight },
};

/** Avatar scribe : mode entraînement ou nutrition, version sombre ou claire ; ids préfixés par idPrefix. */
export function CoachScribe({ mode, scheme, idPrefix, ...svg }: CoachArtProps) {
  return VARIANTS[mode][scheme](idPrefix, svg);
}

// fichier généré par svg-to-tsx.mjs : ne pas modifier à la main, relancer le script.
// Avatar du coach skald, direction personnage (barde encapuchonné), d'après docs/brand/coachs/skald/.
import type { JSX } from 'react';
import type { ArtSvgProps, CoachArtProps, CoachMode, ColorScheme } from './art-types';

/** docs/brand/coachs/skald/skald.svg */
function trainingDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-dark" {...svg}>
      <defs>
        <linearGradient id={`${p}-per-hl`} x1="0" y1="64" x2="0" y2="376" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1E2E52" />
          <stop offset="1" stopColor="#0E172C" />
        </linearGradient>
        <radialGradient id={`${p}-per-tile`} cx="256" cy="192" r="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2B5490" />
          <stop offset="0.55" stopColor="#10203F" />
          <stop offset="1" stopColor="#070B16" />
        </radialGradient>
        <linearGradient id={`${p}-per-fr`} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#8C6BFF" />
        </linearGradient>
        <linearGradient id={`${p}-per-br`} x1="0" y1="320" x2="0" y2="464" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DCE8F4" />
          <stop offset="1" stopColor="#8396AE" />
        </linearGradient>
        <linearGradient id={`${p}-per-rim`} x1="0" y1="64" x2="0" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5ED8FF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#5ED8FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${p}-per-gem`}
          x1="256"
          y1="340"
          x2="256"
          y2="400"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F2FDFF" />
          <stop offset="0.5" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#8C6BFF" />
        </linearGradient>
        <clipPath id={`${p}-per-clip`}>
          <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" />
        </clipPath>
        <clipPath id={`${p}-per-vclip`}>
          <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" />
        </clipPath>
        <filter id={`${p}-per-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={`${p}-per-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="25.6" />
        </filter>
      </defs>
      <g id={`${p}-per-badge`} data-g="per-badge">
        <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" fill={`url(#${p}-per-tile)`} />
      </g>
      <g id={`${p}-per-body`} data-g="per-body" clipPath={`url(#${p}-per-clip)`}>
        <path d="M136 296L80 356L48 424V512H464V424L432 356L376 296L256 376Z" fill="#0A1122" />
        <path d="M256 398.4L284.8 512H227.2Z" fill="#04060C" />
        <path
          d="M48 424L80 356L136 296M464 424L432 356L376 296"
          fill="none"
          stroke="#2E4470"
          strokeWidth="7.2"
          strokeLinejoin="round"
        />
        <path d="M256 68L340 124L372 204L376 296L256 376L136 296L140 204L172 124Z" fill="#0E172C" />
        <path d="M256 68L172 124L140 204L136 296L256 376Z" fill={`url(#${p}-per-hl)`} />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#2E4470"
          strokeWidth="14.4"
          strokeLinejoin="round"
        />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#5ED8FF"
          strokeWidth="5.6"
          strokeDasharray="7.2 10.4"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path
          d="M136 296L140 204L172 124L256 68L340 124L372 204L376 296"
          fill="none"
          stroke={`url(#${p}-per-rim)`}
          strokeWidth="10.4"
          strokeLinejoin="round"
        />
        <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" fill="#020308" />
        <path
          d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z"
          fill="none"
          stroke="#5ED8FF"
          strokeWidth="6.4"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>
      <g id={`${p}-per-eyes`} data-g="per-eyes">
        <g clipPath={`url(#${p}-per-vclip)`}>
          <ellipse
            cx="256"
            cy="256"
            rx="72"
            ry="36"
            fill="#5ED8FF"
            opacity="0.28"
            filter={`url(#${p}-per-halo)`}
          />
        </g>
        <g fill="#5ED8FF" filter={`url(#${p}-per-glow)`}>
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
        <g fill="#EFFCFF">
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
      </g>
      <g id={`${p}-per-frame`} data-g="per-frame">
        <path
          d="M296.8 465.6L256 488L68 384L68 128L256 24L444 128L444 384L369.6 424.8"
          fill="none"
          stroke={`url(#${p}-per-fr)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247.2H50V264.8H24ZM462 247.2H488V264.8H462Z" fill={`url(#${p}-per-fr)`} />
      </g>
      <g id={`${p}-per-braid`} data-g="per-braid">
        <ellipse
          cx="308"
          cy="316.8"
          rx="11.2"
          ry="18.8"
          transform="rotate(34 308 316.8)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="324"
          cy="334.64"
          rx="10.96"
          ry="18.8"
          transform="rotate(-34 324 334.64)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="314.4"
          cy="352.48"
          rx="10.72"
          ry="18.8"
          transform="rotate(34 314.4 352.48)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="330.4"
          cy="370.32"
          rx="10.48"
          ry="18.8"
          transform="rotate(-34 330.4 370.32)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="320.8"
          cy="388.08"
          rx="10.32"
          ry="18.8"
          transform="rotate(34 320.8 388.08)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="336.8"
          cy="405.92"
          rx="10.08"
          ry="18.8"
          transform="rotate(-34 336.8 405.92)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="327.2"
          cy="423.76"
          rx="9.84"
          ry="18.8"
          transform="rotate(34 327.2 423.76)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="343.2"
          cy="441.6"
          rx="9.6"
          ry="18.8"
          transform="rotate(-34 343.2 441.6)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <path d="M325.6 458.4H348" stroke="#5ED8FF" strokeWidth="12" strokeLinecap="round" />
        <polygon
          points="336.8,464.8 352.08,473.6 352.08,491.2 336.8,500 321.52,491.2 321.52,473.6"
          fill={`url(#${p}-per-gem)`}
          stroke="#070A12"
          strokeWidth="4.8"
        />
      </g>
      <g id={`${p}-per-prop`} data-g="per-prop">
        <polygon
          points="256,340 281.6,354.8 281.6,384.4 256,399.2 230.4,384.4 230.4,354.8"
          fill={`url(#${p}-per-gem)`}
          stroke="#070A12"
          strokeWidth="6.4"
          strokeLinejoin="round"
        />
        <polygon
          points="256,358.8 265.36,364.24 265.36,375.04 256,380.4 246.64,375.04 246.64,364.24"
          fill="#070A12"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/skald/skald-light.svg */
function trainingLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-light" {...svg}>
      <defs>
        <linearGradient id={`${p}-per-hl`} x1="0" y1="64" x2="0" y2="376" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A3A61" />
          <stop offset="1" stopColor="#1A2541" />
        </linearGradient>
        <radialGradient id={`${p}-per-tile`} cx="256" cy="192" r="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#EDF3FA" />
          <stop offset="1" stopColor="#D6E2F0" />
        </radialGradient>
        <linearGradient id={`${p}-per-fr`} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C6FB5" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
        <linearGradient id={`${p}-per-br`} x1="0" y1="320" x2="0" y2="464" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DCE8F4" />
          <stop offset="1" stopColor="#8396AE" />
        </linearGradient>
        <linearGradient id={`${p}-per-rim`} x1="0" y1="64" x2="0" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5ED8FF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#5ED8FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${p}-per-gem`}
          x1="256"
          y1="340"
          x2="256"
          y2="400"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F2FDFF" />
          <stop offset="0.5" stopColor="#3FA9E8" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
        <clipPath id={`${p}-per-clip`}>
          <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" />
        </clipPath>
        <clipPath id={`${p}-per-vclip`}>
          <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" />
        </clipPath>
        <filter id={`${p}-per-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={`${p}-per-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="25.6" />
        </filter>
      </defs>
      <g id={`${p}-per-badge`} data-g="per-badge">
        <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" fill={`url(#${p}-per-tile)`} />
      </g>
      <g id={`${p}-per-body`} data-g="per-body" clipPath={`url(#${p}-per-clip)`}>
        <path d="M136 296L80 356L48 424V512H464V424L432 356L376 296L256 376Z" fill="#141D33" />
        <path d="M256 398.4L284.8 512H227.2Z" fill="#0A0F1C" />
        <path
          d="M48 424L80 356L136 296M464 424L432 356L376 296"
          fill="none"
          stroke="#3A4E78"
          strokeWidth="7.2"
          strokeLinejoin="round"
        />
        <path d="M256 68L340 124L372 204L376 296L256 376L136 296L140 204L172 124Z" fill="#1A2541" />
        <path d="M256 68L172 124L140 204L136 296L256 376Z" fill={`url(#${p}-per-hl)`} />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#3A4E78"
          strokeWidth="14.4"
          strokeLinejoin="round"
        />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#5ED8FF"
          strokeWidth="5.6"
          strokeDasharray="7.2 10.4"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" fill="#05070D" />
        <path
          d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z"
          fill="none"
          stroke="#5ED8FF"
          strokeWidth="6.4"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>
      <g id={`${p}-per-eyes`} data-g="per-eyes">
        <g clipPath={`url(#${p}-per-vclip)`}>
          <ellipse
            cx="256"
            cy="256"
            rx="72"
            ry="36"
            fill="#5ED8FF"
            opacity="0.28"
            filter={`url(#${p}-per-halo)`}
          />
        </g>
        <g fill="#5ED8FF" filter={`url(#${p}-per-glow)`}>
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
        <g fill="#EFFCFF">
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
      </g>
      <g id={`${p}-per-frame`} data-g="per-frame">
        <path
          d="M296.8 465.6L256 488L68 384L68 128L256 24L444 128L444 384L369.6 424.8"
          fill="none"
          stroke={`url(#${p}-per-fr)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247.2H50V264.8H24ZM462 247.2H488V264.8H462Z" fill={`url(#${p}-per-fr)`} />
      </g>
      <g id={`${p}-per-braid`} data-g="per-braid">
        <ellipse
          cx="308"
          cy="316.8"
          rx="11.2"
          ry="18.8"
          transform="rotate(34 308 316.8)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="324"
          cy="334.64"
          rx="10.96"
          ry="18.8"
          transform="rotate(-34 324 334.64)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="314.4"
          cy="352.48"
          rx="10.72"
          ry="18.8"
          transform="rotate(34 314.4 352.48)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="330.4"
          cy="370.32"
          rx="10.48"
          ry="18.8"
          transform="rotate(-34 330.4 370.32)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="320.8"
          cy="388.08"
          rx="10.32"
          ry="18.8"
          transform="rotate(34 320.8 388.08)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="336.8"
          cy="405.92"
          rx="10.08"
          ry="18.8"
          transform="rotate(-34 336.8 405.92)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="327.2"
          cy="423.76"
          rx="9.84"
          ry="18.8"
          transform="rotate(34 327.2 423.76)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="343.2"
          cy="441.6"
          rx="9.6"
          ry="18.8"
          transform="rotate(-34 343.2 441.6)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <path d="M325.6 458.4H348" stroke="#1C6FB5" strokeWidth="12" strokeLinecap="round" />
        <polygon
          points="336.8,464.8 352.08,473.6 352.08,491.2 336.8,500 321.52,491.2 321.52,473.6"
          fill={`url(#${p}-per-gem)`}
          stroke="#070A12"
          strokeWidth="4.8"
        />
      </g>
      <g id={`${p}-per-prop`} data-g="per-prop">
        <polygon
          points="256,340 281.6,354.8 281.6,384.4 256,399.2 230.4,384.4 230.4,354.8"
          fill={`url(#${p}-per-gem)`}
          stroke="#070A12"
          strokeWidth="6.4"
          strokeLinejoin="round"
        />
        <polygon
          points="256,358.8 265.36,364.24 265.36,375.04 256,380.4 246.64,375.04 246.64,364.24"
          fill="#070A12"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/skald/skald-nutrition.svg */
function nutritionDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-dark" {...svg}>
      <defs>
        <linearGradient id={`${p}-per-hl`} x1="0" y1="64" x2="0" y2="376" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1E2E52" />
          <stop offset="1" stopColor="#0E172C" />
        </linearGradient>
        <radialGradient id={`${p}-per-tile`} cx="256" cy="192" r="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2B5490" />
          <stop offset="0.55" stopColor="#10203F" />
          <stop offset="1" stopColor="#070B16" />
        </radialGradient>
        <linearGradient id={`${p}-per-fr`} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD873" />
          <stop offset="1" stopColor="#E39A1E" />
        </linearGradient>
        <linearGradient id={`${p}-per-br`} x1="0" y1="320" x2="0" y2="464" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DCE8F4" />
          <stop offset="1" stopColor="#8396AE" />
        </linearGradient>
        <linearGradient id={`${p}-per-rim`} x1="0" y1="64" x2="0" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC857" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFC857" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${p}-per-gem`}
          x1="240"
          y1="344"
          x2="272"
          y2="424"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFF0B8" />
          <stop offset="0.45" stopColor="#FFC23D" />
          <stop offset="1" stopColor="#D98200" />
        </linearGradient>
        <clipPath id={`${p}-per-clip`}>
          <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" />
        </clipPath>
        <clipPath id={`${p}-per-vclip`}>
          <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" />
        </clipPath>
        <filter id={`${p}-per-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={`${p}-per-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="25.6" />
        </filter>
      </defs>
      <g id={`${p}-per-badge`} data-g="per-badge">
        <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" fill={`url(#${p}-per-tile)`} />
      </g>
      <g id={`${p}-per-body`} data-g="per-body" clipPath={`url(#${p}-per-clip)`}>
        <path d="M136 296L80 356L48 424V512H464V424L432 356L376 296L256 376Z" fill="#0A1122" />
        <path d="M256 398.4L284.8 512H227.2Z" fill="#04060C" />
        <path
          d="M48 424L80 356L136 296M464 424L432 356L376 296"
          fill="none"
          stroke="#2E4470"
          strokeWidth="7.2"
          strokeLinejoin="round"
        />
        <path d="M256 68L340 124L372 204L376 296L256 376L136 296L140 204L172 124Z" fill="#0E172C" />
        <path d="M256 68L172 124L140 204L136 296L256 376Z" fill={`url(#${p}-per-hl)`} />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#2E4470"
          strokeWidth="14.4"
          strokeLinejoin="round"
        />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#FFC857"
          strokeWidth="5.6"
          strokeDasharray="7.2 10.4"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path
          d="M136 296L140 204L172 124L256 68L340 124L372 204L376 296"
          fill="none"
          stroke={`url(#${p}-per-rim)`}
          strokeWidth="10.4"
          strokeLinejoin="round"
        />
        <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" fill="#020308" />
        <path
          d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z"
          fill="none"
          stroke="#FFC857"
          strokeWidth="6.4"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>
      <g id={`${p}-per-eyes`} data-g="per-eyes">
        <g clipPath={`url(#${p}-per-vclip)`}>
          <ellipse
            cx="256"
            cy="256"
            rx="72"
            ry="36"
            fill="#FFC23D"
            opacity="0.28"
            filter={`url(#${p}-per-halo)`}
          />
        </g>
        <g fill="#FFC23D" filter={`url(#${p}-per-glow)`}>
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
        <g fill="#FFF7DC">
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
      </g>
      <g id={`${p}-per-frame`} data-g="per-frame">
        <path
          d="M296.8 465.6L256 488L68 384L68 128L256 24L444 128L444 384L369.6 424.8"
          fill="none"
          stroke={`url(#${p}-per-fr)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247.2H50V264.8H24ZM462 247.2H488V264.8H462Z" fill={`url(#${p}-per-fr)`} />
      </g>
      <g id={`${p}-per-braid`} data-g="per-braid">
        <ellipse
          cx="308"
          cy="316.8"
          rx="11.2"
          ry="18.8"
          transform="rotate(34 308 316.8)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="324"
          cy="334.64"
          rx="10.96"
          ry="18.8"
          transform="rotate(-34 324 334.64)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="314.4"
          cy="352.48"
          rx="10.72"
          ry="18.8"
          transform="rotate(34 314.4 352.48)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="330.4"
          cy="370.32"
          rx="10.48"
          ry="18.8"
          transform="rotate(-34 330.4 370.32)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="320.8"
          cy="388.08"
          rx="10.32"
          ry="18.8"
          transform="rotate(34 320.8 388.08)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="336.8"
          cy="405.92"
          rx="10.08"
          ry="18.8"
          transform="rotate(-34 336.8 405.92)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="327.2"
          cy="423.76"
          rx="9.84"
          ry="18.8"
          transform="rotate(34 327.2 423.76)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="343.2"
          cy="441.6"
          rx="9.6"
          ry="18.8"
          transform="rotate(-34 343.2 441.6)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <path d="M325.6 458.4H348" stroke="#FFC857" strokeWidth="12" strokeLinecap="round" />
        <polygon
          points="336.8,464.8 352.08,473.6 352.08,491.2 336.8,500 321.52,491.2 321.52,473.6"
          fill="#6EDC8C"
          stroke="#070A12"
          strokeWidth="4.8"
        />
      </g>
      <g id={`${p}-per-prop`} data-g="per-prop">
        <g transform="translate(256 380.8) scale(1.22) translate(-256 -380.8)">
          <path
            d="M256 351.2C244 340.8 215.2 342.4 216 378.4C216.8 404.8 233.6 423.2 247.2 421.6C251.2 421.2 253.6 419.2 256 419.2C258.4 419.2 260.8 421.2 264.8 421.6C278.4 423.2 295.2 404.8 296 378.4C296.8 342.4 268 340.8 256 351.2Z"
            fill={`url(#${p}-per-gem)`}
            stroke="#3A2400"
            strokeWidth="4.8"
            strokeLinejoin="round"
          />
          <path
            d="M235.2 364.8C232.8 371.2 232 378.4 233.6 385.6"
            fill="none"
            stroke="#FFFBEA"
            strokeWidth="6.4"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path d="M256 353.6L261.6 332.8" stroke="#7A5520" strokeWidth="6.4" strokeLinecap="round" />
          <path
            d="M261.6 339.2C266.4 324 282.4 318.4 295.2 323.2C288.8 336.8 275.2 343.2 261.6 339.2Z"
            fill="#6EDC8C"
            stroke="#3A2400"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/coachs/skald/skald-nutrition-light.svg */
function nutritionLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-light" {...svg}>
      <defs>
        <linearGradient id={`${p}-per-hl`} x1="0" y1="64" x2="0" y2="376" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A3A61" />
          <stop offset="1" stopColor="#1A2541" />
        </linearGradient>
        <radialGradient id={`${p}-per-tile`} cx="256" cy="192" r="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#FBF5E8" />
          <stop offset="1" stopColor="#F0E2C2" />
        </radialGradient>
        <linearGradient id={`${p}-per-fr`} x1="68" y1="24" x2="444" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C08A00" />
          <stop offset="1" stopColor="#8A5A00" />
        </linearGradient>
        <linearGradient id={`${p}-per-br`} x1="0" y1="320" x2="0" y2="464" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DCE8F4" />
          <stop offset="1" stopColor="#8396AE" />
        </linearGradient>
        <linearGradient id={`${p}-per-rim`} x1="0" y1="64" x2="0" y2="336" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC857" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFC857" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${p}-per-gem`}
          x1="240"
          y1="344"
          x2="272"
          y2="424"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="0.45" stopColor="#F2AE22" />
          <stop offset="1" stopColor="#B86E00" />
        </linearGradient>
        <clipPath id={`${p}-per-clip`}>
          <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" />
        </clipPath>
        <clipPath id={`${p}-per-vclip`}>
          <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" />
        </clipPath>
        <filter id={`${p}-per-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={`${p}-per-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="25.6" />
        </filter>
      </defs>
      <g id={`${p}-per-badge`} data-g="per-badge">
        <polygon points="256,24 444,128 444,384 256,488 68,384 68,128" fill={`url(#${p}-per-tile)`} />
      </g>
      <g id={`${p}-per-body`} data-g="per-body" clipPath={`url(#${p}-per-clip)`}>
        <path d="M136 296L80 356L48 424V512H464V424L432 356L376 296L256 376Z" fill="#141D33" />
        <path d="M256 398.4L284.8 512H227.2Z" fill="#0A0F1C" />
        <path
          d="M48 424L80 356L136 296M464 424L432 356L376 296"
          fill="none"
          stroke="#3A4E78"
          strokeWidth="7.2"
          strokeLinejoin="round"
        />
        <path d="M256 68L340 124L372 204L376 296L256 376L136 296L140 204L172 124Z" fill="#1A2541" />
        <path d="M256 68L172 124L140 204L136 296L256 376Z" fill={`url(#${p}-per-hl)`} />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#3A4E78"
          strokeWidth="14.4"
          strokeLinejoin="round"
        />
        <path
          d="M136 296L256 376L376 296"
          fill="none"
          stroke="#FFC857"
          strokeWidth="5.6"
          strokeDasharray="7.2 10.4"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z" fill="#05070D" />
        <path
          d="M256 132L310.4 172L332 236L328 292L288 332H224L184 292L180 236L201.6 172Z"
          fill="none"
          stroke="#FFC857"
          strokeWidth="6.4"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>
      <g id={`${p}-per-eyes`} data-g="per-eyes">
        <g clipPath={`url(#${p}-per-vclip)`}>
          <ellipse
            cx="256"
            cy="256"
            rx="72"
            ry="36"
            fill="#FFC23D"
            opacity="0.28"
            filter={`url(#${p}-per-halo)`}
          />
        </g>
        <g fill="#FFC23D" filter={`url(#${p}-per-glow)`}>
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
        <g fill="#FFF7DC">
          <path d="M196.8 233.6L245.6 250.4L244 271.2L202.4 259.2Z" />
          <path d="M315.2 233.6L266.4 250.4L268 271.2L309.6 259.2Z" />
        </g>
      </g>
      <g id={`${p}-per-frame`} data-g="per-frame">
        <path
          d="M296.8 465.6L256 488L68 384L68 128L256 24L444 128L444 384L369.6 424.8"
          fill="none"
          stroke={`url(#${p}-per-fr)`}
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <path d="M24 247.2H50V264.8H24ZM462 247.2H488V264.8H462Z" fill={`url(#${p}-per-fr)`} />
      </g>
      <g id={`${p}-per-braid`} data-g="per-braid">
        <ellipse
          cx="308"
          cy="316.8"
          rx="11.2"
          ry="18.8"
          transform="rotate(34 308 316.8)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="324"
          cy="334.64"
          rx="10.96"
          ry="18.8"
          transform="rotate(-34 324 334.64)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="314.4"
          cy="352.48"
          rx="10.72"
          ry="18.8"
          transform="rotate(34 314.4 352.48)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="330.4"
          cy="370.32"
          rx="10.48"
          ry="18.8"
          transform="rotate(-34 330.4 370.32)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="320.8"
          cy="388.08"
          rx="10.32"
          ry="18.8"
          transform="rotate(34 320.8 388.08)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="336.8"
          cy="405.92"
          rx="10.08"
          ry="18.8"
          transform="rotate(-34 336.8 405.92)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="327.2"
          cy="423.76"
          rx="9.84"
          ry="18.8"
          transform="rotate(34 327.2 423.76)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <ellipse
          cx="343.2"
          cy="441.6"
          rx="9.6"
          ry="18.8"
          transform="rotate(-34 343.2 441.6)"
          fill={`url(#${p}-per-br)`}
          stroke="#070A12"
          strokeWidth="4.4"
        />
        <path d="M325.6 458.4H348" stroke="#C08A00" strokeWidth="12" strokeLinecap="round" />
        <polygon
          points="336.8,464.8 352.08,473.6 352.08,491.2 336.8,500 321.52,491.2 321.52,473.6"
          fill="#2FA35A"
          stroke="#070A12"
          strokeWidth="4.8"
        />
      </g>
      <g id={`${p}-per-prop`} data-g="per-prop">
        <g transform="translate(256 380.8) scale(1.22) translate(-256 -380.8)">
          <path
            d="M256 351.2C244 340.8 215.2 342.4 216 378.4C216.8 404.8 233.6 423.2 247.2 421.6C251.2 421.2 253.6 419.2 256 419.2C258.4 419.2 260.8 421.2 264.8 421.6C278.4 423.2 295.2 404.8 296 378.4C296.8 342.4 268 340.8 256 351.2Z"
            fill={`url(#${p}-per-gem)`}
            stroke="#3A2400"
            strokeWidth="4.8"
            strokeLinejoin="round"
          />
          <path
            d="M235.2 364.8C232.8 371.2 232 378.4 233.6 385.6"
            fill="none"
            stroke="#FFFBEA"
            strokeWidth="6.4"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path d="M256 353.6L261.6 332.8" stroke="#6B4A1A" strokeWidth="6.4" strokeLinecap="round" />
          <path
            d="M261.6 339.2C266.4 324 282.4 318.4 295.2 323.2C288.8 336.8 275.2 343.2 261.6 339.2Z"
            fill="#2FA35A"
            stroke="#3A2400"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

const VARIANTS: Record<CoachMode, Record<ColorScheme, (p: string, svg: ArtSvgProps) => JSX.Element>> = {
  training: { dark: trainingDark, light: trainingLight },
  nutrition: { dark: nutritionDark, light: nutritionLight },
};

/** Avatar skald : mode entraînement ou nutrition, version sombre ou claire ; ids préfixés par idPrefix. */
export function CoachSkald({ mode, scheme, idPrefix, ...svg }: CoachArtProps) {
  return VARIANTS[mode][scheme](idPrefix, svg);
}

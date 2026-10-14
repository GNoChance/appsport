// fichier généré par svg-to-tsx.mjs : ne pas modifier à la main, relancer le script.
// Avatar du coach ombre, direction Système (casque, visière glacée), d'après docs/brand/coachs/ombre/.
import type { JSX } from 'react';
import type { ArtSvgProps, CoachArtProps, CoachMode, ColorScheme } from './art-types';

/** docs/brand/coachs/ombre/ombre.svg */
function trainingDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-dark" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-sys-sk-plate`}
          cx="256"
          cy="204.8"
          r="317.44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#14223F" />
          <stop offset="0.6" stopColor="#0A1122" />
          <stop offset="1" stopColor="#05070D" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-sk-stroke`}
          x1="30.72"
          y1="30.72"
          x2="481.28"
          y2="481.28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#7A5CFF" />
        </linearGradient>
        <radialGradient id={`${p}-sys-sk-halo`} cx="256" cy="256" r="204.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3FB8FF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#3FB8FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-sk-face`}
          x1="0"
          y1="225.28"
          x2="0"
          y2="409.6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#111C33" />
          <stop offset="1" stopColor="#04070E" />
        </linearGradient>
        <radialGradient
          id={`${p}-sys-sk-spill`}
          cx="256"
          cy="271.36"
          r="102.4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#3FB8FF" stopOpacity="0.42" />
          <stop offset="1" stopColor="#3FB8FF" stopOpacity="0" />
        </radialGradient>
        <filter id={`${p}-sys-sk-glow`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="11.26" />
        </filter>
        <clipPath id={`${p}-sys-sk-clip`}>
          <polygon points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28" />
        </clipPath>
        <pattern id={`${p}-sys-sk-mail`} width="13.31" height="12.29" patternUnits="userSpaceOnUse">
          <path
            d="M0 6.14Q3.33 11.78 6.66 6.14Q9.98 11.78 13.31 6.14"
            fill="none"
            stroke="#7FE3FF"
            strokeOpacity="0.32"
            strokeWidth="1.79"
          />
        </pattern>
      </defs>
      <g id={`${p}-sys-frame`} data-g="sys-frame">
        <polygon
          points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28"
          fill={`url(#${p}-sys-sk-plate)`}
        />
        <g clipPath={`url(#${p}-sys-sk-clip)`}>
          <circle cx="256" cy="256" r="204.8" fill={`url(#${p}-sys-sk-halo)`} />
          <path
            d="M30.72 40.96H481.28M30.72 53.25H481.28M30.72 65.54H481.28M30.72 77.82H481.28M30.72 90.11H481.28M30.72 102.4H481.28M30.72 114.69H481.28M30.72 126.98H481.28M30.72 139.26H481.28M30.72 151.55H481.28M30.72 163.84H481.28M30.72 176.13H481.28M30.72 188.42H481.28M30.72 200.7H481.28M30.72 212.99H481.28M30.72 225.28H481.28M30.72 237.57H481.28M30.72 249.86H481.28M30.72 262.14H481.28M30.72 274.43H481.28M30.72 286.72H481.28M30.72 299.01H481.28M30.72 311.3H481.28M30.72 323.58H481.28M30.72 335.87H481.28M30.72 348.16H481.28M30.72 360.45H481.28M30.72 372.74H481.28M30.72 385.02H481.28M30.72 397.31H481.28M30.72 409.6H481.28M30.72 421.89H481.28M30.72 434.18H481.28M30.72 446.46H481.28M30.72 458.75H481.28M30.72 471.04H481.28"
            stroke="#5ED8FF"
            strokeOpacity="0.07"
            strokeWidth="2.56"
          />
        </g>
        <polygon
          points="107.52,51.2 404.48,51.2 460.8,107.52 460.8,404.48 404.48,460.8 107.52,460.8 51.2,404.48 51.2,107.52"
          fill="none"
          stroke="#5ED8FF"
          strokeOpacity="0.224"
          strokeWidth="2.56"
        />
        <path
          d="M64 174.08h16.38M448 174.08h-16.38M64 194.56h9.22M448 194.56h-9.22M64 215.04h9.22M448 215.04h-9.22M64 235.52h9.22M448 235.52h-9.22M64 256h16.38M448 256h-16.38M64 276.48h9.22M448 276.48h-9.22M64 296.96h9.22M448 296.96h-9.22M64 317.44h9.22M448 317.44h-9.22M64 337.92h16.38M448 337.92h-16.38"
          stroke="#5ED8FF"
          strokeOpacity="0.42"
          strokeWidth="3.07"
        />
        <path
          d="M317.44 481.28H414.72L481.28 414.72V97.28L414.72 30.72H97.28L30.72 97.28V414.72L97.28 481.28H194.56"
          fill="none"
          stroke={`url(#${p}-sys-sk-stroke)`}
          strokeWidth="11.26"
          strokeLinejoin="miter"
        />
        <path
          d="M4.1 238.08H20.48V273.92H4.1ZM491.52 238.08H507.9V273.92H491.52Z"
          fill={`url(#${p}-sys-sk-stroke)`}
        />
      </g>
      <g id={`${p}-sys-helm`} data-g="sys-helm">
        <polygon
          points="199.68,353.28 312.32,353.28 299.52,419.84 279.04,465.92 256,506.88 232.96,465.92 212.48,419.84"
          fill="#1E2C4A"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M220.16 371.2L256 391.68L291.84 371.2M223.23 396.8L256 417.28L288.77 396.8M228.35 422.4L256 442.88L283.65 422.4"
          fill="none"
          stroke="#4A6694"
          strokeWidth="5.12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M236.54 461.82H275.46" stroke="#4A6694" strokeWidth="10.24" />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-sk-face)`}
        />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-sk-spill)`}
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill="#283B5F"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill="#131D33"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill={`url(#${p}-sys-sk-mail)`}
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill={`url(#${p}-sys-sk-mail)`}
        />
        <polygon
          points="112.64,194.56 120.32,145.92 153.6,97.28 204.8,64.51 256,51.2 256,194.56"
          fill="#3A5280"
        />
        <polygon
          points="399.36,194.56 391.68,145.92 358.4,97.28 307.2,64.51 256,51.2 256,194.56"
          fill="#1B2844"
        />
        <path
          d="M112.64 194.56L120.32 145.92L153.6 97.28L204.8 64.51L256 51.2L307.2 64.51L358.4 97.28L391.68 145.92L399.36 194.56"
          fill="none"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M158.72 94.21Q140.29 138.24 141.31 194.56M353.28 94.21Q371.71 138.24 370.69 194.56"
          fill="none"
          stroke="#2E4469"
          strokeWidth="11.26"
        />
        <polygon points="244.74,53.25 267.26,53.25 271.36,194.56 240.64,194.56" fill="#2E4469" />
        <g fill="#4A6694">
          <circle cx="256" cy="87.04" r="4.61" />
          <circle cx="256" cy="122.88" r="4.61" />
          <circle cx="256" cy="158.72" r="4.61" />
        </g>
        <polygon
          points="99.84,189.44 412.16,189.44 419.84,207.36 412.16,225.28 99.84,225.28 92.16,207.36"
          fill="#2E4469"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <g fill="#4A6694">
          <circle cx="128" cy="207.36" r="4.61" />
          <circle cx="163.84" cy="207.36" r="4.61" />
          <circle cx="348.16" cy="207.36" r="4.61" />
          <circle cx="384" cy="207.36" r="4.61" />
        </g>
        <polygon
          points="133.12,225.28 378.88,225.28 376.32,250.88 355.84,288.77 296.96,293.89 273.92,304.13 266.24,337.92 256,350.21 245.76,337.92 238.08,304.13 215.04,293.89 156.16,288.77 135.68,250.88"
          fill="#16213A"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="135.68,267.26 166.4,243.71 256,236.03 345.6,243.71 376.32,267.26 343.04,283.65 256,276.48 168.96,283.65"
          fill="#02040A"
        />
        <polygon
          points="256,195.58 267.78,207.36 256,219.14 244.22,207.36"
          fill="#3FB8FF"
          filter={`url(#${p}-sys-sk-glow)`}
          opacity="0.8"
        />
        <polygon points="256,195.58 267.78,207.36 256,219.14 244.22,207.36" fill="#5ED8FF" />
      </g>
      <g id={`${p}-sys-visor`} data-g="sys-visor">
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#3FB8FF"
          filter={`url(#${p}-sys-sk-glow)`}
          opacity="0.95"
        />
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#5ED8FF"
        />
        <path
          d="M176.64 262.14L256 255.49L335.36 262.14"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="7.17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/ombre/ombre-light.svg */
function trainingLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="training-light" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-sys-skl-plate`}
          cx="256"
          cy="204.8"
          r="317.44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EDF2F9" />
          <stop offset="1" stopColor="#D9E2EE" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-skl-stroke`}
          x1="30.72"
          y1="30.72"
          x2="481.28"
          y2="481.28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1C6FB5" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
        <radialGradient id={`${p}-sys-skl-halo`} cx="256" cy="256" r="204.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3FB8FF" stopOpacity="0.2" />
          <stop offset="1" stopColor="#3FB8FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-skl-face`}
          x1="0"
          y1="225.28"
          x2="0"
          y2="409.6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#111C33" />
          <stop offset="1" stopColor="#04070E" />
        </linearGradient>
        <radialGradient
          id={`${p}-sys-skl-spill`}
          cx="256"
          cy="271.36"
          r="102.4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#3FB8FF" stopOpacity="0.42" />
          <stop offset="1" stopColor="#3FB8FF" stopOpacity="0" />
        </radialGradient>
        <filter id={`${p}-sys-skl-glow`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="11.26" />
        </filter>
        <clipPath id={`${p}-sys-skl-clip`}>
          <polygon points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28" />
        </clipPath>
        <pattern id={`${p}-sys-skl-mail`} width="13.31" height="12.29" patternUnits="userSpaceOnUse">
          <path
            d="M0 6.14Q3.33 11.78 6.66 6.14Q9.98 11.78 13.31 6.14"
            fill="none"
            stroke="#9FE6FF"
            strokeOpacity="0.32"
            strokeWidth="1.79"
          />
        </pattern>
      </defs>
      <g id={`${p}-sys-frame`} data-g="sys-frame">
        <polygon
          points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28"
          fill={`url(#${p}-sys-skl-plate)`}
        />
        <g clipPath={`url(#${p}-sys-skl-clip)`}>
          <circle cx="256" cy="256" r="204.8" fill={`url(#${p}-sys-skl-halo)`} />
          <path
            d="M30.72 40.96H481.28M30.72 53.25H481.28M30.72 65.54H481.28M30.72 77.82H481.28M30.72 90.11H481.28M30.72 102.4H481.28M30.72 114.69H481.28M30.72 126.98H481.28M30.72 139.26H481.28M30.72 151.55H481.28M30.72 163.84H481.28M30.72 176.13H481.28M30.72 188.42H481.28M30.72 200.7H481.28M30.72 212.99H481.28M30.72 225.28H481.28M30.72 237.57H481.28M30.72 249.86H481.28M30.72 262.14H481.28M30.72 274.43H481.28M30.72 286.72H481.28M30.72 299.01H481.28M30.72 311.3H481.28M30.72 323.58H481.28M30.72 335.87H481.28M30.72 348.16H481.28M30.72 360.45H481.28M30.72 372.74H481.28M30.72 385.02H481.28M30.72 397.31H481.28M30.72 409.6H481.28M30.72 421.89H481.28M30.72 434.18H481.28M30.72 446.46H481.28M30.72 458.75H481.28M30.72 471.04H481.28"
            stroke="#1C6FB5"
            strokeOpacity="0.05"
            strokeWidth="2.56"
          />
        </g>
        <polygon
          points="107.52,51.2 404.48,51.2 460.8,107.52 460.8,404.48 404.48,460.8 107.52,460.8 51.2,404.48 51.2,107.52"
          fill="none"
          stroke="#1C6FB5"
          strokeOpacity="0.21"
          strokeWidth="2.56"
        />
        <path
          d="M64 174.08h16.38M448 174.08h-16.38M64 194.56h9.22M448 194.56h-9.22M64 215.04h9.22M448 215.04h-9.22M64 235.52h9.22M448 235.52h-9.22M64 256h16.38M448 256h-16.38M64 276.48h9.22M448 276.48h-9.22M64 296.96h9.22M448 296.96h-9.22M64 317.44h9.22M448 317.44h-9.22M64 337.92h16.38M448 337.92h-16.38"
          stroke="#1C6FB5"
          strokeOpacity="0.4"
          strokeWidth="3.07"
        />
        <path
          d="M317.44 481.28H414.72L481.28 414.72V97.28L414.72 30.72H97.28L30.72 97.28V414.72L97.28 481.28H194.56"
          fill="none"
          stroke={`url(#${p}-sys-skl-stroke)`}
          strokeWidth="11.26"
          strokeLinejoin="miter"
        />
        <path
          d="M4.1 238.08H20.48V273.92H4.1ZM491.52 238.08H507.9V273.92H491.52Z"
          fill={`url(#${p}-sys-skl-stroke)`}
        />
      </g>
      <g id={`${p}-sys-helm`} data-g="sys-helm">
        <polygon
          points="199.68,353.28 312.32,353.28 299.52,419.84 279.04,465.92 256,506.88 232.96,465.92 212.48,419.84"
          fill="#202D4A"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M220.16 371.2L256 391.68L291.84 371.2M223.23 396.8L256 417.28L288.77 396.8M228.35 422.4L256 442.88L283.65 422.4"
          fill="none"
          stroke="#51699A"
          strokeWidth="5.12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M236.54 461.82H275.46" stroke="#51699A" strokeWidth="10.24" />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-skl-face)`}
        />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-skl-spill)`}
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill="#2A3A5C"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill="#152038"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill={`url(#${p}-sys-skl-mail)`}
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill={`url(#${p}-sys-skl-mail)`}
        />
        <polygon
          points="112.64,194.56 120.32,145.92 153.6,97.28 204.8,64.51 256,51.2 256,194.56"
          fill="#3B4F78"
        />
        <polygon
          points="399.36,194.56 391.68,145.92 358.4,97.28 307.2,64.51 256,51.2 256,194.56"
          fill="#1D2A45"
        />
        <path
          d="M112.64 194.56L120.32 145.92L153.6 97.28L204.8 64.51L256 51.2L307.2 64.51L358.4 97.28L391.68 145.92L399.36 194.56"
          fill="none"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M158.72 94.21Q140.29 138.24 141.31 194.56M353.28 94.21Q371.71 138.24 370.69 194.56"
          fill="none"
          stroke="#2C3E62"
          strokeWidth="11.26"
        />
        <polygon points="244.74,53.25 267.26,53.25 271.36,194.56 240.64,194.56" fill="#2C3E62" />
        <g fill="#51699A">
          <circle cx="256" cy="87.04" r="4.61" />
          <circle cx="256" cy="122.88" r="4.61" />
          <circle cx="256" cy="158.72" r="4.61" />
        </g>
        <polygon
          points="99.84,189.44 412.16,189.44 419.84,207.36 412.16,225.28 99.84,225.28 92.16,207.36"
          fill="#2C3E62"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <g fill="#51699A">
          <circle cx="128" cy="207.36" r="4.61" />
          <circle cx="163.84" cy="207.36" r="4.61" />
          <circle cx="348.16" cy="207.36" r="4.61" />
          <circle cx="384" cy="207.36" r="4.61" />
        </g>
        <polygon
          points="133.12,225.28 378.88,225.28 376.32,250.88 355.84,288.77 296.96,293.89 273.92,304.13 266.24,337.92 256,350.21 245.76,337.92 238.08,304.13 215.04,293.89 156.16,288.77 135.68,250.88"
          fill="#1A2540"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="135.68,267.26 166.4,243.71 256,236.03 345.6,243.71 376.32,267.26 343.04,283.65 256,276.48 168.96,283.65"
          fill="#02040A"
        />
        <polygon
          points="256,195.58 267.78,207.36 256,219.14 244.22,207.36"
          fill="#3FB8FF"
          filter={`url(#${p}-sys-skl-glow)`}
          opacity="0.8"
        />
        <polygon points="256,195.58 267.78,207.36 256,219.14 244.22,207.36" fill="#5ED8FF" />
      </g>
      <g id={`${p}-sys-visor`} data-g="sys-visor">
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#3FB8FF"
          filter={`url(#${p}-sys-skl-glow)`}
          opacity="0.95"
        />
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#5ED8FF"
        />
        <path
          d="M176.64 262.14L256 255.49L335.36 262.14"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="7.17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** docs/brand/coachs/ombre/ombre-nutrition.svg */
function nutritionDark(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-dark" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-sys-skn-plate`}
          cx="256"
          cy="204.8"
          r="317.44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#14223F" />
          <stop offset="0.6" stopColor="#0A1122" />
          <stop offset="1" stopColor="#05070D" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-skn-stroke`}
          x1="30.72"
          y1="30.72"
          x2="481.28"
          y2="481.28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5ED8FF" />
          <stop offset="1" stopColor="#7A5CFF" />
        </linearGradient>
        <radialGradient id={`${p}-sys-skn-halo`} cx="256" cy="256" r="204.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFA526" stopOpacity="0.3" />
          <stop offset="1" stopColor="#FFA526" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-skn-face`}
          x1="0"
          y1="225.28"
          x2="0"
          y2="409.6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#111C33" />
          <stop offset="1" stopColor="#04070E" />
        </linearGradient>
        <radialGradient
          id={`${p}-sys-skn-spill`}
          cx="256"
          cy="271.36"
          r="102.4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFA526" stopOpacity="0.42" />
          <stop offset="1" stopColor="#FFA526" stopOpacity="0" />
        </radialGradient>
        <filter id={`${p}-sys-skn-glow`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="11.26" />
        </filter>
        <clipPath id={`${p}-sys-skn-clip`}>
          <polygon points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28" />
        </clipPath>
        <pattern id={`${p}-sys-skn-mail`} width="13.31" height="12.29" patternUnits="userSpaceOnUse">
          <path
            d="M0 6.14Q3.33 11.78 6.66 6.14Q9.98 11.78 13.31 6.14"
            fill="none"
            stroke="#7FE3FF"
            strokeOpacity="0.32"
            strokeWidth="1.79"
          />
        </pattern>
        <mask id={`${p}-sys-skn-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect x="0" y="0" width="512" height="512" fill="#FFFFFF" />
          <polygon
            points="433.15,24.58 480.15,51.71 480.15,105.98 433.15,133.12 386.15,105.98 386.15,51.71"
            fill="#000000"
            stroke="#000000"
            strokeWidth="13.31"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g id={`${p}-sys-frame`} data-g="sys-frame" mask={`url(#${p}-sys-skn-cut)`}>
        <polygon
          points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28"
          fill={`url(#${p}-sys-skn-plate)`}
        />
        <g clipPath={`url(#${p}-sys-skn-clip)`}>
          <circle cx="256" cy="256" r="204.8" fill={`url(#${p}-sys-skn-halo)`} />
          <path
            d="M30.72 40.96H481.28M30.72 53.25H481.28M30.72 65.54H481.28M30.72 77.82H481.28M30.72 90.11H481.28M30.72 102.4H481.28M30.72 114.69H481.28M30.72 126.98H481.28M30.72 139.26H481.28M30.72 151.55H481.28M30.72 163.84H481.28M30.72 176.13H481.28M30.72 188.42H481.28M30.72 200.7H481.28M30.72 212.99H481.28M30.72 225.28H481.28M30.72 237.57H481.28M30.72 249.86H481.28M30.72 262.14H481.28M30.72 274.43H481.28M30.72 286.72H481.28M30.72 299.01H481.28M30.72 311.3H481.28M30.72 323.58H481.28M30.72 335.87H481.28M30.72 348.16H481.28M30.72 360.45H481.28M30.72 372.74H481.28M30.72 385.02H481.28M30.72 397.31H481.28M30.72 409.6H481.28M30.72 421.89H481.28M30.72 434.18H481.28M30.72 446.46H481.28M30.72 458.75H481.28M30.72 471.04H481.28"
            stroke="#5ED8FF"
            strokeOpacity="0.07"
            strokeWidth="2.56"
          />
        </g>
        <polygon
          points="107.52,51.2 404.48,51.2 460.8,107.52 460.8,404.48 404.48,460.8 107.52,460.8 51.2,404.48 51.2,107.52"
          fill="none"
          stroke="#5ED8FF"
          strokeOpacity="0.224"
          strokeWidth="2.56"
        />
        <path
          d="M64 174.08h16.38M448 174.08h-16.38M64 194.56h9.22M448 194.56h-9.22M64 215.04h9.22M448 215.04h-9.22M64 235.52h9.22M448 235.52h-9.22M64 256h16.38M448 256h-16.38M64 276.48h9.22M448 276.48h-9.22M64 296.96h9.22M448 296.96h-9.22M64 317.44h9.22M448 317.44h-9.22M64 337.92h16.38M448 337.92h-16.38"
          stroke="#5ED8FF"
          strokeOpacity="0.42"
          strokeWidth="3.07"
        />
        <path
          d="M317.44 481.28H414.72L481.28 414.72V97.28L414.72 30.72H97.28L30.72 97.28V414.72L97.28 481.28H194.56"
          fill="none"
          stroke={`url(#${p}-sys-skn-stroke)`}
          strokeWidth="11.26"
          strokeLinejoin="miter"
        />
        <path
          d="M4.1 238.08H20.48V273.92H4.1ZM491.52 238.08H507.9V273.92H491.52Z"
          fill={`url(#${p}-sys-skn-stroke)`}
        />
      </g>
      <g id={`${p}-sys-helm`} data-g="sys-helm">
        <polygon
          points="199.68,353.28 312.32,353.28 299.52,419.84 279.04,465.92 256,506.88 232.96,465.92 212.48,419.84"
          fill="#1E2C4A"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M220.16 371.2L256 391.68L291.84 371.2M223.23 396.8L256 417.28L288.77 396.8M228.35 422.4L256 442.88L283.65 422.4"
          fill="none"
          stroke="#4A6694"
          strokeWidth="5.12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M236.54 461.82H275.46" stroke="#4A6694" strokeWidth="10.24" />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-skn-face)`}
        />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-skn-spill)`}
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill="#283B5F"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill="#131D33"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill={`url(#${p}-sys-skn-mail)`}
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill={`url(#${p}-sys-skn-mail)`}
        />
        <polygon
          points="112.64,194.56 120.32,145.92 153.6,97.28 204.8,64.51 256,51.2 256,194.56"
          fill="#3A5280"
        />
        <polygon
          points="399.36,194.56 391.68,145.92 358.4,97.28 307.2,64.51 256,51.2 256,194.56"
          fill="#1B2844"
        />
        <path
          d="M112.64 194.56L120.32 145.92L153.6 97.28L204.8 64.51L256 51.2L307.2 64.51L358.4 97.28L391.68 145.92L399.36 194.56"
          fill="none"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M158.72 94.21Q140.29 138.24 141.31 194.56M353.28 94.21Q371.71 138.24 370.69 194.56"
          fill="none"
          stroke="#2E4469"
          strokeWidth="11.26"
        />
        <polygon points="244.74,53.25 267.26,53.25 271.36,194.56 240.64,194.56" fill="#2E4469" />
        <g fill="#4A6694">
          <circle cx="256" cy="87.04" r="4.61" />
          <circle cx="256" cy="122.88" r="4.61" />
          <circle cx="256" cy="158.72" r="4.61" />
        </g>
        <polygon
          points="99.84,189.44 412.16,189.44 419.84,207.36 412.16,225.28 99.84,225.28 92.16,207.36"
          fill="#2E4469"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <g fill="#4A6694">
          <circle cx="128" cy="207.36" r="4.61" />
          <circle cx="163.84" cy="207.36" r="4.61" />
          <circle cx="348.16" cy="207.36" r="4.61" />
          <circle cx="384" cy="207.36" r="4.61" />
        </g>
        <polygon
          points="133.12,225.28 378.88,225.28 376.32,250.88 355.84,288.77 296.96,293.89 273.92,304.13 266.24,337.92 256,350.21 245.76,337.92 238.08,304.13 215.04,293.89 156.16,288.77 135.68,250.88"
          fill="#16213A"
          stroke="#7FE3FF"
          strokeOpacity="0.55"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="135.68,267.26 166.4,243.71 256,236.03 345.6,243.71 376.32,267.26 343.04,283.65 256,276.48 168.96,283.65"
          fill="#02040A"
        />
        <polygon
          points="256,195.58 267.78,207.36 256,219.14 244.22,207.36"
          fill="#FFA526"
          filter={`url(#${p}-sys-skn-glow)`}
          opacity="0.8"
        />
        <polygon points="256,195.58 267.78,207.36 256,219.14 244.22,207.36" fill="#FFC857" />
      </g>
      <g id={`${p}-sys-visor`} data-g="sys-visor">
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#FFA526"
          filter={`url(#${p}-sys-skn-glow)`}
          opacity="0.95"
        />
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#FFC857"
        />
        <path
          d="M176.64 262.14L256 255.49L335.36 262.14"
          fill="none"
          stroke="#FFF5D9"
          strokeWidth="7.17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-sys-glyph`} data-g="sys-glyph">
        <polygon
          points="433.15,24.58 480.15,51.71 480.15,105.98 433.15,133.12 386.15,105.98 386.15,51.71"
          fill="#FFC857"
        />
        <g transform="translate(433.15 80.9) scale(0.9)">
          <rect x="-3.33" y="-12.8" width="6.66" height="53.76" rx="2.56" fill="#05070D" />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(0 -28.67) rotate(0)"
            fill="#05070D"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(-11.78 -8.19) rotate(-40)"
            fill="#05070D"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(11.78 -8.19) rotate(40)"
            fill="#05070D"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(-11.78 14.85) rotate(-40)"
            fill="#05070D"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(11.78 14.85) rotate(40)"
            fill="#05070D"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/coachs/ombre/ombre-nutrition-light.svg */
function nutritionLight(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="nutrition-light" {...svg}>
      <defs>
        <radialGradient
          id={`${p}-sys-sknl-plate`}
          cx="256"
          cy="204.8"
          r="317.44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EDF2F9" />
          <stop offset="1" stopColor="#D9E2EE" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-sknl-stroke`}
          x1="30.72"
          y1="30.72"
          x2="481.28"
          y2="481.28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1C6FB5" />
          <stop offset="1" stopColor="#6A48E8" />
        </linearGradient>
        <radialGradient id={`${p}-sys-sknl-halo`} cx="256" cy="256" r="204.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFA526" stopOpacity="0.2" />
          <stop offset="1" stopColor="#FFA526" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${p}-sys-sknl-face`}
          x1="0"
          y1="225.28"
          x2="0"
          y2="409.6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#111C33" />
          <stop offset="1" stopColor="#04070E" />
        </linearGradient>
        <radialGradient
          id={`${p}-sys-sknl-spill`}
          cx="256"
          cy="271.36"
          r="102.4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFA526" stopOpacity="0.42" />
          <stop offset="1" stopColor="#FFA526" stopOpacity="0" />
        </radialGradient>
        <filter id={`${p}-sys-sknl-glow`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="11.26" />
        </filter>
        <clipPath id={`${p}-sys-sknl-clip`}>
          <polygon points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28" />
        </clipPath>
        <pattern id={`${p}-sys-sknl-mail`} width="13.31" height="12.29" patternUnits="userSpaceOnUse">
          <path
            d="M0 6.14Q3.33 11.78 6.66 6.14Q9.98 11.78 13.31 6.14"
            fill="none"
            stroke="#9FE6FF"
            strokeOpacity="0.32"
            strokeWidth="1.79"
          />
        </pattern>
        <mask id={`${p}-sys-sknl-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect x="0" y="0" width="512" height="512" fill="#FFFFFF" />
          <polygon
            points="433.15,24.58 480.15,51.71 480.15,105.98 433.15,133.12 386.15,105.98 386.15,51.71"
            fill="#000000"
            stroke="#000000"
            strokeWidth="13.31"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g id={`${p}-sys-frame`} data-g="sys-frame" mask={`url(#${p}-sys-sknl-cut)`}>
        <polygon
          points="97.28,30.72 414.72,30.72 481.28,97.28 481.28,414.72 414.72,481.28 97.28,481.28 30.72,414.72 30.72,97.28"
          fill={`url(#${p}-sys-sknl-plate)`}
        />
        <g clipPath={`url(#${p}-sys-sknl-clip)`}>
          <circle cx="256" cy="256" r="204.8" fill={`url(#${p}-sys-sknl-halo)`} />
          <path
            d="M30.72 40.96H481.28M30.72 53.25H481.28M30.72 65.54H481.28M30.72 77.82H481.28M30.72 90.11H481.28M30.72 102.4H481.28M30.72 114.69H481.28M30.72 126.98H481.28M30.72 139.26H481.28M30.72 151.55H481.28M30.72 163.84H481.28M30.72 176.13H481.28M30.72 188.42H481.28M30.72 200.7H481.28M30.72 212.99H481.28M30.72 225.28H481.28M30.72 237.57H481.28M30.72 249.86H481.28M30.72 262.14H481.28M30.72 274.43H481.28M30.72 286.72H481.28M30.72 299.01H481.28M30.72 311.3H481.28M30.72 323.58H481.28M30.72 335.87H481.28M30.72 348.16H481.28M30.72 360.45H481.28M30.72 372.74H481.28M30.72 385.02H481.28M30.72 397.31H481.28M30.72 409.6H481.28M30.72 421.89H481.28M30.72 434.18H481.28M30.72 446.46H481.28M30.72 458.75H481.28M30.72 471.04H481.28"
            stroke="#1C6FB5"
            strokeOpacity="0.05"
            strokeWidth="2.56"
          />
        </g>
        <polygon
          points="107.52,51.2 404.48,51.2 460.8,107.52 460.8,404.48 404.48,460.8 107.52,460.8 51.2,404.48 51.2,107.52"
          fill="none"
          stroke="#1C6FB5"
          strokeOpacity="0.21"
          strokeWidth="2.56"
        />
        <path
          d="M64 174.08h16.38M448 174.08h-16.38M64 194.56h9.22M448 194.56h-9.22M64 215.04h9.22M448 215.04h-9.22M64 235.52h9.22M448 235.52h-9.22M64 256h16.38M448 256h-16.38M64 276.48h9.22M448 276.48h-9.22M64 296.96h9.22M448 296.96h-9.22M64 317.44h9.22M448 317.44h-9.22M64 337.92h16.38M448 337.92h-16.38"
          stroke="#1C6FB5"
          strokeOpacity="0.4"
          strokeWidth="3.07"
        />
        <path
          d="M317.44 481.28H414.72L481.28 414.72V97.28L414.72 30.72H97.28L30.72 97.28V414.72L97.28 481.28H194.56"
          fill="none"
          stroke={`url(#${p}-sys-sknl-stroke)`}
          strokeWidth="11.26"
          strokeLinejoin="miter"
        />
        <path
          d="M4.1 238.08H20.48V273.92H4.1ZM491.52 238.08H507.9V273.92H491.52Z"
          fill={`url(#${p}-sys-sknl-stroke)`}
        />
      </g>
      <g id={`${p}-sys-helm`} data-g="sys-helm">
        <polygon
          points="199.68,353.28 312.32,353.28 299.52,419.84 279.04,465.92 256,506.88 232.96,465.92 212.48,419.84"
          fill="#202D4A"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M220.16 371.2L256 391.68L291.84 371.2M223.23 396.8L256 417.28L288.77 396.8M228.35 422.4L256 442.88L283.65 422.4"
          fill="none"
          stroke="#51699A"
          strokeWidth="5.12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M236.54 461.82H275.46" stroke="#51699A" strokeWidth="10.24" />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-sknl-face)`}
        />
        <polygon
          points="138.24,220.16 373.76,220.16 366.08,317.44 322.56,373.76 256,399.36 189.44,373.76 145.92,317.44"
          fill={`url(#${p}-sys-sknl-spill)`}
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill="#2A3A5C"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill="#152038"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="102.4,222.72 143.36,222.72 151.04,317.44 186.88,371.2 168.96,412.16 115.2,373.76 97.28,307.2"
          fill={`url(#${p}-sys-sknl-mail)`}
        />
        <polygon
          points="409.6,222.72 368.64,222.72 360.96,317.44 325.12,371.2 343.04,412.16 396.8,373.76 414.72,307.2"
          fill={`url(#${p}-sys-sknl-mail)`}
        />
        <polygon
          points="112.64,194.56 120.32,145.92 153.6,97.28 204.8,64.51 256,51.2 256,194.56"
          fill="#3B4F78"
        />
        <polygon
          points="399.36,194.56 391.68,145.92 358.4,97.28 307.2,64.51 256,51.2 256,194.56"
          fill="#1D2A45"
        />
        <path
          d="M112.64 194.56L120.32 145.92L153.6 97.28L204.8 64.51L256 51.2L307.2 64.51L358.4 97.28L391.68 145.92L399.36 194.56"
          fill="none"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <path
          d="M158.72 94.21Q140.29 138.24 141.31 194.56M353.28 94.21Q371.71 138.24 370.69 194.56"
          fill="none"
          stroke="#2C3E62"
          strokeWidth="11.26"
        />
        <polygon points="244.74,53.25 267.26,53.25 271.36,194.56 240.64,194.56" fill="#2C3E62" />
        <g fill="#51699A">
          <circle cx="256" cy="87.04" r="4.61" />
          <circle cx="256" cy="122.88" r="4.61" />
          <circle cx="256" cy="158.72" r="4.61" />
        </g>
        <polygon
          points="99.84,189.44 412.16,189.44 419.84,207.36 412.16,225.28 99.84,225.28 92.16,207.36"
          fill="#2C3E62"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <g fill="#51699A">
          <circle cx="128" cy="207.36" r="4.61" />
          <circle cx="163.84" cy="207.36" r="4.61" />
          <circle cx="348.16" cy="207.36" r="4.61" />
          <circle cx="384" cy="207.36" r="4.61" />
        </g>
        <polygon
          points="133.12,225.28 378.88,225.28 376.32,250.88 355.84,288.77 296.96,293.89 273.92,304.13 266.24,337.92 256,350.21 245.76,337.92 238.08,304.13 215.04,293.89 156.16,288.77 135.68,250.88"
          fill="#1A2540"
          stroke="#9FE6FF"
          strokeOpacity="0.45"
          strokeWidth="3.58"
          strokeLinejoin="round"
        />
        <polygon
          points="135.68,267.26 166.4,243.71 256,236.03 345.6,243.71 376.32,267.26 343.04,283.65 256,276.48 168.96,283.65"
          fill="#02040A"
        />
        <polygon
          points="256,195.58 267.78,207.36 256,219.14 244.22,207.36"
          fill="#FFA526"
          filter={`url(#${p}-sys-sknl-glow)`}
          opacity="0.8"
        />
        <polygon points="256,195.58 267.78,207.36 256,219.14 244.22,207.36" fill="#FFC857" />
      </g>
      <g id={`${p}-sys-visor`} data-g="sys-visor">
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#FFA526"
          filter={`url(#${p}-sys-sknl-glow)`}
          opacity="0.95"
        />
        <polygon
          points="145.92,266.24 171.52,247.81 256,240.64 340.48,247.81 366.08,266.24 337.92,279.55 256,272.38 174.08,279.55"
          fill="#FFC857"
        />
        <path
          d="M176.64 262.14L256 255.49L335.36 262.14"
          fill="none"
          stroke="#FFF5D9"
          strokeWidth="7.17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-sys-glyph`} data-g="sys-glyph">
        <polygon
          points="433.15,24.58 480.15,51.71 480.15,105.98 433.15,133.12 386.15,105.98 386.15,51.71"
          fill="#9A6200"
        />
        <g transform="translate(433.15 80.9) scale(0.9)">
          <rect x="-3.33" y="-12.8" width="6.66" height="53.76" rx="2.56" fill="#FFF8E8" />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(0 -28.67) rotate(0)"
            fill="#FFF8E8"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(-11.78 -8.19) rotate(-40)"
            fill="#FFF8E8"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(11.78 -8.19) rotate(40)"
            fill="#FFF8E8"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(-11.78 14.85) rotate(-40)"
            fill="#FFF8E8"
          />
          <path
            d="M0,-13.82 Q8.19,0 0,13.82 Q-8.19,0 0,-13.82Z"
            transform="translate(11.78 14.85) rotate(40)"
            fill="#FFF8E8"
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

/** Avatar ombre : mode entraînement ou nutrition, version sombre ou claire ; ids préfixés par idPrefix. */
export function CoachOmbre({ mode, scheme, idPrefix, ...svg }: CoachArtProps) {
  return VARIANTS[mode][scheme](idPrefix, svg);
}

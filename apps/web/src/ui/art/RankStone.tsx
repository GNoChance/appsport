// fichier généré par svg-to-tsx.mjs : ne pas modifier à la main, relancer le script.
// Pierres de rang « Pierre runique » (E galet griffé … S monolithe éveillé), d'après docs/brand/rangs/ ;
// versions mini (24–32 px) d'après docs/brand/rangs/mini/.
import type { JSX } from 'react';
import type { ArtSvgProps, Rank, RankStoneProps } from './art-types';

/** docs/brand/rangs/rank-E.svg */
function rankE(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="E" {...svg}>
      <defs>
        <clipPath id={`${p}-pierre-e-vc`}>
          <path d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z" />
        </clipPath>
        <clipPath id={`${p}-pierre-e-vc2`}>
          <path
            d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z"
            transform="translate(-12 -11)"
          />
        </clipPath>
        <linearGradient
          id={`${p}-pierre-e-body`}
          gradientUnits="userSpaceOnUse"
          x1="91.1"
          y1="157.8"
          x2="434"
          y2="443.6"
        >
          <stop offset="0" stopColor="#C3BDB3" />
          <stop offset="1" stopColor="#8F887E" />
        </linearGradient>
        <mask id={`${p}-pierre-e-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M307 240H232V360H307M232 297.8H293.5"
            fill="none"
            stroke="#fff"
            strokeWidth="30"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
          />
        </mask>
      </defs>
      <g id={`${p}-pierre-e-frame`}>
        <g clipPath={`url(#${p}-pierre-e-vc)`}>
          <path
            d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z"
            fill="#756E64"
          />
          <g clipPath={`url(#${p}-pierre-e-vc2)`}>
            <path
              d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z"
              fill="#DDD8CF"
            />
            <path
              d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z"
              transform="translate(5 5)"
              fill={`url(#${p}-pierre-e-body)`}
            />
          </g>
        </g>
        <circle cx="266.6" cy="309.3" r="2.5" fill="#E9E4DB" opacity="0.5" />
        <circle cx="382.9" cy="311.6" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="299.5" cy="286.5" r="3.1" fill="#E9E4DB" opacity="0.5" />
        <circle cx="235.1" cy="349.4" r="1.6" fill="#9C9488" opacity="0.6" />
        <circle cx="152.4" cy="236.7" r="2" fill="#E9E4DB" opacity="0.5" />
        <circle cx="290.9" cy="194.2" r="2.5" fill="#E9E4DB" opacity="0.5" />
        <circle cx="234.6" cy="399.1" r="2.9" fill="#9C9488" opacity="0.6" />
        <circle cx="200" cy="335.9" r="1.3" fill="#6D665C" opacity="0.45" />
        <circle cx="192.9" cy="199.7" r="2" fill="#9C9488" opacity="0.6" />
        <circle cx="280.9" cy="322.6" r="1.5" fill="#9C9488" opacity="0.6" />
        <circle cx="261.7" cy="308.2" r="2.3" fill="#6D665C" opacity="0.45" />
        <circle cx="243.6" cy="339.2" r="2.1" fill="#9C9488" opacity="0.6" />
        <circle cx="251" cy="258.7" r="2.8" fill="#6D665C" opacity="0.45" />
        <circle cx="235" cy="374.9" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="210.4" cy="398.6" r="1.5" fill="#6D665C" opacity="0.45" />
        <circle cx="307.2" cy="336.1" r="2" fill="#6D665C" opacity="0.45" />
        <circle cx="220.6" cy="425.7" r="2.6" fill="#9C9488" opacity="0.6" />
        <circle cx="232" cy="420.4" r="2.2" fill="#E9E4DB" opacity="0.5" />
        <circle cx="196.7" cy="304.9" r="3.1" fill="#6D665C" opacity="0.45" />
        <circle cx="194.6" cy="274.5" r="1.4" fill="#6D665C" opacity="0.45" />
        <circle cx="346.6" cy="313.4" r="1.4" fill="#E9E4DB" opacity="0.5" />
        <circle cx="283.1" cy="335.6" r="3.3" fill="#9C9488" opacity="0.6" />
        <circle cx="296.3" cy="330.4" r="2.3" fill="#E9E4DB" opacity="0.5" />
        <circle cx="123.5" cy="344.1" r="3.4" fill="#E9E4DB" opacity="0.5" />
        <circle cx="334.8" cy="196.4" r="2.6" fill="#6D665C" opacity="0.45" />
        <circle cx="408.5" cy="265.4" r="2.6" fill="#9C9488" opacity="0.6" />
        <circle cx="318.8" cy="298.5" r="1.7" fill="#E9E4DB" opacity="0.5" />
        <circle cx="337.4" cy="247.8" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="221.8" cy="209.5" r="3.3" fill="#9C9488" opacity="0.6" />
        <circle cx="239.6" cy="400.9" r="2.7" fill="#E9E4DB" opacity="0.5" />
        <circle cx="261.2" cy="298.2" r="3" fill="#6D665C" opacity="0.45" />
        <circle cx="332.5" cy="396.4" r="3.4" fill="#9C9488" opacity="0.6" />
        <circle cx="295.5" cy="270.7" r="2.4" fill="#E9E4DB" opacity="0.5" />
        <circle cx="249.8" cy="235.1" r="2.8" fill="#E9E4DB" opacity="0.5" />
        <circle cx="233" cy="254.4" r="2" fill="#E9E4DB" opacity="0.5" />
        <circle cx="243.9" cy="227.9" r="1.9" fill="#9C9488" opacity="0.6" />
        <circle cx="284" cy="341.7" r="1.5" fill="#6D665C" opacity="0.45" />
        <circle cx="147.6" cy="392.8" r="3" fill="#6D665C" opacity="0.45" />
        <circle cx="157.4" cy="338.5" r="2.8" fill="#9C9488" opacity="0.6" />
        <circle cx="208.7" cy="185.5" r="2.6" fill="#9C9488" opacity="0.6" />
        <circle cx="338.3" cy="323" r="2.8" fill="#9C9488" opacity="0.6" />
        <circle cx="222.7" cy="376.2" r="1.6" fill="#6D665C" opacity="0.45" />
        <circle cx="138.7" cy="336.5" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="269.4" cy="408.2" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="354.6" cy="230" r="1.5" fill="#9C9488" opacity="0.6" />
        <circle cx="391.2" cy="292.8" r="3.4" fill="#9C9488" opacity="0.6" />
        <circle cx="224.5" cy="290" r="1.4" fill="#E9E4DB" opacity="0.5" />
        <circle cx="279.8" cy="321.1" r="3.3" fill="#6D665C" opacity="0.45" />
        <circle cx="242.6" cy="266.8" r="2" fill="#6D665C" opacity="0.45" />
        <circle cx="289.7" cy="289.5" r="2" fill="#9C9488" opacity="0.6" />
        <circle cx="286.3" cy="313.2" r="2.3" fill="#6D665C" opacity="0.45" />
        <circle cx="253.9" cy="274.1" r="1.7" fill="#6D665C" opacity="0.45" />
        <circle cx="239.3" cy="381.6" r="2.5" fill="#E9E4DB" opacity="0.5" />
        <circle cx="322.7" cy="265.8" r="3.2" fill="#9C9488" opacity="0.6" />
        <circle cx="204" cy="360.9" r="1.5" fill="#6D665C" opacity="0.45" />
        <circle cx="270.4" cy="352.8" r="3.2" fill="#6D665C" opacity="0.45" />
        <circle cx="398.7" cy="267.4" r="2.5" fill="#9C9488" opacity="0.6" />
        <circle cx="243.3" cy="222" r="2.8" fill="#6D665C" opacity="0.45" />
        <circle cx="337.3" cy="192.8" r="2.9" fill="#E9E4DB" opacity="0.5" />
        <circle cx="345.2" cy="192.8" r="1.6" fill="#6D665C" opacity="0.45" />
        <circle cx="177.5" cy="343.6" r="1.9" fill="#6D665C" opacity="0.45" />
        <circle cx="336.6" cy="373.6" r="3.3" fill="#E9E4DB" opacity="0.5" />
        <circle cx="280.5" cy="388.8" r="2.1" fill="#E9E4DB" opacity="0.5" />
        <circle cx="189.7" cy="415.1" r="2.4" fill="#6D665C" opacity="0.45" />
        <circle cx="242.3" cy="349.8" r="1.6" fill="#E9E4DB" opacity="0.5" />
        <circle cx="320.9" cy="237.8" r="1.4" fill="#6D665C" opacity="0.45" />
        <circle cx="395.3" cy="272" r="2.5" fill="#6D665C" opacity="0.45" />
        <circle cx="244.9" cy="215" r="1.3" fill="#6D665C" opacity="0.45" />
        <circle cx="225.3" cy="418.8" r="3.2" fill="#E9E4DB" opacity="0.5" />
        <circle cx="209" cy="256.8" r="1.2" fill="#E9E4DB" opacity="0.5" />
        <path
          d="M92 322C89 297 94 268 104 246C114 224 129.3 204.3 152 190C174.7 175.7 209.7 165 240 160C270.3 155 334 160 334 160C334 160 392 186 392 186C392 186 424 231.7 430 258C436 284.3 435.3 319 428 344C420.7 369 407 392 386 408C365 424 333.7 435 302 440C270.3 445 226 445.3 196 438C166 430.7 139.3 415.3 122 396C104.7 376.7 95 347 92 322Z"
          fill="none"
          stroke="#47423B"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-e-ornament`}>
        <path d="M307 239L324 236" stroke="#3A352F" strokeWidth="3.2" strokeLinecap="round" opacity="0.8" />
        <path d="M219 375L214 392" stroke="#3A352F" strokeWidth="3.2" strokeLinecap="round" opacity="0.8" />
        <path d="M307 361L322 363" stroke="#3A352F" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
        <path d="M146 330L170 318" stroke="#3A352F" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
        <path d="M152 342L166 336" stroke="#3A352F" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <path d="M360 252L384 278" stroke="#3A352F" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
      </g>
      <g id={`${p}-pierre-e-letter`}>
        <path
          d="M307 240H232V360H307M232 297.8H293.5"
          fill="none"
          stroke="#E6E1D8"
          strokeWidth="30"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <g mask={`url(#${p}-pierre-e-lmask)`}>
          <path
            d="M307 240H232V360H307M232 297.8H293.5"
            fill="none"
            stroke="#3A352F"
            strokeWidth="30"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
            transform="translate(-4 -4)"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/rangs/rank-D.svg */
function rankD(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="D" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-d-face`}
          gradientUnits="userSpaceOnUse"
          x1="120.1"
          y1="144.3"
          x2="393.9"
          y2="435.8"
        >
          <stop offset="0" stopColor="#B4B8BE" />
          <stop offset="1" stopColor="#878C93" />
        </linearGradient>
        <mask id={`${p}-pierre-d-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M212.4 222H237A62.6 70 0 0 1 237 362H212.4Z"
            fill="none"
            stroke="#fff"
            strokeWidth="36"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
          />
        </mask>
      </defs>
      <g id={`${p}-pierre-d-frame`}>
        <path
          d="M100 172L126 128L139.9 151.6L123.9 178.7Z"
          fill="#d0d4d9"
          stroke="#d0d4d9"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M126 128L386 120L375.4 144.3L139.9 151.6Z"
          fill="#cdd1d7"
          stroke="#cdd1d7"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M386 120L414 152L390.1 161.2L375.4 144.3Z"
          fill="#a6aab0"
          stroke="#a6aab0"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M414 152L418 420L393.9 411.9L390.1 161.2Z"
          fill="#83888e"
          stroke="#83888e"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M418 420L390 456L378.1 432.2L393.9 411.9Z"
          fill="#70757c"
          stroke="#70757c"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M390 456L122 460L132.8 435.8L378.1 432.2Z"
          fill="#757980"
          stroke="#757980"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M122 460L96 430L120.1 421.2L132.8 435.8Z"
          fill="#989ca3"
          stroke="#989ca3"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M96 430L100 172L123.9 178.7L120.1 421.2Z"
          fill="#bdc2c7"
          stroke="#bdc2c7"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M123.9 178.7L139.9 151.6L375.4 144.3L390.1 161.2L393.9 411.9L378.1 432.2L132.8 435.8L120.1 421.2Z"
          fill={`url(#${p}-pierre-d-face)`}
        />
        <circle cx="238.5" cy="274.6" r="1.8" fill="#6E737A" opacity="0.35" />
        <circle cx="250.6" cy="404.4" r="1.7" fill="#E3E6EA" opacity="0.45" />
        <circle cx="241.4" cy="370.6" r="1.7" fill="#6E737A" opacity="0.35" />
        <circle cx="288" cy="243.5" r="2.7" fill="#6E737A" opacity="0.35" />
        <circle cx="176.6" cy="305.9" r="1.2" fill="#E3E6EA" opacity="0.45" />
        <circle cx="253.9" cy="211.7" r="1.9" fill="#E3E6EA" opacity="0.45" />
        <circle cx="146.9" cy="339.3" r="2.6" fill="#E3E6EA" opacity="0.45" />
        <circle cx="297.8" cy="316.1" r="1.7" fill="#6E737A" opacity="0.35" />
        <circle cx="224.6" cy="235.1" r="1.8" fill="#E3E6EA" opacity="0.45" />
        <circle cx="226.5" cy="414.6" r="2.4" fill="#E3E6EA" opacity="0.45" />
        <circle cx="206.2" cy="396.4" r="2.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="295.5" cy="181.6" r="1.2" fill="#6E737A" opacity="0.35" />
        <circle cx="147.9" cy="355.4" r="2.4" fill="#6E737A" opacity="0.35" />
        <circle cx="196.7" cy="206.9" r="2.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="153.4" cy="205.7" r="2.4" fill="#E3E6EA" opacity="0.45" />
        <circle cx="178.8" cy="407" r="1.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="143.8" cy="365.5" r="2.3" fill="#E3E6EA" opacity="0.45" />
        <circle cx="232.6" cy="236.5" r="1.9" fill="#6E737A" opacity="0.35" />
        <circle cx="335.4" cy="217.1" r="1.4" fill="#6E737A" opacity="0.35" />
        <circle cx="272.8" cy="259.9" r="2" fill="#6E737A" opacity="0.35" />
        <circle cx="369.1" cy="249.2" r="2.3" fill="#6E737A" opacity="0.35" />
        <circle cx="212.2" cy="201.8" r="2.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="278.2" cy="417.1" r="1.2" fill="#6E737A" opacity="0.35" />
        <circle cx="313.7" cy="333.1" r="2" fill="#6E737A" opacity="0.35" />
        <circle cx="352" cy="209.8" r="1.9" fill="#E3E6EA" opacity="0.45" />
        <circle cx="247.8" cy="327.4" r="1.1" fill="#E3E6EA" opacity="0.45" />
        <circle cx="322.2" cy="263.1" r="2.1" fill="#E3E6EA" opacity="0.45" />
        <circle cx="340.9" cy="314" r="2.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="248.5" cy="392.9" r="1.2" fill="#6E737A" opacity="0.35" />
        <circle cx="174.1" cy="215" r="1.2" fill="#E3E6EA" opacity="0.45" />
        <circle cx="320.3" cy="263.1" r="1.6" fill="#E3E6EA" opacity="0.45" />
        <circle cx="287.1" cy="268.4" r="1.7" fill="#6E737A" opacity="0.35" />
        <circle cx="275.7" cy="208.2" r="1.2" fill="#6E737A" opacity="0.35" />
        <circle cx="170.8" cy="398.5" r="2.1" fill="#E3E6EA" opacity="0.45" />
        <circle cx="366.4" cy="275.2" r="1.6" fill="#E3E6EA" opacity="0.45" />
        <circle cx="228.4" cy="187.4" r="2.2" fill="#6E737A" opacity="0.35" />
        <circle cx="251.6" cy="322" r="2.5" fill="#6E737A" opacity="0.35" />
        <circle cx="311.7" cy="269.2" r="2.1" fill="#E3E6EA" opacity="0.45" />
        <circle cx="331.2" cy="378.7" r="1.7" fill="#6E737A" opacity="0.35" />
        <circle cx="266.1" cy="369.9" r="1.5" fill="#E3E6EA" opacity="0.45" />
        <circle cx="279.7" cy="356.2" r="2.3" fill="#E3E6EA" opacity="0.45" />
        <circle cx="200.5" cy="355.9" r="1.4" fill="#E3E6EA" opacity="0.45" />
        <circle cx="290.1" cy="404" r="2.4" fill="#E3E6EA" opacity="0.45" />
        <circle cx="275.7" cy="177.8" r="2.6" fill="#E3E6EA" opacity="0.45" />
        <circle cx="168.6" cy="418" r="2.2" fill="#6E737A" opacity="0.35" />
        <circle cx="275.4" cy="389.6" r="2.1" fill="#E3E6EA" opacity="0.45" />
        <path d="M100 172L123.9 178.7" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M126 128L139.9 151.6" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M386 120L375.4 144.3" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M414 152L390.1 161.2" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M418 420L393.9 411.9" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M390 456L378.1 432.2" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M122 460L132.8 435.8" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path d="M96 430L120.1 421.2" stroke="#5C6168" strokeWidth="1.6" opacity="0.6" />
        <path
          d="M100 172L126 128L386 120L414 152L418 420L390 456L122 460L96 430Z"
          fill="none"
          stroke="#33373D"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-d-ornament`}>
        <path
          d="M147.3 132.6L154.3 146.3"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M165.4 132.1L169.6 141.5"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M183.6 131.5L188.7 145.3"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M201.8 130.9L204.6 140.5"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M220 130.4L223 144.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M238.2 129.8L239.6 139.4"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M256.4 129.3L257.3 143.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M274.6 128.7L274.5 138.3"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M292.7 128.2L291.7 142.1"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M310.9 127.6L309.5 137.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M329.1 127L326 141.1"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M347.3 126.5L344.5 136.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M365.5 125.9L360.4 140"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M113.2 160.1L125.1 167.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M121.1 146.6L128 153.8"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M101.6 406.9L115.6 402.5"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M102 385.6L111.6 383.2"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M102.3 364.4L116.3 361.6"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M102.6 343.2L112.2 341.8"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M103 322L116.9 320.6"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M103.3 300.8L112.9 300.4"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M103.6 279.6L117.5 279.7"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M103.9 258.3L113.5 259"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M104.3 237.1L118.2 238.8"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M104.6 215.9L114.2 217.6"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M104.9 194.7L118.8 197.9"
          stroke="#7C8189"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M409.1 176L395.2 180.5"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M409.4 198.1L399.8 200.6"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M409.7 220.1L395.9 222.9"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M410.1 242.1L400.5 243.5"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M410.4 264.1L396.5 265.3"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M410.7 286.1L401.1 286.3"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M411 308.1L397.1 307.6"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M411.4 330.2L401.8 329.2"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M411.7 352.2L397.8 350"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M412 374.2L402.4 372.1"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M412.4 396.2L398.4 392.4"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M367.2 451.1L361.3 437.2"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M346.9 451.4L343.6 441.8"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M326.7 451.7L322.8 437.8"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M306.5 452L304.5 442.4"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M286.2 452.3L284.4 438.4"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M266 452.6L265.4 443"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M245.8 452.9L246 438.9"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M225.5 453.2L226.4 443.6"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M205.3 453.5L207.5 439.5"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M185.1 453.8L187.3 444.1"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M164.8 454.1L169.1 440.1"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M144.6 454.4L148.2 444.7"
          stroke="#4E535A"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
      <g id={`${p}-pierre-d-letter`}>
        <path
          d="M212.4 222H237A62.6 70 0 0 1 237 362H212.4Z"
          fill="none"
          stroke="#E2E5E9"
          strokeWidth="36"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <g mask={`url(#${p}-pierre-d-lmask)`}>
          <path
            d="M212.4 222H237A62.6 70 0 0 1 237 362H212.4Z"
            fill="none"
            stroke="#272B31"
            strokeWidth="36"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
            transform="translate(-6 -6)"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/rangs/rank-C.svg */
function rankC(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="C" {...svg}>
      <defs>
        <clipPath id={`${p}-pierre-c-vc`}>
          <path d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z" />
        </clipPath>
        <clipPath id={`${p}-pierre-c-vc2`}>
          <path
            d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z"
            transform="translate(-12 -10)"
          />
        </clipPath>
        <linearGradient
          id={`${p}-pierre-c-body`}
          gradientUnits="userSpaceOnUse"
          x1="92.4"
          y1="91.3"
          x2="419"
          y2="448"
        >
          <stop offset="0" stopColor="#A3AEBB" />
          <stop offset="1" stopColor="#6E7987" />
        </linearGradient>
        <mask id={`${p}-pierre-c-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M304.9 222A62.9 72 0 1 0 304.9 322"
            fill="none"
            stroke="#fff"
            strokeWidth="38"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
          />
        </mask>
      </defs>
      <g id={`${p}-pierre-c-frame`}>
        <g clipPath={`url(#${p}-pierre-c-vc)`}>
          <path
            d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z"
            fill="#5A6471"
          />
          <g clipPath={`url(#${p}-pierre-c-vc2)`}>
            <path
              d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z"
              fill="#C3CCD7"
            />
            <path
              d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z"
              transform="translate(5 5)"
              fill={`url(#${p}-pierre-c-body)`}
            />
          </g>
        </g>
        <circle cx="311.9" cy="389.5" r="1.2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="228.5" cy="214.6" r="2.5" fill="#56616E" opacity="0.4" />
        <circle cx="357.7" cy="328" r="2.2" fill="#56616E" opacity="0.4" />
        <circle cx="279.4" cy="241.8" r="1.2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="325.5" cy="362.5" r="1.5" fill="#D2DAE3" opacity="0.45" />
        <circle cx="379.7" cy="388.5" r="2.3" fill="#D2DAE3" opacity="0.45" />
        <circle cx="148.9" cy="155.4" r="1.5" fill="#D2DAE3" opacity="0.45" />
        <circle cx="183" cy="331.6" r="2.6" fill="#D2DAE3" opacity="0.45" />
        <circle cx="359.7" cy="388.8" r="1.6" fill="#D2DAE3" opacity="0.45" />
        <circle cx="217.7" cy="224.7" r="2.4" fill="#56616E" opacity="0.4" />
        <circle cx="107.2" cy="251.7" r="2.6" fill="#D2DAE3" opacity="0.45" />
        <circle cx="306.5" cy="382.8" r="1.7" fill="#D2DAE3" opacity="0.45" />
        <circle cx="141.3" cy="432.6" r="2.5" fill="#D2DAE3" opacity="0.45" />
        <circle cx="358.8" cy="187.5" r="1.7" fill="#D2DAE3" opacity="0.45" />
        <circle cx="376.6" cy="375.1" r="1.8" fill="#D2DAE3" opacity="0.45" />
        <circle cx="213.2" cy="399.8" r="2.3" fill="#56616E" opacity="0.4" />
        <circle cx="216.5" cy="380.1" r="2.5" fill="#56616E" opacity="0.4" />
        <circle cx="144.5" cy="390.6" r="2.5" fill="#D2DAE3" opacity="0.45" />
        <circle cx="249.8" cy="257.3" r="1.6" fill="#56616E" opacity="0.4" />
        <circle cx="131.2" cy="306.2" r="1.9" fill="#56616E" opacity="0.4" />
        <circle cx="256.3" cy="293.2" r="1.9" fill="#56616E" opacity="0.4" />
        <circle cx="378.2" cy="257.1" r="2.3" fill="#56616E" opacity="0.4" />
        <circle cx="282.9" cy="132.7" r="1.4" fill="#56616E" opacity="0.4" />
        <circle cx="390.6" cy="221.6" r="1.6" fill="#56616E" opacity="0.4" />
        <circle cx="291.6" cy="245.8" r="1.3" fill="#56616E" opacity="0.4" />
        <circle cx="115.9" cy="342.1" r="2" fill="#56616E" opacity="0.4" />
        <circle cx="241.2" cy="230.1" r="2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="246" cy="215.4" r="2.1" fill="#D2DAE3" opacity="0.45" />
        <circle cx="159.8" cy="390" r="2.2" fill="#56616E" opacity="0.4" />
        <circle cx="224.9" cy="186.6" r="2" fill="#56616E" opacity="0.4" />
        <circle cx="309.8" cy="311.3" r="2.4" fill="#56616E" opacity="0.4" />
        <circle cx="345.2" cy="258.2" r="1.1" fill="#56616E" opacity="0.4" />
        <circle cx="175.3" cy="182.9" r="1.4" fill="#D2DAE3" opacity="0.45" />
        <circle cx="227.2" cy="214.1" r="2.6" fill="#56616E" opacity="0.4" />
        <circle cx="144.1" cy="290.8" r="2" fill="#56616E" opacity="0.4" />
        <circle cx="331.3" cy="358.4" r="1.2" fill="#56616E" opacity="0.4" />
        <circle cx="257.3" cy="140.4" r="2.3" fill="#56616E" opacity="0.4" />
        <circle cx="125.3" cy="352.8" r="1.3" fill="#56616E" opacity="0.4" />
        <circle cx="355.4" cy="150" r="1.8" fill="#D2DAE3" opacity="0.45" />
        <circle cx="364" cy="272.5" r="1.6" fill="#56616E" opacity="0.4" />
        <circle cx="159.8" cy="206.7" r="1.9" fill="#56616E" opacity="0.4" />
        <circle cx="221" cy="121.5" r="1.8" fill="#56616E" opacity="0.4" />
        <circle cx="310.5" cy="188.7" r="2.2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="251.4" cy="140.3" r="1.5" fill="#D2DAE3" opacity="0.45" />
        <circle cx="329.4" cy="177.5" r="1.5" fill="#56616E" opacity="0.4" />
        <circle cx="232" cy="311.7" r="2.4" fill="#56616E" opacity="0.4" />
        <circle cx="178.9" cy="190.6" r="2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="297.5" cy="168" r="2" fill="#D2DAE3" opacity="0.45" />
        <circle cx="153.3" cy="253.3" r="1.5" fill="#56616E" opacity="0.4" />
        <circle cx="269" cy="338.1" r="2.5" fill="#D2DAE3" opacity="0.45" />
        <path
          d="M106 448C106 448 96 372.3 94 332C92 291.7 91.7 239.7 94 206C96.3 172.3 97.3 148 108 130C118.7 112 134 104.3 158 98C182 91.7 220.7 90.3 252 92C283.3 93.7 321.7 99.7 346 108C370.3 116.3 386.3 124 398 142C409.7 160 412.7 183.7 416 216C419.3 248.3 419.7 297.3 418 336C416.3 374.7 406 448 406 448C406 448 106 448 106 448Z"
          fill="none"
          stroke="#2A313A"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-c-ornament`}>
        <path
          d="M150.1 398.3L148.1 396L146.9 394L144.4 387.3L142.7 378.8L140.8 363.8L138.8 338.3L137.5 314.7L136.7 287L136.6 259.3L136.9 237.6L137.8 216L139 198.5L140.4 185.3L142.4 174.7L144.8 166.7L148.1 159.6L151.5 154.8L156.6 149.9L163 145.9L172.1 142.1L182.4 139.6L193.2 137.8L208.3 136.5L223.7 136L241.1 136.2L258.5 137.1L275.8 138.9L293 141.4L309.9 144.7L322.5 148.1L334.4 152.4L343.5 157L350.1 161.7L355.5 167.1L360.1 173.4L363.6 180.6L366.4 188.7L368.8 199.3L370.6 210.4L372.1 223.8L373.4 241.3L374.4 264.9L374.7 290.5L374.3 318.1L373.2 341.6L371.4 365.1L369.5 380L367.1 389.7L365.6 393.6L363.8 396.5L361.7 398.6L359 400.3L352.7 402.3L344.4 403.4L329.3 404L175.9 403.8L166.7 403.3L160.1 402.4L154.7 400.9L150.8 398.8ZM132.8 417.7L130.5 415.5L126.8 410.9L122.7 403.7L119.4 394.1L116.7 380.9L114.4 360.2L112.2 329.9L111.1 301.6L110.6 271.3L110.8 243L111.6 218.7L113.1 196.2L115 179.5L117.7 166.4L121.3 155.3L125.7 146.5L128.4 142.2L131.5 138.2L135 134.4L138.7 131L146.8 125.1L151.2 122.7L157.7 119.7L168.6 116.1L181.5 113.3L196.4 111.3L215.1 110.1L233.7 110L254.3 110.8L276.9 112.8L297.4 115.7L315.8 119.4L332.2 123.9L346.7 129.4L356.9 134.8L366.6 141.6L373.7 148.4L379.8 156.1L384.8 164.4L389.3 175.1L393 188.1L395.4 200.7L397.3 215.2L399.1 235.7L400.4 264.2L400.7 298.6L399.8 331.1L398 359.5L395.8 380.1L393.2 393.3L390 402.8L387.6 407.6L384.3 412.5L380.3 416.9L375.6 420.7L370.6 423.6L365.4 425.8L360.4 427.2L353.2 428.6L346.5 429.3L335.8 429.8L191.5 430L170.9 429.6L159.9 428.7L150.3 426.8L142.7 424.1L135.1 419.6Z"
          fill="#6B7684"
          fillRule="evenodd"
          stroke="#262C35"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path
          d="M153 395L149.1 390.4L147 387L145.4 383.4L143.1 375.7L141.1 363.9L139.3 346L137.8 320.1L136.9 294.1L136.6 266.2L136.8 242.2L137.6 220.2L138.7 202.3L140.2 188.4L142 178.5L144.9 169L148.3 161.8L152.9 155.3L158.8 149.9L165.6 145.6L172.9 142.5L182.5 139.8L194.3 137.8L208.3 136.5L224.2 136L240.2 136.2L258.2 137.1L276.1 138.9L291.9 141.2L307.6 144.3L319.2 147.3L330.5 151.2L339.5 155.5L347.8 161L353.7 166.5L358.6 172.8L362.5 179.7L366 189.1L368.5 198.7L370.5 210.5L372.1 224.4L373.3 240.4L374.4 266.3L374.7 294.3L374.2 322.3L372.8 348.2L371.2 364.1L369.2 375.9L367.5 381.7L366.1 385.4L364.2 388.9L361.9 392.2L359.1 395.1L355.9 397.4L352.4 399.3L346.8 401.3L336.9 403.1L321 403.9L201.1 404L183.1 403.7L173.2 402.8L165.3 401.3L159.7 399.3L154.6 396.2Z"
          fill="none"
          stroke="#BAC4CF"
          strokeWidth="2"
          opacity="0.55"
          transform="translate(1.5 1.5)"
        />
        <path
          d="M129.9 421L127.1 418.1L124.8 414.8L121.5 407.6L119.8 401.8L118.5 396L116.5 382.1L113.7 352.3L111.8 322.4L110.8 290.4L110.6 258.4L111.1 232.5L112.2 208.5L113.8 188.6L115.6 174.7L118.1 163L121.3 153.5L125.7 144.6L127.8 141.2L131.5 136.5L138.7 129.6L147 124.1L156.1 119.8L167.5 116.1L181.1 113.2L197 111.2L214.9 110.1L234.9 110L256.9 110.9L276.8 112.8L296.6 115.6L316.2 119.5L333.5 124.2L346.6 129.1L357.3 134.4L362.4 137.6L367.2 141.2L374.5 148L380.6 155.9L385.6 164.6L390 175.7L393.1 187.3L395.6 201.1L397.5 216.9L399.2 236.8L400.4 264.8L400.7 296.8L400 326.7L398.2 356.6L395.8 382.5L393.3 398.3L391.9 404.1L389.9 409.8L387.2 415.1L384.8 418.3L382 421.2L378.8 423.5L375.3 425.4L369.6 427.3L363.8 428.6L357.8 429.3L343.8 429.9L164 429.8L152 429.1L144.1 427.8L136.6 425.3L131.4 422.2Z"
          fill="none"
          stroke="#BAC4CF"
          strokeWidth="2"
          opacity="0.4"
          transform="translate(1.5 1.5)"
        />
        <path
          d="M137.1 412.8L139.8 394L123.4 382L134.5 366.4L120.2 351.6L132.2 336.8L118.3 321.5L130.7 307L117.3 291.4L130.1 277.2L117.1 261.2L130.3 245.4L117.6 231.1L131.3 215.6L119.2 200.8L133.7 186.3L123.4 170.2L140.8 159.5L138 140.7L158.5 140.9L166.2 123.6L184.8 132.5L199 117.6L213.8 129.7L229.6 116.4L243.3 129.7L260 117.7L272.7 131.9L290.3 121.2L301.8 136.4L320.3 127.2L329.9 143.7L349.8 138.2L355.5 157.8L374.5 159.7L370.3 179.9L386.7 189.5L376.8 207.6L391.3 220L379.6 237L393.4 250.2L381 266.7L394.2 280.4L381.2 296.4L394 312.6L380.5 326.2L392.7 342.8L378.7 355.9L390.1 373.1L375.2 384.8L381.9 404.4L363.3 405.4L352.3 422.1L337.2 410.3L321.5 423.5L305.5 410.5L291.5 423.5L275.5 410.5L261.5 423.5L245.5 410.5L231.5 423.5L215.5 410.5L201.5 423.5L185.6 410.5L171.2 423.2L157.1 408.4Z"
          fill="none"
          stroke="#C3CCD7"
          strokeWidth="2.2"
          strokeLinejoin="miter"
          opacity="0.45"
          transform="translate(1.6 1.6)"
        />
        <path
          d="M137.1 412.8L139.8 394L123.4 382L134.5 366.4L120.2 351.6L132.2 336.8L118.3 321.5L130.7 307L117.3 291.4L130.1 277.2L117.1 261.2L130.3 245.4L117.6 231.1L131.3 215.6L119.2 200.8L133.7 186.3L123.4 170.2L140.8 159.5L138 140.7L158.5 140.9L166.2 123.6L184.8 132.5L199 117.6L213.8 129.7L229.6 116.4L243.3 129.7L260 117.7L272.7 131.9L290.3 121.2L301.8 136.4L320.3 127.2L329.9 143.7L349.8 138.2L355.5 157.8L374.5 159.7L370.3 179.9L386.7 189.5L376.8 207.6L391.3 220L379.6 237L393.4 250.2L381 266.7L394.2 280.4L381.2 296.4L394 312.6L380.5 326.2L392.7 342.8L378.7 355.9L390.1 373.1L375.2 384.8L381.9 404.4L363.3 405.4L352.3 422.1L337.2 410.3L321.5 423.5L305.5 410.5L291.5 423.5L275.5 410.5L261.5 423.5L245.5 410.5L231.5 423.5L215.5 410.5L201.5 423.5L185.6 410.5L171.2 423.2L157.1 408.4Z"
          fill="none"
          stroke="#232931"
          strokeWidth="3.6"
          strokeLinejoin="miter"
        />
      </g>
      <g id={`${p}-pierre-c-letter`}>
        <path
          d="M304.9 222A62.9 72 0 1 0 304.9 322"
          fill="none"
          stroke="#D3DAE2"
          strokeWidth="38"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <g mask={`url(#${p}-pierre-c-lmask)`}>
          <path
            d="M304.9 222A62.9 72 0 1 0 304.9 322"
            fill="none"
            stroke="#1E242C"
            strokeWidth="38"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
            transform="translate(-6 -6)"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/rangs/rank-B.svg */
function rankB(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="B" {...svg}>
      <defs>
        <clipPath id={`${p}-pierre-b-vc`}>
          <path d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z" />
        </clipPath>
        <clipPath id={`${p}-pierre-b-vc2`}>
          <path
            d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z"
            transform="translate(-12 -10)"
          />
        </clipPath>
        <linearGradient
          id={`${p}-pierre-b-body`}
          gradientUnits="userSpaceOnUse"
          x1="97.8"
          y1="37.7"
          x2="416"
          y2="472"
        >
          <stop offset="0" stopColor="#646B77" />
          <stop offset="1" stopColor="#3A4049" />
        </linearGradient>
        <mask id={`${p}-pierre-b-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M216.2 255.4V186H253.7A36.4 34.7 0 0 1 253.7 255.4ZM216.2 255.4H256.4A43.4 41.3 0 0 1 256.4 338H216.2Z"
            fill="none"
            stroke="#fff"
            strokeWidth="38"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
          />
        </mask>
        <linearGradient
          id={`${p}-pierre-b-ochre`}
          gradientUnits="userSpaceOnUse"
          x1="100"
          y1="40"
          x2="410"
          y2="470"
        >
          <stop offset="0" stopColor="#E98557" />
          <stop offset="1" stopColor="#B9502E" />
        </linearGradient>
        <linearGradient
          id={`${p}-pierre-b-lpaint`}
          gradientUnits="userSpaceOnUse"
          x1="200"
          y1="160"
          x2="320"
          y2="360"
        >
          <stop offset="0" stopColor="#F59A68" />
          <stop offset="1" stopColor="#DE6A3E" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-b-frame`}>
        <g clipPath={`url(#${p}-pierre-b-vc)`}>
          <path
            d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z"
            fill="#2B3037"
          />
          <g clipPath={`url(#${p}-pierre-b-vc2)`}>
            <path
              d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z"
              fill="#8E96A3"
            />
            <path
              d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z"
              transform="translate(5 5)"
              fill={`url(#${p}-pierre-b-body)`}
            />
          </g>
        </g>
        <circle cx="368.6" cy="258.7" r="2" fill="#22262C" opacity="0.5" />
        <circle cx="368.9" cy="251.3" r="1.9" fill="#C9CED6" opacity="0.35" />
        <circle cx="362.5" cy="181.3" r="2.7" fill="#22262C" opacity="0.5" />
        <circle cx="227.1" cy="130" r="2.3" fill="#9AA1AC" opacity="0.45" />
        <circle cx="355.4" cy="172.3" r="2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="166.7" cy="203" r="1.9" fill="#9AA1AC" opacity="0.45" />
        <circle cx="368.6" cy="115.6" r="2.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="250.4" cy="254.1" r="1.5" fill="#C9CED6" opacity="0.35" />
        <circle cx="326.5" cy="236.4" r="1.4" fill="#22262C" opacity="0.5" />
        <circle cx="158.8" cy="349" r="1.5" fill="#22262C" opacity="0.5" />
        <circle cx="377" cy="347.5" r="1.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="250.6" cy="117.3" r="1.3" fill="#22262C" opacity="0.5" />
        <circle cx="223.5" cy="418.3" r="1.8" fill="#C9CED6" opacity="0.35" />
        <circle cx="161.6" cy="282.8" r="2.7" fill="#C9CED6" opacity="0.35" />
        <circle cx="288" cy="456.2" r="2.1" fill="#9AA1AC" opacity="0.45" />
        <circle cx="190.9" cy="301.4" r="1.5" fill="#9AA1AC" opacity="0.45" />
        <circle cx="391.3" cy="311.2" r="1.5" fill="#9AA1AC" opacity="0.45" />
        <circle cx="329.5" cy="100.7" r="2.1" fill="#22262C" opacity="0.5" />
        <circle cx="188.7" cy="396.4" r="2.1" fill="#C9CED6" opacity="0.35" />
        <circle cx="394.6" cy="156.2" r="1.2" fill="#22262C" opacity="0.5" />
        <circle cx="390.4" cy="302.5" r="2.1" fill="#9AA1AC" opacity="0.45" />
        <circle cx="188.2" cy="309.3" r="1.4" fill="#22262C" opacity="0.5" />
        <circle cx="182.6" cy="408.8" r="1.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="377.1" cy="383.5" r="2.3" fill="#22262C" opacity="0.5" />
        <circle cx="151.3" cy="133.9" r="2.7" fill="#9AA1AC" opacity="0.45" />
        <circle cx="127.5" cy="270.9" r="2.5" fill="#22262C" opacity="0.5" />
        <circle cx="170.8" cy="246.5" r="1.7" fill="#C9CED6" opacity="0.35" />
        <circle cx="165.2" cy="97.6" r="2.3" fill="#9AA1AC" opacity="0.45" />
        <circle cx="354.6" cy="315" r="2.6" fill="#22262C" opacity="0.5" />
        <circle cx="290.8" cy="75.2" r="2.5" fill="#9AA1AC" opacity="0.45" />
        <circle cx="357.2" cy="434.7" r="1.4" fill="#C9CED6" opacity="0.35" />
        <circle cx="324.3" cy="126.6" r="1.5" fill="#22262C" opacity="0.5" />
        <circle cx="295.2" cy="78.8" r="2.1" fill="#22262C" opacity="0.5" />
        <circle cx="258.7" cy="408.4" r="2.4" fill="#22262C" opacity="0.5" />
        <circle cx="322.5" cy="310.1" r="2.1" fill="#9AA1AC" opacity="0.45" />
        <circle cx="183.3" cy="119.3" r="1.3" fill="#22262C" opacity="0.5" />
        <circle cx="147.7" cy="259.3" r="1.5" fill="#9AA1AC" opacity="0.45" />
        <circle cx="371.6" cy="407.4" r="2.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="343.7" cy="346.5" r="2.6" fill="#9AA1AC" opacity="0.45" />
        <circle cx="254.6" cy="359.4" r="1.3" fill="#C9CED6" opacity="0.35" />
        <circle cx="305.7" cy="328" r="2.1" fill="#C9CED6" opacity="0.35" />
        <circle cx="217.7" cy="162.5" r="2.1" fill="#22262C" opacity="0.5" />
        <circle cx="319.7" cy="187.6" r="1.8" fill="#C9CED6" opacity="0.35" />
        <circle cx="360.8" cy="401.5" r="1.4" fill="#22262C" opacity="0.5" />
        <circle cx="381.4" cy="367.5" r="2.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="146.8" cy="157.6" r="1.7" fill="#C9CED6" opacity="0.35" />
        <circle cx="140.8" cy="381" r="2.1" fill="#22262C" opacity="0.5" />
        <circle cx="231" cy="387.1" r="2.7" fill="#9AA1AC" opacity="0.45" />
        <circle cx="258.9" cy="226.8" r="2.7" fill="#9AA1AC" opacity="0.45" />
        <circle cx="214.9" cy="169.2" r="1.3" fill="#22262C" opacity="0.5" />
        <circle cx="229.8" cy="204.6" r="2.6" fill="#22262C" opacity="0.5" />
        <circle cx="294.5" cy="205.4" r="1.9" fill="#C9CED6" opacity="0.35" />
        <circle cx="265.9" cy="256" r="2.8" fill="#22262C" opacity="0.5" />
        <circle cx="384.2" cy="393.1" r="2.5" fill="#9AA1AC" opacity="0.45" />
        <circle cx="117.2" cy="301.2" r="2.2" fill="#22262C" opacity="0.5" />
        <circle cx="170.1" cy="194.9" r="1.6" fill="#C9CED6" opacity="0.35" />
        <circle cx="300.1" cy="297.4" r="1.4" fill="#9AA1AC" opacity="0.45" />
        <circle cx="178.9" cy="255" r="1.6" fill="#9AA1AC" opacity="0.45" />
        <circle cx="385.1" cy="334.7" r="2.2" fill="#22262C" opacity="0.5" />
        <circle cx="358.6" cy="391.6" r="1.8" fill="#9AA1AC" opacity="0.45" />
        <circle cx="299.1" cy="100.4" r="2.1" fill="#9AA1AC" opacity="0.45" />
        <circle cx="148.2" cy="372.2" r="2.5" fill="#C9CED6" opacity="0.35" />
        <circle cx="230.7" cy="67" r="2.2" fill="#C9CED6" opacity="0.35" />
        <circle cx="287.2" cy="305" r="2.6" fill="#22262C" opacity="0.5" />
        <circle cx="147.5" cy="227.8" r="1.6" fill="#22262C" opacity="0.5" />
        <circle cx="284.6" cy="363.8" r="2.1" fill="#22262C" opacity="0.5" />
        <circle cx="237.7" cy="176.2" r="1.5" fill="#C9CED6" opacity="0.35" />
        <circle cx="267.5" cy="218.1" r="1.9" fill="#22262C" opacity="0.5" />
        <circle cx="153.2" cy="280.5" r="1.7" fill="#22262C" opacity="0.5" />
        <circle cx="279" cy="85.2" r="1.6" fill="#22262C" opacity="0.5" />
        <circle cx="275.4" cy="112.1" r="1.7" fill="#9AA1AC" opacity="0.45" />
        <circle cx="210" cy="320.6" r="1.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="336.1" cy="338.7" r="2.6" fill="#22262C" opacity="0.5" />
        <circle cx="285.6" cy="177.1" r="2.4" fill="#C9CED6" opacity="0.35" />
        <circle cx="140.3" cy="404.2" r="2.7" fill="#22262C" opacity="0.5" />
        <circle cx="306" cy="236.4" r="2.7" fill="#C9CED6" opacity="0.35" />
        <circle cx="360.5" cy="376.1" r="2.1" fill="#9AA1AC" opacity="0.45" />
        <circle cx="194.7" cy="353" r="1.4" fill="#22262C" opacity="0.5" />
        <circle cx="203.6" cy="125.6" r="2.4" fill="#9AA1AC" opacity="0.45" />
        <circle cx="305.8" cy="207" r="2.2" fill="#9AA1AC" opacity="0.45" />
        <circle cx="327" cy="231.5" r="2.6" fill="#9AA1AC" opacity="0.45" />
        <circle cx="215.7" cy="292.5" r="2.6" fill="#C9CED6" opacity="0.35" />
        <circle cx="263.1" cy="388.5" r="1.3" fill="#9AA1AC" opacity="0.45" />
        <circle cx="229.8" cy="101.5" r="1.2" fill="#22262C" opacity="0.5" />
        <circle cx="375.1" cy="177.7" r="2.2" fill="#22262C" opacity="0.5" />
        <circle cx="359.4" cy="416.7" r="1.7" fill="#C9CED6" opacity="0.35" />
        <circle cx="263.1" cy="104.9" r="2.3" fill="#C9CED6" opacity="0.35" />
        <circle cx="183.5" cy="258.1" r="1.2" fill="#22262C" opacity="0.5" />
        <circle cx="317.1" cy="117.4" r="1.8" fill="#C9CED6" opacity="0.35" />
        <circle cx="373.7" cy="252.9" r="2.1" fill="#22262C" opacity="0.5" />
        <path
          d="M132 472C132 472 115.7 417 110 382C104.3 347 98.7 299 98 262C97.3 225 98.7 188.3 106 160C113.3 131.7 124.3 110 142 92C159.7 74 185.3 61 212 52C238.7 43 275.3 36 302 38C328.7 40 354.7 49 372 64C389.3 79 398.7 97 406 128C413.3 159 416.3 207.7 416 250C415.7 292.3 409.3 345 404 382C398.7 419 384 472 384 472C384 472 132 472 132 472Z"
          fill="none"
          stroke="#9AA2AF"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-b-ornament`}>
        <path
          d="M179.1 410.6L177.2 408.7L175.8 406.4L174.2 403L172.2 397.4L168.8 383.7L165.4 364.9L162 341.9L158.9 314.7L156.7 289.5L155.6 268.2L155.2 249L155.5 231.7L156.3 214.6L157.8 199.8L159.8 187.3L162.5 175.2L165.6 165.4L170.1 154.7L174.8 146.3L180.3 138.6L186.8 131.7L194.1 125.5L202.3 120L212.8 114.3L224.1 109.4L237.7 104.8L251.8 101L264.1 98.6L278.2 96.9L290.2 96.6L300.1 97.3L310.8 99.3L319.3 102.3L323.2 104.1L327.9 107L334.1 112.2L337.6 116.3L340.1 119.7L344.9 129L349.2 141.5L352.3 155.3L355.1 173.7L356.9 192.7L358.2 215.8L358.6 239L358.2 264.2L357 287.4L354.7 314.7L350.9 347.8L346.7 376.7L343.1 394.7L341.4 400.8L339.4 405.8L336.7 410L334.8 411.5L332.8 412.4L325.5 414L313.7 414.8L203 414.9L194.1 414.4L187.9 413.7L183.1 412.6L179.5 410.9ZM153.2 443.7L145.9 436.8L142.1 431.7L138.9 426.5L136.4 421.5L133.5 414.2L129.6 400.7L125 377.8L120.4 347.3L116.9 316.9L114.4 286.2L113.4 259.4L113.4 234.6L114.4 211.5L116.4 192.4L119.4 175.1L123.2 159.9L128.5 144.7L134.6 131.9L142.1 119.6L146.4 113.8L151.1 108.2L161.4 98L172.6 89.2L184.5 81.8L198.6 74.6L215.1 68L231.8 62.7L248.8 58.7L266.2 55.9L281.9 54.7L298.1 54.9L312.2 56.7L319.4 58.2L326.5 60.2L333.6 62.7L340.6 65.8L345.2 68.3L351.9 72.5L358.2 77.3L362.1 80.8L365.8 84.7L370.9 90.7L375.4 97L379.2 103.6L382.5 110.2L385.3 116.9L390.2 132.4L394 149.7L397 170.8L399.1 193.6L400.5 224.5L400.5 255.4L399.2 286.2L396.5 318.8L391.8 359.3L386.7 391.9L384.4 402.6L382 411.6L379.5 418.9L376 426.6L371.1 434.3L366.6 439.5L361.5 444L355.9 447.7L350 450.7L341.5 453.6L333.5 455.3L326.2 456.1L315 456.8L300.4 457L212.3 457L193.1 456.5L181.1 455.2L173.2 453.5L164.5 450.4L156 445.8Z"
          fill="#2C3139"
          fillRule="evenodd"
          stroke="#1A1D22"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M171.4 427.2L173.1 413.9L172.6 410.9L171 407.9L168.7 405.8L166.1 404.3L149.1 398.2L145.2 395.9L143.8 394.2L143.7 393.1L144.1 391.9L146.3 388.3L154.7 378.8L158.6 373.3L160 370.3L160.6 366.9L160.3 363.3L158.9 360L156.8 357.3L154.3 355.1L138.1 345.3L135.5 342.9L135.1 341.2L136.4 338.7L137.9 336.8L146.9 328L151.2 322.8L152.9 319.9L153.9 316.6L153.9 313L152.8 309.6L151 306.7L148.7 304.3L143.3 300.2L133.1 293.4L130.4 290.7L129.9 289.5L130.4 288L132.8 285L142.3 276.8L147 272L148.9 269.3L150.2 266.1L150.7 262.6L150 259L148.5 256L146.4 253.3L144.1 251L131.7 241.2L129.1 238.2L128.6 236.8L129.1 235.5L131.6 232.7L146.8 221.4L149 218.9L150.7 216L151.7 212.6L151.6 209L150.5 205.8L148.8 202.9L144.5 197.9L135.8 189.1L133.6 185.7L133.2 184L133.8 182.7L136.6 180.5L141.5 177.9L150.4 174.1L156 171L158.4 168.8L160.3 165.9L161.2 162.5L161.1 159.2L160.3 156L152.2 139.3L151.2 135.2L151.2 134L151.8 132.7L153.8 131.5L158.2 130.7L173.6 131.1L176.7 130.9L179.8 130.2L182.8 128.7L185.3 126.3L186.9 123.3L187.7 120.3L188.7 101.8L189.7 97.5L190.3 96.3L191.4 95.4L193.5 95.3L197.6 96.5L208.8 102.2L214.8 104.6L217.9 105.3L221.4 105.2L224.8 104L227.5 101.9L229.6 99.4L232.5 93.5L237 81.7L239.2 77.7L240.8 76.2L242 76L243.1 76.4L246.8 78.5L256.2 86.7L261.4 90.7L264.3 92.1L267.5 92.9L271.1 92.8L274.4 91.6L277.1 89.6L281.3 84.8L286.8 76.8L290.3 72.6L293.2 70.3L294.6 70L296.3 70.8L299.1 73.7L302.1 78.6L306.4 87.1L309.8 92.1L312.3 94.3L315.5 95.7L318.8 96.1L321.9 95.6L324.9 94.6L335.9 89L341 87.2L344.8 86.9L345.9 87.2L347.2 88.2L348.1 90.9L348 95.7L344.7 110.4L344.3 113.3L344.5 116.5L345.6 119.8L347.8 122.5L350.4 124.3L356.1 126.6L365.2 129.1L370.6 131L373.9 133.1L375 134.5L374.9 136L373.3 139.3L363.4 151.2L359.8 156.6L358.7 159.8L358.5 163.3L359.3 166.8L361.1 169.8L363.4 172.2L368.7 176.1L379.3 182.8L382.4 185.5L383.3 187L383 188.2L381 191.1L367.2 204L365.2 206.6L363.6 209.6L362.9 213.1L363.2 216.7L364.5 219.9L366.5 222.7L371.3 227.2L381.5 234.9L384.6 238L385.4 239.6L385.1 240.7L383.1 243.3L368.4 255L366.2 257.4L364.3 260.2L363.1 263.6L363 267.2L364 270.6L365.6 273.5L370 278.5L381.4 288.8L383.3 291.5L383.4 292.6L382.5 294.2L379.2 297.1L368.5 304.1L363.3 308.3L361.2 311L359.8 314.2L359.2 317.7L359.8 321.2L361.2 324.3L363.1 327.1L376.2 340.7L378.1 343.6L378.3 344.8L377.4 346.2L374.1 348.9L363.2 355.3L357.8 359.3L355.5 361.7L353.7 364.7L352.9 368.2L353.1 371.8L354.3 375L355.9 377.9L368.2 392.3L370 395.5L370.1 396.9L369.1 398.4L367.8 399.5L363.3 401.8L346.6 407.2L344.1 408.7L341.8 411.2L340.6 414.3L340.4 417.1L341.1 424.6L340.9 430L339.5 435L337.3 438.3L336.3 439.1L334.6 439.5L332.1 438.5L328.3 435.5L317.5 423.7L314.9 421.7L311.8 420.3L308.3 419.7L304.7 420.2L301.6 421.6L298.9 423.6L294.3 428.5L286.5 438.4L283.5 441.1L282.1 441.7L280.9 441.4L278.2 439L270.5 429.3L265.9 424.3L263.3 422.2L260.3 420.6L256.8 419.8L253.2 420.1L249.9 421.3L247.1 423.3L242.4 428.1L234.5 438.1L231.4 441L229.9 441.7L228.8 441.4L226.2 439.3L214.2 424.7L211.7 422.5L208.8 420.8L205.4 419.7L201.8 419.8L198.5 420.9L195.7 422.6L193.3 424.7L182.5 435.9L178.9 438.2L176.6 438.5L174.7 437.6L172.7 434.7L171.5 429.9ZM160.9 427.1L161.2 423.4L162.6 414.2L162.9 414.5L159.8 413.2L147.8 409.1L141.4 406L138.5 404L136 401.5L134.1 398.4L133.2 394.8L133.3 391.2L134.4 387.8L138 381.9L148.3 370L150 367L150.1 366L149.2 364.6L145.8 362L134.7 355.6L129.2 351.5L127 349L125.3 345.9L124.5 342.3L124.9 338.7L126.1 335.5L127.9 332.6L132.4 327.4L141.2 318.7L143.3 315.7L143.5 314.5L142.8 313.2L139.8 310.6L129.2 303.5L123.9 299.2L121.7 296.6L120.1 293.4L119.4 289.9L119.8 286.3L121.1 283L123 280.2L127.8 275.3L137.3 267L139.8 264.1L140.2 262.9L139.7 261.7L137.1 258.8L127.1 251.1L122.1 246.4L120.1 243.6L118.6 240.4L118.1 236.8L118.6 233.2L120.1 230L122.2 227.3L127.3 222.7L137.7 215.3L140.6 212.5L141.3 211.3L141 210.2L138.9 207.3L130 198.3L125.6 192.9L123.9 189.8L122.9 186.4L122.7 182.8L123.7 179.2L125.6 176.1L128.1 173.7L134 169.9L146 164.6L149.7 162.5L150.8 161.5L150.4 159.4L149.6 157.5L143.7 146.2L141.2 139.4L140.7 135.9L140.8 132.3L141.9 128.7L144.1 125.5L147 123.2L150.2 121.6L153.8 120.7L161 120.1L173.5 120.6L176.8 120.1L177.6 116.4L177.9 103.9L178.9 96.8L180 93.4L181.8 90.2L184.3 87.5L187.5 85.6L191.1 84.8L194.7 84.9L198.2 85.6L204.8 88.2L215.8 93.9L219.5 94.8L220.8 93.5L221.8 91.9L226.1 80.5L229 74.2L230.9 71.3L233.3 68.7L236.3 66.7L239.8 65.6L243.5 65.7L246.9 66.6L250 68.1L252.9 70L265.1 80.5L266.8 81.7L268.9 82.5L270.1 81.7L272.9 78.5L280.5 67.8L285.5 62.8L288.6 60.9L292.1 59.7L295.8 59.6L299.4 60.5L302.6 62.3L305.2 64.7L309.5 70.5L315.6 82L318.2 85.6L320.8 84.9L331.6 79.4L335.1 78.1L338.6 77L342.3 76.4L346.2 76.5L349.8 77.4L353.1 79.4L355.8 82.2L357.6 85.7L358.4 89.3L358.7 93.1L357.9 100.5L355 112.3L354.8 114.7L359.1 116.5L371.7 120.1L378.1 123.2L381 125.3L383.4 128L385 131.3L385.6 135L385.1 138.7L383.9 141.9L380.1 147.9L370.2 159.6L369.3 161.1L369 162.7L370.5 164.5L372.1 165.8L382.7 172.4L388.3 176.5L390.6 179L392.5 181.9L393.6 185.3L393.7 189L392.7 192.4L391 195.4L386.5 200.5L375.2 210.8L373.4 213.8L373.7 214.8L375.9 217.3L385.7 224.8L390.9 229.2L393.1 231.8L394.8 234.8L395.8 238.3L395.7 241.9L394.6 245.3L392.8 248.2L387.9 253L375.7 262.5L373.5 265.5L373.6 266.5L375.5 269.1L387 279.5L391.5 284.6L393.1 287.7L393.9 291.1L393.7 294.8L392.5 298.1L390.5 301L388.1 303.4L385.5 305.5L372.5 314.2L370.1 316.6L369.7 317.6L370.3 319.2L373 322.6L382.1 331.6L386.4 336.9L387.9 340L388.7 343.4L388.5 347L387.3 350.4L385.2 353.2L382.8 355.5L377.2 359.4L366.5 365.7L363.9 368.1L363.4 369.1L363.8 370.6L366.1 374L374.7 383.5L378.6 389.2L380 392.4L380.6 396L380.2 399.6L378.8 403L376.5 405.8L373.8 408.1L370.7 409.9L364.1 412.7L350.5 417L350.9 416.3L351.6 427.7L351.3 431.6L350.4 435.5L349 439.4L347.1 442.8L344.6 445.8L341.5 448.2L337.7 449.6L333.8 449.9L330 449.1L326.7 447.5L323.7 445.4L318.5 440.4L312.3 433.3L309.3 430.7L308.1 430.2L307 430.6L304.2 433.1L294.2 445.5L289.2 449.9L286.1 451.5L282.6 452.2L279 451.9L275.8 450.5L273 448.6L268.3 443.7L260.5 433.7L257.5 430.9L256 430.3L254.9 430.6L252.2 432.9L242.3 445.1L237.4 449.7L234.4 451.3L230.9 452.2L227.3 452L224 450.8L221.2 448.9L218.7 446.6L208.5 434L205.4 430.9L203.9 430.1L203 430.4L200.4 432.4L191.8 441.5L186.1 446.2L182.7 447.9L179 448.9L175.1 448.9L171.2 447.8L167.8 445.5L165.1 442.5L163.1 438.9L161.8 435.1L161.1 431.1Z"
          fill={`url(#${p}-pierre-b-ochre)`}
          fillRule="evenodd"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
        />
        <path
          d="M164.8 422.1L159.6 422.8L157.2 422.6L154 421.4L153.1 420.6L152.4 418.8L152.9 415.5L153.8 413.4L162.4 400.5L163.9 397.7L165 394.6L165.4 391.2L164.7 387.7L163.1 384.7L160.8 382.2L158.2 380.2L141.8 371.1L139.3 368.8L138.8 367.8L139.2 366.1L141.6 362.6L150.4 353.5L154.5 348.2L156 345.2L156.9 341.8L156.7 338.2L155.5 334.9L153.5 332.1L151.1 329.8L148.5 327.7L135.2 319.4L132.6 316.8L132.1 315.7L132.5 314.2L135 311L144.2 302.4L148.7 297.4L150.4 294.6L151.6 291.3L151.8 287.7L151 284.3L149.3 281.3L147.1 278.8L141.9 274.5L131.8 267.3L130.2 265.7L128.8 263.6L129.2 261.8L131.7 258.9L141.4 251.1L146.3 246.6L148.4 244L149.9 240.9L150.6 237.4L150.2 233.9L148.8 230.7L146.9 228L142.2 223.3L132.8 215.1L130.3 211.9L129.8 210.4L130.4 209.1L133 206.6L148.8 196.5L151.2 194.4L153.3 191.8L154.7 188.5L155 185L154.3 181.7L153 178.7L151.2 176L141.8 163.5L140 159.8L139.9 157.9L140.7 156.7L141.8 155.8L146 154L161.2 150.5L164.2 149.5L167 147.9L169.5 145.6L171.2 142.6L171.9 139.3L171.3 133.1L168 118.2L168.1 113.9L168.8 111.9L170.1 111.1L171.5 110.9L175.8 111.2L190.8 115.4L193.9 116L197.1 116.1L200.4 115.4L203.5 113.6L205.8 111.1L207.4 108.3L209.3 102.2L212.1 89.9L213.9 85.8L214.7 84.7L215.8 84L217.7 84.2L221.6 85.9L232 93L237.6 96.3L240.7 97.4L244.2 97.7L247.6 97L250.7 95.4L253.1 93.1L256.7 87.7L262.6 76.3L265.3 72.6L267.1 71.2L268.3 71.2L269.4 71.6L272.7 74.1L285.1 88.1L287.6 90L290.6 91.4L294.1 92L297.5 91.4L300.4 90L305.4 86.1L314.6 77.7L318.5 75.2L321.1 74.5L322.4 75L323.3 75.8L325.2 79.3L326.6 84.7L328 93.9L329.3 99.6L330.7 102.4L333.1 105L336.1 106.5L339 107.1L342 107.2L354.2 106.3L359.7 106.6L363.3 107.7L364.8 109L365.2 110.8L364.3 114.4L361.8 119.4L356.8 127.5L354.1 133.2L353.4 136.5L353.7 140L355 143.2L357.1 145.8L359.6 147.9L376.3 156.8L379.4 159.3L380.1 160.2L380.3 161.2L379.4 163.4L378.2 165.1L367.2 176.1L363.2 181.4L361.8 184.5L361.3 188L361.9 191.5L363.4 194.7L365.5 197.3L370.5 201.6L381 208.8L384 211.8L384.8 213.3L384.6 214.5L382.5 217.2L370.7 227.2L366.1 232L364.5 235L363.5 238.3L363.6 241.9L364.7 245.3L366.5 248.1L368.7 250.6L381.1 261L384.1 264.2L384.9 265.9L384.7 267L382.6 269.5L370.2 278.4L365.2 282.8L363.2 285.6L361.9 288.8L361.5 292.4L362.3 295.9L363.8 298.9L365.7 301.6L379.2 314.8L381 317.6L381.2 318.7L380.2 320.3L377 323L366.1 329.7L360.8 333.9L358.7 336.4L357 339.5L356.4 343.1L356.8 346.6L358 349.8L359.8 352.6L361.9 355.2L372.7 366.5L374.5 369.6L374.7 370.8L373.9 372.2L370.6 374.7L359.6 380.7L354.1 384.2L351.6 386.5L349.7 389.2L348.5 392.5L348.5 396.1L349.3 399.3L352.3 404.8L357.7 412.6L360.2 417.4L360.9 421.1L360.3 423.2L358.2 424.8L356.5 425.3L351.9 425.2L346.8 423.6L337 418.5L334 417.8L330.7 417.9L327.6 419.2L325.1 421L321.3 425.8L316 433.8L312.6 438.4L311 440L308.8 441.6L307 441.3L304.2 438.9L296.4 429.1L291.9 424.1L289.2 422.1L286.1 420.5L282.6 419.8L279 420.1L275.8 421.5L273 423.4L268.3 428.3L260.5 438.3L257.5 441.1L256 441.7L254.9 441.4L252.2 439.1L242.3 426.9L240 424.5L237.4 422.3L234.4 420.7L230.9 419.8L227.3 420L224 421.2L221.2 423.1L216.4 427.9L208.5 437.9L205.4 440.9L203.7 441.6L202.5 441.3L199.9 439.1L196.6 434.8L188.4 421.9L186.4 419.7L183.8 417.9L180.5 417L177.4 417.2L174.8 418.1L167.4 421.2ZM167.5 432.3L163.6 433L159.5 433.3L155.4 432.9L151.5 431.9L147.9 430L144.9 427.1L142.8 423.6L141.9 419.7L142 415.9L142.9 412.2L146.2 405.5L153.4 395.1L154.4 393.3L154.9 391.3L152.3 388.9L138.7 381.6L133.1 377.6L130.8 375.1L129.1 372L128.3 368.4L128.6 364.8L129.8 361.6L131.5 358.6L135.8 353.4L144.3 344.4L146.2 341.4L146.4 340.3L145.6 339L142.4 336.3L128.8 327.6L126.2 325.4L124 322.8L122.3 319.7L121.6 316.2L122 312.6L123.2 309.3L125 306.5L127.2 303.9L138.8 292.9L141 289.9L141.4 288.7L140.8 287.5L137.9 284.7L127.6 277.3L122.5 272.8L120.4 270.1L118.8 267L118.2 263.4L118.7 259.8L120.1 256.6L122 253.8L127 249L136.9 241.2L139.5 238.3L140.1 237L139.7 235.9L137.3 233L127.7 224.8L123 219.8L121.1 216.9L119.8 213.6L119.3 210L120 206.4L121.7 203.3L123.9 200.6L129.3 196.3L142.3 188.3L144.5 186L143.7 183.7L142.6 181.9L134.8 171.9L131.1 165.9L129.9 162.6L129.3 159L129.7 155.4L131.1 151.9L133.5 149L136.3 146.9L139.5 145.3L146.3 143L158.3 140.4L161.3 139.1L161 135.2L158.1 122.8L157.4 115.5L157.7 112L158.8 108.5L160.7 105.2L163.6 102.7L166.9 101.1L170.5 100.4L174.1 100.4L181.2 101.6L193.2 105.2L195.1 105.5L196.9 105.5L198.5 102.2L202.1 86.8L204.9 80.3L207.1 77.5L209.9 75.2L213.3 73.8L216.9 73.5L220.4 74L223.7 75.2L229.8 78.7L240 85.7L243.8 87.2L245.2 86.2L246.3 84.7L251.8 74L255.5 68L257.7 65.3L260.3 63L263.6 61.3L267.2 60.6L270.8 61L274.2 62.3L277.2 64.2L282.3 69L290.5 78.7L292.1 80.2L294 81.5L296.6 80L305.3 71.7L311.1 67.3L314.3 65.6L317.8 64.4L321.5 64.1L325.2 64.8L328.6 66.5L331.3 69.1L333.4 72.2L334.9 75.5L336.1 79.1L338.8 94.5L339.5 96.6L341.9 96.7L353.9 95.8L361.3 96.3L364.9 97.1L368.4 98.5L371.5 100.7L373.9 103.7L375.3 107.2L375.7 111L375.2 114.7L372.6 121.5L365.9 132.8L364.1 136.4L363.9 137.6L365.7 139.3L367.6 140.5L378.9 146.2L384.8 150L387.3 152.3L389.3 155.2L390.6 158.6L390.8 162.3L389.9 165.7L388.4 168.8L386.4 171.6L373.4 185.1L371.9 187.5L371.9 188.3L373.1 190.1L374.6 191.5L384.8 198.6L390.1 202.9L392.4 205.4L394.2 208.4L395.2 211.8L395.2 215.5L394.1 218.9L392.4 221.8L387.7 226.8L375.9 236.7L374.7 238.1L373.9 240L374.9 241.7L376.2 243.2L388.2 253.2L390.6 255.6L392.8 258.3L394.4 261.3L395.4 264.7L395.2 268.4L394 271.8L392.1 274.6L387.2 279.3L374.5 288.4L372.3 290.8L372 291.7L372.7 293.4L373.8 294.9L384.9 305.6L389.2 310.8L390.8 313.9L391.6 317.3L391.4 321L390.2 324.3L388.2 327.1L385.8 329.5L380.2 333.5L369.8 340L368.2 341.3L366.9 343L367.4 344.9L369.8 348.3L381 360.1L382.9 362.9L384.4 366L385.2 369.4L385 373.1L383.7 376.4L381.6 379.2L379.1 381.6L376.4 383.5L362.4 391.3L360.6 392.5L358.9 394.4L359.9 397.1L368.5 410.3L370 413.8L371.1 417.6L371.4 421.5L370.7 425.5L368.9 429.2L366.1 432.2L362.5 434.4L358.4 435.6L354.2 436L350.1 435.6L346.2 434.6L342.6 433.2L332.8 428.2L329.9 431.7L322.7 442.5L318.1 447.8L315.4 449.9L312.3 451.5L308.7 452.2L305.1 451.8L301.8 450.4L299 448.4L294.3 443.5L286.5 433.6L283.5 430.9L281.7 430.3L279.7 431.5L278.2 433L270.5 442.7L265.9 447.7L263.3 449.8L260.3 451.4L256.8 452.2L253.2 451.9L249.9 450.7L247.1 448.7L242.4 443.9L234.5 433.9L231.4 431L229.5 430.3L227.7 431.3L226.2 432.7L216.3 444.9L213.9 447.4L211.3 449.5L208.2 451.2L204.7 452.1L201 451.9L197.7 450.6L194.8 448.7L192.2 446.3L187.9 440.7L181.3 430L179.2 427.4L179.6 427.5L171 431.1Z"
          fill={`url(#${p}-pierre-b-ochre)`}
          fillRule="evenodd"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
        />
        <clipPath id={`${p}-pierre-b-x0-0`}>
          <path d="M184.8 415.7L180.7 414.6L176.9 414.9L173.9 415.8L166.6 419L161.9 420.2L157.7 420.2L156.2 419.9L154.8 418.8L140.6 424.5L143 428.6L146.5 431.9L150.6 434.1L155 435.3L159.5 435.7L163.9 435.4L168.1 434.6L171.9 433.4L180.1 429.9L178.2 429.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-0)`}>
          <path
            d="M176.6 438.5L174.7 437.6L173.7 436.5L172 432.5L171.4 427.2L173.1 413.9L172.6 410.9L171 407.9L168.7 405.8M175.1 448.9L171.2 447.8L167.8 445.5L165.1 442.5L163.1 438.9L161.8 435.1L161.1 431.1L160.9 427.1L161.2 423.4L162.6 414.2L162.9 414.5L162.7 414.4"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M176.6 438.5L174.7 437.6L173.7 436.5L172 432.5L171.4 427.2L173.1 413.9L172.6 410.9L171 407.9L168.7 405.8L162.7 414.4L162.9 414.5L162.6 414.2L161.2 423.4L160.9 427.1L161.1 431.1L161.8 435.1L163.1 438.9L165.1 442.5L167.8 445.5L171.2 447.8L175.1 448.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M176.6 438.5L174.7 437.6L173.7 436.5L172 432.5L171.4 427.2L173.1 413.9L172.6 410.9L171 407.9L168.7 405.8M175.1 448.9L171.2 447.8L167.8 445.5L165.1 442.5L163.1 438.9L161.8 435.1L161.1 431.1L160.9 427.1L161.2 423.4L162.6 414.2L162.9 414.5L162.7 414.4"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-1`}>
          <path d="M174.9 410.2L172.9 406.4L170 403.8L167.1 402.2L164.2 401L150.1 396L148.1 395L146 393.3L146 393.5L130.8 395.1L131.9 399.4L134.2 403L137 405.8L140.2 408.1L147 411.3L161.3 416.4L160.4 414.9Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-1)`}>
          <path
            d="M154 421.4L153.1 420.6L152.4 418.8L152.9 415.5L155.2 411L162.4 400.5L163.9 397.7L165 394.6L165.4 391.2L164.7 387.7L163.1 384.7M147.9 430L144.9 427.1L142.8 423.6L141.9 419.7L142 415.9L142.9 412.2L144.4 408.7L146.2 405.5L153.4 395.1L154.8 392.1L154.6 390.9"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M154 421.4L153.1 420.6L152.4 418.8L152.9 415.5L155.2 411L160.6 403.2L163.9 397.7L165 394.6L165.4 391.2L164.7 387.7L163.1 384.7L154.6 390.9L154.8 392.1L153.4 395.1L146.2 405.5L144.4 408.7L142.9 412.2L142 415.9L141.9 419.7L142.8 423.6L144.9 427.1L147.9 430Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M154 421.4L153.1 420.6L152.4 418.8L152.9 415.5L155.2 411L162.4 400.5L163.9 397.7L165 394.6L165.4 391.2L164.7 387.7L163.1 384.7M147.9 430L144.9 427.1L142.8 423.6L141.9 419.7L142 415.9L142.9 412.2L144.4 408.7L146.2 405.5L153.4 395.1L154.8 392.1L154.6 390.9"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-2`}>
          <path d="M167.8 391.1L167 386.9L165 383.3L162.4 380.4L156.6 376.4L145.2 370.4L141.1 367.3L141.2 367.6L125.9 368.6L126.8 372.9L128.9 376.5L131.5 379.4L134.4 381.7L140.6 385.3L149 389.7L152.7 392.3L152.5 391.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-2)`}>
          <path
            d="M144.2 394.9L143.8 394.2L143.7 393.1L144.9 390.3L148.1 386.1L156.8 376.1L158.6 373.3L160 370.3L160.6 366.9L160.3 363.3L158.9 360M136 401.5L134.1 398.4L133.2 394.8L133.3 391.2L134.4 387.8L138 381.9L148.3 370L150 367L149.9 365.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M144.2 394.9L143.8 394.2L143.7 393.1L144.9 390.3L148.1 386.1L156.8 376.1L158.6 373.3L160 370.3L160.6 366.9L160.3 363.3L158.9 360L149.9 365.5L150 367L148.3 370L138 381.9L134.4 387.8L133.3 391.2L133.2 394.8L134.1 398.4L136 401.5Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M144.2 394.9L143.8 394.2L143.7 393.1L144.9 390.3L148.1 386.1L156.8 376.1L158.6 373.3L160 370.3L160.6 366.9L160.3 363.3L158.9 360M136 401.5L134.1 398.4L133.2 394.8L133.3 391.2L134.4 387.8L138 381.9L148.3 370L150 367L149.9 365.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-3`}>
          <path d="M163 367L162.6 362.7L160.9 358.8L158.5 355.7L152.8 351.2L141.6 344.7L137.4 341.3L137.4 341.6L122.2 342.4L123.1 346.7L125 350.4L127.6 353.3L130.4 355.6L144.5 364.1L147.8 366.7L147.7 366.2Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-3)`}>
          <path
            d="M139.3 368.8L138.8 367.2L140.2 364.5L152.6 350.9L154.5 348.2L156 345.2L156.9 341.8L156.7 338.2L155.5 334.9M130.8 375.1L129.1 372L128.3 368.4L128.6 364.8L129.8 361.6L133.6 355.9L144.3 344.4L146.2 341.4L146.3 339.9"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M139.3 368.8L138.8 367.2L140.2 364.5L152.6 350.9L154.5 348.2L156 345.2L156.9 341.8L156.7 338.2L155.5 334.9L146.3 339.9L146.2 341.4L144.3 344.4L133.6 355.9L129.8 361.6L128.6 364.8L128.3 368.4L129.1 372L130.8 375.1Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M139.3 368.8L138.8 367.2L140.2 364.5L152.6 350.9L154.5 348.2L156 345.2L156.9 341.8L156.7 338.2L155.5 334.9M130.8 375.1L129.1 372L128.3 368.4L128.6 364.8L129.8 361.6L133.6 355.9L144.3 344.4L146.2 341.4L146.3 339.9"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-4`}>
          <path d="M159.3 342.1L159.1 337.7L157.6 333.7L155.3 330.5L152.7 327.9L149.8 325.8L138.7 318.9L136.7 317.5L134.4 315.3L134.5 315.5L119.2 316.3L120.1 320.6L122 324.2L124.5 327.1L127.3 329.5L141.1 338.3L144.1 341L144.1 340.4Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-4)`}>
          <path
            d="M135.5 342.9L135.1 341.2L136.4 338.7L139.9 334.8L149.2 325.5L151.2 322.8L152.9 319.9L153.9 316.6L153.9 313L152.8 309.6M127 349L125.3 345.9L124.5 342.3L124.9 338.7L126.1 335.5L130 329.9L141.2 318.7L143.3 315.7L143.4 314.1"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M135.5 342.9L135.1 341.2L136.4 338.7L139.9 334.8L149.2 325.5L151.2 322.8L152.9 319.9L153.9 316.6L153.9 313L152.8 309.6L143.4 314.1L143.3 315.7L141.2 318.7L130 329.9L126.1 335.5L124.9 338.7L124.5 342.3L125.3 345.9L127 349Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M135.5 342.9L135.1 341.2L136.4 338.7L139.9 334.8L149.2 325.5L151.2 322.8L152.9 319.9L153.9 316.6L153.9 313L152.8 309.6M127 349L125.3 345.9L124.5 342.3L124.9 338.7L126.1 335.5L130 329.9L141.2 318.7L143.3 315.7L143.4 314.1"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-5`}>
          <path d="M156.3 316.9L156.3 312.6L155 308.5L152.9 305.2L150.3 302.5L147.5 300.2L136.6 293L133.2 290.2L132.3 289.1L132.3 289.4L117 290L117.9 294.2L119.7 297.9L122.2 300.9L124.9 303.3L138.4 312.5L141.2 315.1L141.1 314.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-5)`}>
          <path
            d="M132.6 316.8L132.1 315.1L133.5 312.7L136.9 309L146.5 300L148.7 297.4L150.4 294.6L151.6 291.3L151.8 287.7L151 284.3M124 322.8L122.3 319.7L121.6 316.2L122 312.6L123.2 309.3L125 306.5L127.2 303.9L138.8 292.9L141 289.9L141.3 288.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M132.6 316.8L132.1 315.1L133.5 312.7L136.9 309L146.5 300L148.7 297.4L150.4 294.6L151.6 291.3L151.8 287.7L151 284.3L141.3 288.3L141 289.9L138.8 292.9L127.2 303.9L125 306.5L123.2 309.3L122 312.6L121.6 316.2L122.3 319.7L124 322.8Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M132.6 316.8L132.1 315.1L133.5 312.7L136.9 309L146.5 300L148.7 297.4L150.4 294.6L151.6 291.3L151.8 287.7L151 284.3M124 322.8L122.3 319.7L121.6 316.2L122 312.6L123.2 309.3L125 306.5L127.2 303.9L138.8 292.9L141 289.9L141.3 288.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-6`}>
          <path d="M154 291.8L154.2 287.5L153.2 283.4L151.2 279.9L148.8 277.1L146.1 274.7L135.4 267.1L132 264.1L131.1 262.9L131.1 263.1L115.8 263.5L116.6 267.7L118.3 271.4L120.7 274.5L123.4 277L136.4 286.6L139.1 289.2L139 288.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-6)`}>
          <path
            d="M130.4 290.7L130 289L131.3 286.7L134.8 283.1L144.7 274.5L147 272L148.9 269.3L150.2 266.1L150.7 262.6L150 259M121.7 296.6L120.1 293.4L119.4 289.9L119.8 286.3L121.1 283L123 280.2L125.3 277.6L135.3 268.9L138.8 265.4L140.1 263.3L140.1 262.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M130.4 290.7L130 289L131.3 286.7L134.8 283.1L144.7 274.5L147 272L148.9 269.3L150.2 266.1L150.7 262.6L150 259L140.1 262.5L140.1 263.3L138.8 265.4L135.3 268.9L125.3 277.6L123 280.2L121.1 283L119.8 286.3L119.4 289.9L120.1 293.4L121.7 296.6Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M130.4 290.7L130 289L131.3 286.7L134.8 283.1L144.7 274.5L147 272L148.9 269.3L150.2 266.1L150.7 262.6L150 259M121.7 296.6L120.1 293.4L119.4 289.9L119.8 286.3L121.1 283L123 280.2L125.3 277.6L135.3 268.9L138.8 265.4L140.1 263.3L140.1 262.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-7`}>
          <path d="M152.6 266.8L153.1 262.5L152.3 258.3L150.5 254.7L148.2 251.7L145.7 249.2L135.3 241.1L131.9 238L131 236.6L115.7 236.8L116.3 241.1L118 244.8L120.3 247.9L122.8 250.6L135.5 260.6L137.8 263.3L137.8 262.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-7)`}>
          <path
            d="M129.2 264.5L128.8 262.7L130.1 260.5L133.7 257.1L143.9 248.9L148.4 244L149.9 240.9L150.6 237.4L150.2 233.9M120.4 270.1L118.8 267L118.2 263.4L118.7 259.8L120.1 256.6L122 253.8L124.4 251.3L138.5 239.6L140 237.4L140 236.7"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M129.2 264.5L128.8 262.7L130.1 260.5L133.7 257.1L141.4 251.1L146.3 246.6L148.4 244L149.9 240.9L150.6 237.4L150.2 233.9L140 236.7L140 237.4L138.5 239.6L124.4 251.3L122 253.8L120.1 256.6L118.7 259.8L118.2 263.4L118.8 267L120.4 270.1Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M129.2 264.5L128.8 262.7L130.1 260.5L133.7 257.1L143.9 248.9L148.4 244L149.9 240.9L150.6 237.4L150.2 233.9M120.4 270.1L118.8 267L118.2 263.4L118.7 259.8L120.1 256.6L122 253.8L124.4 251.3L138.5 239.6L140 237.4L140 236.7"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-8`}>
          <path d="M152.2 241.7L153 237.5L152.5 233.3L150.9 229.5L148.8 226.5L146.4 223.8L134.5 213.4L132.2 210.4L116.9 209.9L117.4 214.2L119 218L121.1 221.2L123.5 224L135.6 234.7L137.7 237.3L137.7 236.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-8)`}>
          <path
            d="M129.1 238.2L128.7 236.4L130 234.3L131.6 232.7L144.3 223.5L149 218.9L150.7 216L151.7 212.6L151.6 209M120.1 243.6L118.6 240.4L118.1 236.8L118.6 233.2L120.1 230L122.2 227.3L124.6 224.9L139.5 213.8L140.6 212.5L141.3 211"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M129.1 238.2L128.7 236.4L130 234.3L133.7 231.1L141.6 225.5L146.8 221.4L149 218.9L150.7 216L151.7 212.6L151.6 209L141.3 211L140.6 212.5L139.5 213.8L124.6 224.9L122.2 227.3L120.1 230L118.6 233.2L118.1 236.8L118.6 240.4L120.1 243.6Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M129.1 238.2L128.7 236.4L130 234.3L131.6 232.7L144.3 223.5L149 218.9L150.7 216L151.7 212.6L151.6 209M120.1 243.6L118.6 240.4L118.1 236.8L118.6 233.2L120.1 230L122.2 227.3L124.6 224.9L139.5 213.8L140.6 212.5L141.3 211"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-9`}>
          <path d="M152.9 217L154.1 212.9L154 208.6L152.7 204.8L150.8 201.6L148.6 198.8L139.4 189.5L136.4 185.9L135.6 184.2L120.4 182.5L120.5 186.9L121.7 190.8L123.6 194.2L125.8 197.2L137.1 208.8L138.9 211.4L139 210.7Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-9)`}>
          <path
            d="M130.3 211.9L129.9 211L129.9 209.9L131.4 208L133 206.6L146.1 198.4L151.2 194.4L153.3 191.8L154.7 188.5L155 185M121.1 216.9L119.8 213.6L119.3 210L120 206.4L121.7 203.3L123.9 200.6L126.5 198.3L132.2 194.5L140.4 189.6L143.7 187.1L144.5 185.7"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M130.3 211.9L129.9 211L129.9 209.9L131.4 208L135.1 205L148.8 196.5L151.2 194.4L153.3 191.8L154.7 188.5L155 185L144.5 185.7L143.7 187.1L140.4 189.6L132.2 194.5L126.5 198.3L123.9 200.6L121.7 203.3L120 206.4L119.3 210L119.8 213.6L121.1 216.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M130.3 211.9L129.9 211L129.9 209.9L131.4 208L133 206.6L146.1 198.4L151.2 194.4L153.3 191.8L154.7 188.5L155 185M121.1 216.9L119.8 213.6L119.3 210L120 206.4L121.7 203.3L123.9 200.6L126.5 198.3L132.2 194.5L140.4 189.6L143.7 187.1L144.5 185.7"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-10`}>
          <path d="M155.4 193L157 189.1L157.4 184.8L156.6 180.9L155.1 177.6L153.2 174.6L143.8 162.2L142.2 158.5L127.3 154.8L126.9 159.1L127.6 163.2L129 166.9L130.8 170.3L140.6 183.3L142.1 185.9L142.3 185.1Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-10)`}>
          <path
            d="M133.6 185.7L133.2 184.6L133.3 183.5L134.9 181.7L136.6 180.5L141.5 177.9L150.4 174.1L156 171L158.4 168.8L160.3 165.9L161.2 162.5M123.9 189.8L122.9 186.4L122.7 182.8L123.7 179.2L125.6 176.1L128.1 173.7L130.9 171.6L137.2 168.3L148.2 163.5L149.7 162.5L150.8 161.4"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M133.6 185.7L133.2 184.6L133.3 183.5L134.9 181.7L136.6 180.5L141.5 177.9L153.3 172.7L156 171L158.4 168.8L160.3 165.9L161.2 162.5L150.8 161.4L149.7 162.5L148.2 163.5L137.2 168.3L130.9 171.6L128.1 173.7L125.6 176.1L123.7 179.2L122.7 182.8L122.9 186.4L123.9 189.8Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M133.6 185.7L133.2 184.6L133.3 183.5L134.9 181.7L136.6 180.5L141.5 177.9L150.4 174.1L156 171L158.4 168.8L160.3 165.9L161.2 162.5M123.9 189.8L122.9 186.4L122.7 182.8L123.7 179.2L125.6 176.1L128.1 173.7L130.9 171.6L137.2 168.3L148.2 163.5L149.7 162.5L150.8 161.4"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-11`}>
          <path d="M160.2 170.4L162.5 166.9L163.6 162.8L163.5 158.8L162.6 155.2L161.3 152.1L154.4 138.5L153.8 136.5L153.6 134.2L139.8 127.6L138.5 131.9L138.3 136.1L138.9 140L140.1 143.8L143.1 150.5L147.4 158.5L148.4 161.1L148.7 160.3Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-11)`}>
          <path
            d="M140 159.8L139.8 158.6L140.1 157.4L141.8 155.8L143.7 154.9L148.8 153.2L161.2 150.5L164.2 149.5L167 147.9L169.5 145.6L171.2 142.6M129.9 162.6L129.3 159L129.7 155.4L131.1 151.9L133.5 149L136.3 146.9L139.5 145.3L142.8 144L158.3 140.4L161.3 139"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M140 159.8L139.8 158.6L140.1 157.4L141.8 155.8L143.7 154.9L148.8 153.2L161.2 150.5L164.2 149.5L167 147.9L169.5 145.6L171.2 142.6L161.3 139L158.3 140.4L146.3 143L139.5 145.3L136.3 146.9L133.5 149L131.1 151.9L129.7 155.4L129.3 159L129.9 162.6Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M140 159.8L139.8 158.6L140.1 157.4L141.8 155.8L143.7 154.9L148.8 153.2L161.2 150.5L164.2 149.5L167 147.9L169.5 145.6L171.2 142.6M129.9 162.6L129.3 159L129.7 155.4L131.1 151.9L133.5 149L136.3 146.9L139.5 145.3L142.8 144L158.3 140.4L161.3 139"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-12`}>
          <path d="M168.4 149.9L171.4 147.1L173.4 143.5L174.3 139.5L174.2 135.9L173.7 132.7L170.4 117.9L170.3 115.8L170.7 113.4L158.9 103.7L156.6 107.5L155.4 111.5L155 115.5L155.2 119.4L159 138.3L159.6 137.3Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-12)`}>
          <path
            d="M151.2 135.2L151.2 134L151.8 132.7L153.8 131.5L155.7 131L161.1 130.6L173.6 131.1L176.7 130.9L179.8 130.2L182.8 128.7L185.3 126.3M140.7 135.9L140.8 132.3L141.9 128.7L144.1 125.5L147 123.2L150.2 121.6L153.8 120.7L157.4 120.2L173.5 120.6L176.9 120.1"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M151.2 135.2L151.2 134L151.8 132.7L153.8 131.5L155.7 131L161.1 130.6L173.6 131.1L176.7 130.9L179.8 130.2L182.8 128.7L185.3 126.3L176.9 120.1L173.5 120.6L157.4 120.2L153.8 120.7L150.2 121.6L147 123.2L144.1 125.5L141.9 128.7L140.8 132.3L140.7 135.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M151.2 135.2L151.2 134L151.8 132.7L153.8 131.5L155.7 131L161.1 130.6L173.6 131.1L176.7 130.9L179.8 130.2L182.8 128.7L185.3 126.3M140.7 135.9L140.8 132.3L141.9 128.7L144.1 125.5L147 123.2L150.2 121.6L153.8 120.7L157.4 120.2L173.5 120.6L176.9 120.1"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-13`}>
          <path d="M180.6 132.5L184.2 130.7L187.3 127.8L189.2 124.2L190.1 120.7L190.5 117.4L191 102.1L191.4 99.9L192.4 97.6L182.8 85.6L179.8 88.8L177.8 92.5L176.6 96.2L175.9 99.9L174.9 118.8L175.7 118Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-13)`}>
          <path
            d="M168.1 113.9L168.4 112.6L169.3 111.5L171.5 110.9L173.4 110.9L178.6 111.8L190.8 115.4L193.9 116L197.1 116.1L200.4 115.4L203.5 113.6M157.7 112L158.8 108.5L160.7 105.2L163.6 102.7L166.9 101.1L170.5 100.4L174.1 100.4L177.7 100.9L193.2 105.2L195.1 105.5L196.9 105.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M168.1 113.9L168.4 112.6L169.3 111.5L171.5 110.9L173.4 110.9L178.6 111.8L190.8 115.4L193.9 116L197.1 116.1L200.4 115.4L203.5 113.6L196.9 105.5L195.1 105.5L193.2 105.2L177.7 100.9L174.1 100.4L170.5 100.4L166.9 101.1L163.6 102.7L160.7 105.2L158.8 108.5L157.7 112Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M168.1 113.9L168.4 112.6L169.3 111.5L171.5 110.9L173.4 110.9L178.6 111.8L190.8 115.4L193.9 116L197.1 116.1L200.4 115.4L203.5 113.6M157.7 112L158.8 108.5L160.7 105.2L163.6 102.7L166.9 101.1L170.5 100.4L174.1 100.4L177.7 100.9L193.2 105.2L195.1 105.5L196.9 105.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-14`}>
          <path d="M201.3 117.6L205 115.5L207.8 112.5L209.6 109.3L211.6 102.7L214.4 90.7L215.2 88.5L216.5 86.3L216.3 86.3L212.7 71.5L208.6 73.2L205.3 75.9L202.9 79.1L201.1 82.5L199.9 86L196.8 99.2L195.3 103.7L195.9 103.3Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-14)`}>
          <path
            d="M190.3 96.3L190.9 95.7L192.1 95.2L195.3 95.7L200.2 97.7L211.7 103.5L214.8 104.6L217.9 105.3L221.4 105.2L224.8 104L227.5 101.9M181.8 90.2L184.3 87.5L187.5 85.6L191.1 84.8L194.7 84.9L198.2 85.6L201.5 86.7L215.8 93.9L218.9 94.8L220.1 94.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M190.3 96.3L190.9 95.7L192.1 95.2L195.3 95.7L200.2 97.7L208.8 102.2L214.8 104.6L217.9 105.3L221.4 105.2L224.8 104L227.5 101.9L220.1 94.5L218.9 94.8L215.8 93.9L201.5 86.7L198.2 85.6L194.7 84.9L191.1 84.8L187.5 85.6L184.3 87.5L181.8 90.2Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M190.3 96.3L190.9 95.7L192.1 95.2L195.3 95.7L200.2 97.7L211.7 103.5L214.8 104.6L217.9 105.3L221.4 105.2L224.8 104L227.5 101.9M181.8 90.2L184.3 87.5L187.5 85.6L191.1 84.8L194.7 84.9L198.2 85.6L201.5 86.7L215.8 93.9L218.9 94.8L220.1 94.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-15`}>
          <path d="M221.8 107.5L225.9 106.1L229.2 103.6L231.6 100.7L234.7 94.4L239.2 82.7L240.2 80.6L241.9 78.3L241.6 78.4L239.5 63.3L235.2 64.6L231.7 66.9L229 69.8L226.9 73L225.2 76.3L220.5 88.7L218.4 92.8L219.1 92.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-15)`}>
          <path
            d="M214.7 84.7L215.3 84.2L216.5 84L219.5 84.8L224 87.4L234.7 94.8L237.6 96.3L240.7 97.4L244.2 97.7L247.6 97L250.7 95.4M207.1 77.5L209.9 75.2L213.3 73.8L216.9 73.5L220.4 74L226.8 76.8L240 85.7L243.1 87.2L244.4 87"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M214.7 84.7L215.3 84.2L216.5 84L219.5 84.8L224 87.4L234.7 94.8L237.6 96.3L240.7 97.4L244.2 97.7L247.6 97L250.7 95.4L244.4 87L243.1 87.2L240 85.7L226.8 76.8L220.4 74L216.9 73.5L213.3 73.8L209.9 75.2L207.1 77.5Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M214.7 84.7L215.3 84.2L216.5 84L219.5 84.8L224 87.4L234.7 94.8L237.6 96.3L240.7 97.4L244.2 97.7L247.6 97L250.7 95.4M207.1 77.5L209.9 75.2L213.3 73.8L216.9 73.5L220.4 74L226.8 76.8L240 85.7L243.1 87.2L244.4 87"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-16`}>
          <path d="M244.2 100.1L248.5 99.3L252.1 97.3L254.9 94.7L258.8 88.8L264.6 77.6L265.9 75.6L267.9 73.5L267.1 58.2L262.8 59.1L259 61L256 63.7L253.5 66.6L249.7 72.9L245.4 81.4L243 85L243.7 84.8Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-16)`}>
          <path
            d="M240.2 76.6L240.8 76.2L242 76L244.8 77.2L249 80.3L258.7 88.8L261.4 90.7L264.3 92.1L267.5 92.9L271.1 92.8L274.4 91.6M233.3 68.7L236.3 66.7L239.8 65.6L243.5 65.7L246.9 66.6L250 68.1L252.9 70L266.8 81.7L268.7 82.5L269.3 82.4"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M240.2 76.6L240.8 76.2L242 76L244.8 77.2L249 80.3L256.2 86.7L261.4 90.7L264.3 92.1L267.5 92.9L271.1 92.8L274.4 91.6L269.3 82.4L268.7 82.5L266.8 81.7L252.9 70L250 68.1L246.9 66.6L243.5 65.7L239.8 65.6L236.3 66.7L233.3 68.7Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M240.2 76.6L240.8 76.2L242 76L244.8 77.2L249 80.3L258.7 88.8L261.4 90.7L264.3 92.1L267.5 92.9L271.1 92.8L274.4 91.6M233.3 68.7L236.3 66.7L239.8 65.6L243.5 65.7L246.9 66.6L250 68.1L252.9 70L266.8 81.7L268.7 82.5L269.3 82.4"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-17`}>
          <path d="M267.3 95.3L271.6 95.1L275.5 93.7L278.6 91.4L283.2 86.2L290.5 76L293.3 73.1L294.5 72.4L296 57.2L291.6 57.4L287.5 58.7L284.1 60.9L281.2 63.5L276.4 69.2L271 77.1L268.2 80.3L269 80.1Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-17)`}>
          <path
            d="M266.3 71.6L267.6 71.1L269.4 71.6L272.7 74.1L282.8 85.8L287.6 90L290.6 91.4L294.1 92L297.5 91.4M260.3 63L263.6 61.3L267.2 60.6L270.8 61L274.2 62.3L277.2 64.2L279.8 66.4L290.5 78.7L293.2 81.1L294.3 81.4"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M266.3 71.6L267.1 71.2L268.3 71.2L270.9 72.6L274.6 76.1L282.8 85.8L285.1 88.1L287.6 90L290.6 91.4L294.1 92L297.5 91.4L294.3 81.4L293.2 81.1L290.5 78.7L279.8 66.4L277.2 64.2L274.2 62.3L270.8 61L267.2 60.6L263.6 61.3L260.3 63Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M266.3 71.6L267.6 71.1L269.4 71.6L272.7 74.1L282.8 85.8L287.6 90L290.6 91.4L294.1 92L297.5 91.4M260.3 63L263.6 61.3L267.2 60.6L270.8 61L274.2 62.3L277.2 64.2L279.8 66.4L290.5 78.7L293.2 81.1L294.3 81.4"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-18`}>
          <path d="M289.9 93.7L294.2 94.4L298.3 93.7L301.6 92.1L304.5 90.1L316 79.6L319.5 77.4L321 76.9L326 62.5L321.6 61.7L317.3 62.1L313.3 63.4L309.8 65.3L303.7 69.9L296.7 76.6L293.5 79.1L294.5 79.2Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-18)`}>
          <path
            d="M293.2 70.3L294.1 70L295.3 70.2L297.6 72L299.1 73.7L302.1 78.6L306.4 87.1L309.8 92.1L312.3 94.3L315.5 95.7L318.8 96.1M288.6 60.9L292.1 59.7L295.8 59.6L299.4 60.5L302.6 62.3L305.2 64.7L307.5 67.5L311.3 73.6L316.8 83.9L318.3 85.6"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M293.2 70.3L294.1 70L295.3 70.2L297.6 72L299.1 73.7L302.1 78.6L308 89.7L309.8 92.1L312.3 94.3L315.5 95.7L318.8 96.1L318.3 85.6L316.8 83.9L311.3 73.6L307.5 67.5L305.2 64.7L302.6 62.3L299.4 60.5L295.8 59.6L292.1 59.7L288.6 60.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M293.2 70.3L294.1 70L295.3 70.2L297.6 72L299.1 73.7L302.1 78.6L306.4 87.1L309.8 92.1L312.3 94.3L315.5 95.7L318.8 96.1M288.6 60.9L292.1 59.7L295.8 59.6L299.4 60.5L302.6 62.3L305.2 64.7L307.5 67.5L311.3 73.6L316.8 83.9L318.3 85.6"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-19`}>
          <path d="M311 96.3L314.8 98.1L319 98.5L322.5 97.9L325.8 96.8L339.3 90.2L343.3 89.3L345.1 89.4L354.6 77.5L350.7 75.2L346.5 74.1L342.2 74L338.1 74.7L330.7 77.2L318.2 83.2L319.5 83.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-19)`}>
          <path
            d="M321.1 74.5L322.4 75L323.3 75.8L325.2 79.3L326.6 84.7L328 93.9L329.3 99.6L330.7 102.4L333.1 105L336.1 106.5M321.5 64.1L325.2 64.8L328.6 66.5L331.3 69.1L333.4 72.2L334.9 75.5L336.1 79.1L338.8 94.5L339.4 96.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M321.1 74.5L322.4 75L323.3 75.8L325.2 79.3L326.6 84.7L328.6 96.8L329.3 99.6L330.7 102.4L333.1 105L336.1 106.5L339.5 96.6L338.8 94.5L336.1 79.1L334.9 75.5L333.4 72.2L331.3 69.1L328.6 66.5L325.2 64.8L321.5 64.1Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M321.1 74.5L322.4 75L323.3 75.8L325.2 79.3L326.6 84.7L328 93.9L329.3 99.6L330.7 102.4L333.1 105L336.1 106.5M321.5 64.1L325.2 64.8L328.6 66.5L331.3 69.1L333.4 72.2L334.9 75.5L336.1 79.1L338.8 94.5L339.4 96.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-20`}>
          <path d="M328.8 103.8L331.7 106.9L335.3 108.8L338.8 109.5L342.1 109.6L356.9 108.7L361.1 109.4L362.7 110.2L375.9 102.5L373.1 99L369.6 96.4L365.6 94.8L361.7 93.9L353.9 93.4L340.2 94.3L341.4 95.2Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-20)`}>
          <path
            d="M345.9 87.2L347.2 88.2L347.7 89.3L348.2 93.1L347.6 98.5L344.7 110.4L344.3 113.3L344.5 116.5L345.6 119.8L347.8 122.5M349.8 77.4L353.1 79.4L355.8 82.2L357.6 85.7L358.4 89.3L358.7 93.1L358.5 96.8L357.1 104L355 112.3L354.9 114.7"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M345.9 87.2L347.2 88.2L347.7 89.3L348.2 93.1L347.6 98.5L344.7 110.4L344.3 113.3L344.5 116.5L345.6 119.8L347.8 122.5L354.9 114.7L355 112.3L357.1 104L358.5 96.8L358.7 93.1L358.4 89.3L357.6 85.7L355.8 82.2L353.1 79.4L349.8 77.4Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M345.9 87.2L347.2 88.2L347.7 89.3L348.2 93.1L347.6 98.5L344.7 110.4L344.3 113.3L344.5 116.5L345.6 119.8L347.8 122.5M349.8 77.4L353.1 79.4L355.8 82.2L357.6 85.7L358.4 89.3L358.7 93.1L358.5 96.8L357.1 104L355 112.3L354.9 114.7"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-21`}>
          <path d="M342.1 117L343.5 121L346.2 124.3L349.2 126.4L355.4 128.9L367.2 132.3L371.3 134.1L372.7 135.3L387.3 130.6L385.4 126.7L382.6 123.5L379.4 121.1L376 119.3L369 116.7L359.8 114.2L356.5 113L357.2 114.2Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-21)`}>
          <path
            d="M364.3 108.4L365.1 109.7L365.2 110.8L364.3 114.4L361.8 119.4L356.8 127.5L354.1 133.2L353.4 136.5L353.7 140L355 143.2M371.5 100.7L373.9 103.7L375.3 107.2L375.7 111L375.2 114.7L372.6 121.5L364.8 134.9L364.1 136.4L364 137.8"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M364.3 108.4L365.1 109.7L365.2 110.8L364.3 114.4L361.8 119.4L355.3 130.3L354.1 133.2L353.4 136.5L353.7 140L355 143.2L364 137.8L364.1 136.4L364.8 134.9L372.6 121.5L375.2 114.7L375.7 111L375.3 107.2L373.9 103.7L371.5 100.7Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M364.3 108.4L365.1 109.7L365.2 110.8L364.3 114.4L361.8 119.4L356.8 127.5L354.1 133.2L353.4 136.5L353.7 140L355 143.2M371.5 100.7L373.9 103.7L375.3 107.2L375.7 111L375.2 114.7L372.6 121.5L364.8 134.9L364.1 136.4L364 137.8"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-22`}>
          <path d="M351 136.3L351.4 140.6L353 144.5L355.4 147.5L358.2 149.9L361.2 151.7L375 158.8L378 161.3L392.9 158.1L391.4 154L389.1 150.7L386.3 148.1L383.2 145.9L368.7 138.4L366.1 136.5L366.3 137.4Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-22)`}>
          <path
            d="M374.7 133.9L375.1 135.1L374.9 136L373.3 139.3L363.4 151.2L359.8 156.6L358.7 159.8L358.5 163.3L359.3 166.8M383.4 128L385 131.3L385.6 135L385.1 138.7L383.9 141.9L380.1 147.9L370.2 159.6L369.3 161.1L369 162.7"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M374.7 133.9L375.1 135.1L374.9 136L373.3 139.3L361.5 153.8L359.8 156.6L358.7 159.8L358.5 163.3L359.3 166.8L369 162.7L369.3 161.1L370.2 159.6L380.1 147.9L383.9 141.9L385.1 138.7L385.6 135L385 131.3L383.4 128Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M374.7 133.9L375.1 135.1L374.9 136L373.3 139.3L363.4 151.2L359.8 156.6L358.7 159.8L358.5 163.3L359.3 166.8M383.4 128L385 131.3L385.6 135L385.1 138.7L383.9 141.9L380.1 147.9L370.2 159.6L369.3 161.1L369 162.7"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-23`}>
          <path d="M356.4 159.3L356.1 163.6L357.1 167.7L359.2 171.2L361.7 174L364.5 176.2L377.9 184.7L380.9 187.5L396 184.9L394.7 180.8L392.5 177.4L389.9 174.7L387 172.4L375.6 165.3L371.2 161.8L371.3 162.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-23)`}>
          <path
            d="M379.4 159.3L380.1 160.2L380.3 161.2L379.4 163.4L378.2 165.1L367.2 176.1L363.2 181.4L361.8 184.5L361.3 188L361.9 191.5M387.3 152.3L389.3 155.2L390.6 158.6L390.8 162.3L389.9 165.7L388.4 168.8L386.4 171.6L373.4 185.1L371.9 187.5L371.9 188.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M379.4 159.3L380.1 160.2L380.3 161.2L379.4 163.4L376.5 167.1L365.1 178.6L363.2 181.4L361.8 184.5L361.3 188L361.9 191.5L371.9 188.3L371.9 187.5L373.4 185.1L386.4 171.6L388.4 168.8L389.9 165.7L390.8 162.3L390.6 158.6L389.3 155.2L387.3 152.3Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M379.4 159.3L380.1 160.2L380.3 161.2L379.4 163.4L378.2 165.1L367.2 176.1L363.2 181.4L361.8 184.5L361.3 188L361.9 191.5M387.3 152.3L389.3 155.2L390.6 158.6L390.8 162.3L389.9 165.7L388.4 168.8L386.4 171.6L373.4 185.1L371.9 187.5L371.9 188.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-24`}>
          <path d="M359.6 183.8L358.9 188L359.6 192.3L361.4 196L363.7 198.9L366.3 201.4L379.5 210.7L382.5 213.8L397.6 211.5L396.4 207.4L394.3 204L391.8 201.2L389 198.8L378.1 191.2L374.2 187.6L374.2 188.2Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-24)`}>
          <path
            d="M382.4 185.5L383.3 187.5L382.3 189.5L381 191.1L369.5 201.6L365.2 206.6L363.6 209.6L362.9 213.1L363.2 216.7M390.6 179L392.5 181.9L393.6 185.3L393.7 189L392.7 192.4L391 195.4L388.9 198.1L376.8 209.1L374 212.3L373.4 214.1"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M382.4 185.5L383.3 187.5L382.3 189.5L379.2 193L369.5 201.6L367.2 204L365.2 206.6L363.6 209.6L362.9 213.1L363.2 216.7L373.4 214.1L374 212.3L376.8 209.1L388.9 198.1L391 195.4L392.7 192.4L393.7 189L393.6 185.3L392.5 181.9L390.6 179Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M382.4 185.5L383.3 187.5L382.3 189.5L381 191.1L369.5 201.6L365.2 206.6L363.6 209.6L362.9 213.1L363.2 216.7M390.6 179L392.5 181.9L393.6 185.3L393.7 189L392.7 192.4L391 195.4L388.9 198.1L376.8 209.1L374 212.3L373.4 214.1"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-25`}>
          <path d="M361.4 208.8L360.5 213L360.9 217.3L362.4 221.1L364.6 224.2L367.2 226.8L380 236.7L383 240L398.2 238L397 233.9L395 230.4L392.6 227.6L387.1 222.9L379.4 217.1L375.7 213.6L375.7 214.1Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-25)`}>
          <path
            d="M384 211.8L384.8 213.7L383.9 215.6L382.5 217.2L370.7 227.2L366.1 232L364.5 235L363.5 238.3L363.6 241.9M392.4 205.4L394.2 208.4L395.2 211.8L395.2 215.5L394.1 218.9L392.4 221.8L390.2 224.4L375.9 236.7L374.7 238.1L373.9 240"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M384 211.8L384.8 213.7L383.9 215.6L380.7 219L368.3 229.5L366.1 232L364.5 235L363.5 238.3L363.6 241.9L373.9 240L374.7 238.1L375.9 236.7L390.2 224.4L392.4 221.8L394.1 218.9L395.2 215.5L395.2 211.8L394.2 208.4L392.4 205.4Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M384 211.8L384.8 213.7L383.9 215.6L382.5 217.2L370.7 227.2L366.1 232L364.5 235L363.5 238.3L363.6 241.9M392.4 205.4L394.2 208.4L395.2 211.8L395.2 215.5L394.1 218.9L392.4 221.8L390.2 224.4L375.9 236.7L374.7 238.1L373.9 240"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-26`}>
          <path d="M362.3 234L361.1 238L361.2 242.4L362.6 246.3L364.6 249.6L367 252.3L379.5 262.7L382.5 266.2L397.7 264.5L396.7 260.4L394.8 256.9L392.4 254L387.1 249.1L379.7 243.1L376.3 239.6L376.3 240.1Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-26)`}>
          <path
            d="M384.6 238L385.4 240L384.4 241.8L383.1 243.3L370.9 252.8L366.2 257.4L364.3 260.2L363.1 263.6L363 267.2M393.1 231.8L394.8 234.8L395.8 238.3L395.7 241.9L394.6 245.3L392.8 248.2L390.5 250.8L375.7 262.5L373.7 265L373.4 265.9"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M384.6 238L385.4 240L384.4 241.8L383.1 243.3L368.4 255L366.2 257.4L364.3 260.2L363.1 263.6L363 267.2L373.4 265.9L373.7 265L375.7 262.5L390.5 250.8L392.8 248.2L394.6 245.3L395.7 241.9L395.8 238.3L394.8 234.8L393.1 231.8Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M384.6 238L385.4 240L384.4 241.8L383.1 243.3L370.9 252.8L366.2 257.4L364.3 260.2L363.1 263.6L363 267.2M393.1 231.8L394.8 234.8L395.8 238.3L395.7 241.9L394.6 245.3L392.8 248.2L390.5 250.8L375.7 262.5L373.7 265L373.4 265.9"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-27`}>
          <path d="M360.8 263.1L360.6 267.5L361.8 271.5L363.6 274.9L368.4 280.2L378 288.7L381.1 292.4L381.1 292.1L396.1 295.3L396.3 290.9L395.3 286.8L393.5 283.3L391.2 280.4L386.1 275.3L378.9 269.1L375.8 265.5L375.8 266Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-27)`}>
          <path
            d="M384.7 265.3L384.7 267L382.6 269.5L370.2 278.4L365.2 282.8L363.2 285.6L361.9 288.8L361.5 292.4L362.3 295.9M394.4 261.3L395.4 264.7L395.2 268.4L394 271.8L392.1 274.6L387.2 279.3L374.5 288.4L372.3 290.8L372.1 292.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M384.7 265.3L384.7 267L382.6 269.5L367.6 280.5L365.2 282.8L363.2 285.6L361.9 288.8L361.5 292.4L362.3 295.9L372.1 292.3L372.3 290.8L374.5 288.4L387.2 279.3L392.1 274.6L394 271.8L395.2 268.4L395.4 264.7L394.4 261.3Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M384.7 265.3L384.7 267L382.6 269.5L370.2 278.4L365.2 282.8L363.2 285.6L361.9 288.8L361.5 292.4L362.3 295.9M394.4 261.3L395.4 264.7L395.2 268.4L394 271.8L392.1 274.6L387.2 279.3L374.5 288.4L372.3 290.8L372.1 292.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-28`}>
          <path d="M359.5 288.2L359.1 292.6L360 296.7L361.7 300.2L366.3 305.7L375.7 314.6L378.8 318.6L378.8 318.2L393.8 321.5L394 317.1L393 313L391.3 309.6L389.1 306.6L386.7 303.9L377.2 295.1L374.4 291.5L374.4 292Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-28)`}>
          <path
            d="M383.3 291.5L383.2 293.2L381.1 295.5L365.8 306.1L363.3 308.3L361.2 311L359.8 314.2L359.2 317.7L359.8 321.2M393.1 287.7L393.9 291.1L393.7 294.8L392.5 298.1L390.5 301L385.5 305.5L372.5 314.2L370.1 316.6L369.8 318.1"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M383.3 291.5L383.2 293.2L381.1 295.5L365.8 306.1L363.3 308.3L361.2 311L359.8 314.2L359.2 317.7L359.8 321.2L369.8 318.1L370.1 316.6L372.5 314.2L385.5 305.5L390.5 301L392.5 298.1L393.7 294.8L393.9 291.1L393.1 287.7Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M383.3 291.5L383.2 293.2L381.1 295.5L365.8 306.1L363.3 308.3L361.2 311L359.8 314.2L359.2 317.7L359.8 321.2M393.1 287.7L393.9 291.1L393.7 294.8L392.5 298.1L390.5 301L385.5 305.5L372.5 314.2L370.1 316.6L369.8 318.1"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-29`}>
          <path d="M357.5 313.4L356.8 317.8L357.5 321.9L359.1 325.5L363.5 331.3L372.7 340.4L375.9 344.6L375.9 344.3L390.9 347.5L391.1 343.2L390.2 339.1L388.4 335.6L386.3 332.6L374.7 320.9L372.1 317.4L372.1 317.9Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-29)`}>
          <path
            d="M381 317.6L380.9 319.3L378.9 321.5L363.4 331.7L360.8 333.9L358.7 336.4L357 339.5L356.4 343.1L356.8 346.6M390.8 313.9L391.6 317.3L391.4 321L390.2 324.3L388.2 327.1L383.1 331.6L369.8 340L367.3 342.4L366.9 343.9"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M381 317.6L380.9 319.3L378.9 321.5L363.4 331.7L360.8 333.9L358.7 336.4L357 339.5L356.4 343.1L356.8 346.6L366.9 343.9L367.3 342.4L369.8 340L383.1 331.6L388.2 327.1L390.2 324.3L391.4 321L391.6 317.3L390.8 313.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M381 317.6L380.9 319.3L378.9 321.5L363.4 331.7L360.8 333.9L358.7 336.4L357 339.5L356.4 343.1L356.8 346.6M390.8 313.9L391.6 317.3L391.4 321L390.2 324.3L388.2 327.1L383.1 331.6L369.8 340L367.3 342.4L366.9 343.9"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-30`}>
          <path d="M354.8 338.7L354 343L354.5 347.2L355.9 350.9L360.1 356.8L369.2 366.2L372.4 370.6L372.4 370.3L387.3 373.6L387.6 369.2L386.7 365.2L385 361.7L382.9 358.7L371.6 346.7L369.3 343.3L369.2 343.8Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-30)`}>
          <path
            d="M378.1 343.6L378 345.3L376.1 347.5L360.4 357.2L357.8 359.3L355.5 361.7L353.7 364.7L352.9 368.2L353.1 371.8M387.9 340L388.7 343.4L388.5 347L387.3 350.4L385.2 353.2L380.1 357.6L366.5 365.7L363.9 368.1L363.4 369.6"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M378.1 343.6L378 345.3L376.1 347.5L360.4 357.2L357.8 359.3L355.5 361.7L353.7 364.7L352.9 368.2L353.1 371.8L363.4 369.6L363.9 368.1L366.5 365.7L380.1 357.6L385.2 353.2L387.3 350.4L388.5 347L388.7 343.4L387.9 340Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M378.1 343.6L378 345.3L376.1 347.5L360.4 357.2L357.8 359.3L355.5 361.7L353.7 364.7L352.9 368.2L353.1 371.8M387.9 340L388.7 343.4L388.5 347L387.3 350.4L385.2 353.2L380.1 357.6L366.5 365.7L363.9 368.1L363.4 369.6"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-31`}>
          <path d="M351.5 363.8L350.5 368L350.8 372.3L352.1 376L356 382.1L364.7 391.7L366.2 393.6L367.7 396.5L382.5 400.3L383 395.9L382.3 391.7L380.8 388.1L378.8 384.9L367.9 372.4L365.8 369.1L365.7 369.7Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-31)`}>
          <path
            d="M374.5 369.6L374.5 371.3L372.6 373.4L368.2 376.2L356.8 382.4L354.1 384.2L351.6 386.5L349.7 389.2L348.5 392.5L348.5 396.1M384.4 366L385.2 369.4L385 373.1L383.7 376.4L381.6 379.2L379.1 381.6L376.4 383.5L362.4 391.3L359.4 393.5L358.9 394.7"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M374.5 369.6L374.5 371.3L372.6 373.4L368.2 376.2L356.8 382.4L354.1 384.2L351.6 386.5L349.7 389.2L348.5 392.5L348.5 396.1L358.9 394.7L359.4 393.5L362.4 391.3L376.4 383.5L379.1 381.6L381.6 379.2L383.7 376.4L385 373.1L385.2 369.4L384.4 366Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M374.5 369.6L374.5 371.3L372.6 373.4L368.2 376.2L356.8 382.4L354.1 384.2L351.6 386.5L349.7 389.2L348.5 392.5L348.5 396.1M384.4 366L385.2 369.4L385 373.1L383.7 376.4L381.6 379.2L379.1 381.6L376.4 383.5L362.4 391.3L359.4 393.5L358.9 394.7"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-32`}>
          <path d="M347.6 388.1L346.2 392.1L346.1 396.4L347.1 400.1L350.3 406.2L357 416.2L358.4 419.8L358.3 421.8L370.9 430.5L373 426.2L373.8 421.6L373.5 417.1L372.3 412.9L370.6 409.2L363.1 397.8L361.3 394.4L361.1 395.3Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-32)`}>
          <path
            d="M370 395.5L370.1 396.4L369.8 397.5L367.8 399.5L365.8 400.6L360.6 402.8L349.2 406.3L346.6 407.2L344.1 408.7L341.8 411.2L340.6 414.3M380 392.4L380.6 396L380.2 399.6L378.8 403L376.5 405.8L373.8 408.1L370.7 409.9L364.1 412.7L350.5 417L350.9 416.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M370 395.5L370.1 396.4L369.8 397.5L367.8 399.5L365.8 400.6L360.6 402.8L346.6 407.2L344.1 408.7L341.8 411.2L340.6 414.3L350.9 416.3L350.5 417L367.4 411.4L373.8 408.1L376.5 405.8L378.8 403L380.2 399.6L380.6 396L380 392.4Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M370 395.5L370.1 396.4L369.8 397.5L367.8 399.5L365.8 400.6L360.6 402.8L349.2 406.3L346.6 407.2L344.1 408.7L341.8 411.2L340.6 414.3M380 392.4L380.6 396L380.2 399.6L378.8 403L376.5 405.8L373.8 408.1L370.7 409.9L364.1 412.7L350.5 417L350.9 416.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-33`}>
          <path d="M342.6 406.9L339.8 409.9L338.3 413.8L338 417.2L338.7 424.6L338.5 429.7L337.3 434L336.4 435.6L334.9 437.1L338.3 452L342.6 450.3L346.2 447.5L349.1 444.2L351.2 440.4L352.7 436.2L353.6 431.9L354 427.8L353.3 416.7L352 418.9Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-33)`}>
          <path
            d="M360.7 422.3L359.5 424L358.2 424.8L354.4 425.5L349.3 424.6L344.3 422.4L337 418.5L334 417.8L330.7 417.9L327.6 419.2M370.7 425.5L368.9 429.2L366.1 432.2L362.5 434.4L358.4 435.6L354.2 436L350.1 435.6L346.2 434.6L342.6 433.2L333 428.2"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M360.7 422.3L359.5 424L358.2 424.8L354.4 425.5L349.3 424.6L344.3 422.4L337 418.5L334 417.8L330.7 417.9L327.6 419.2L332.8 428.2L342.6 433.2L346.2 434.6L350.1 435.6L354.2 436L358.4 435.6L362.5 434.4L366.1 432.2L368.9 429.2L370.7 425.5Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M360.7 422.3L359.5 424L358.2 424.8L354.4 425.5L349.3 424.6L344.3 422.4L337 418.5L334 417.8L330.7 417.9L327.6 419.2M370.7 425.5L368.9 429.2L366.1 432.2L362.5 434.4L358.4 435.6L354.2 436L350.1 435.6L346.2 434.6L342.6 433.2L333 428.2"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-34`}>
          <path d="M334.3 415.4L330.1 415.6L326.4 417.1L323.5 419.3L319.3 424.4L312.4 434.8L309.4 438.3L308 439.3L308.8 454.6L313.1 453.7L316.7 451.9L319.8 449.5L322.3 446.8L334.2 430.2L332.5 430.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-34)`}>
          <path
            d="M336.3 439.1L334.6 439.5L333.5 439.2L330.3 437.2L326.3 433.3L319.9 426L314.9 421.7L311.8 420.3L308.3 419.7L304.7 420.2M341.5 448.2L337.7 449.6L333.8 449.9L330 449.1L326.7 447.5L323.7 445.4L321 443L310.7 431.7L308.5 430.3L307.7 430.2"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M336.3 439.1L334.6 439.5L333.5 439.2L330.3 437.2L317.5 423.7L314.9 421.7L311.8 420.3L308.3 419.7L304.7 420.2L307.7 430.2L308.5 430.3L310.7 431.7L321 443L323.7 445.4L326.7 447.5L330 449.1L333.8 449.9L337.7 449.6L341.5 448.2Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M336.3 439.1L334.6 439.5L333.5 439.2L330.3 437.2L326.3 433.3L319.9 426L314.9 421.7L311.8 420.3L308.3 419.7L304.7 420.2M341.5 448.2L337.7 449.6L333.8 449.9L330 449.1L326.7 447.5L323.7 445.4L321 443L310.7 431.7L308.5 430.3L307.7 430.2"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-35`}>
          <path d="M312.5 418L308.3 417.3L304 417.9L300.4 419.5L297.3 421.8L294.7 424.3L284.7 436.8L281.8 439.4L282.8 454.6L287 453.8L290.5 452L293.5 449.7L296 447.1L304.3 436.7L308.4 432.5L307.8 432.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-35)`}>
          <path
            d="M309.7 441.1L307.8 441.6L305.7 440.4L302.4 436.8L294.2 426.5L289.2 422.1L286.1 420.5L282.6 419.8L279 420.1M315.4 449.9L312.3 451.5L308.7 452.2L305.1 451.8L301.8 450.4L299 448.4L296.6 446.1L284.8 431.9L282.6 430.4L281.7 430.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M309.7 441.1L307.8 441.6L305.7 440.4L302.4 436.8L294.2 426.5L289.2 422.1L286.1 420.5L282.6 419.8L279 420.1L281.7 430.3L282.6 430.4L284.8 431.9L296.6 446.1L299 448.4L301.8 450.4L305.1 451.8L308.7 452.2L312.3 451.5L315.4 449.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M309.7 441.1L307.8 441.6L305.7 440.4L302.4 436.8L294.2 426.5L289.2 422.1L286.1 420.5L282.6 419.8L279 420.1M315.4 449.9L312.3 451.5L308.7 452.2L305.1 451.8L301.8 450.4L299 448.4L296.6 446.1L284.8 431.9L282.6 430.4L281.7 430.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-36`}>
          <path d="M287 418.2L282.8 417.4L278.4 417.8L274.6 419.4L271.5 421.6L268.8 424.1L258.7 436.7L255.6 439.4L257 454.6L261.1 453.7L264.6 451.8L267.6 449.5L272.3 444.2L279.9 434.6L282.3 432.6L281.8 432.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-36)`}>
          <path
            d="M283.5 441.1L281.7 441.7L279.7 440.5L276.4 437L268.3 426.7L263.3 422.2L260.3 420.6L256.8 419.8L253.2 420.1M289.2 449.9L286.1 451.5L282.6 452.2L279 451.9L275.8 450.5L273 448.6L270.6 446.3L258.8 432L256.5 430.4L255.6 430.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M283.5 441.1L281.7 441.7L279.7 440.5L276.4 437L270.5 429.3L265.9 424.3L263.3 422.2L260.3 420.6L256.8 419.8L253.2 420.1L255.6 430.3L256.5 430.4L258.8 432L270.6 446.3L273 448.6L275.8 450.5L279 451.9L282.6 452.2L286.1 451.5L289.2 449.9Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M283.5 441.1L281.7 441.7L279.7 440.5L276.4 437L268.3 426.7L263.3 422.2L260.3 420.6L256.8 419.8L253.2 420.1M289.2 449.9L286.1 451.5L282.6 452.2L279 451.9L275.8 450.5L273 448.6L270.6 446.3L258.8 432L256.5 430.4L255.6 430.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-37`}>
          <path d="M261.1 418.3L257 417.4L252.6 417.7L248.8 419.2L245.6 421.4L242.9 423.9L232.7 436.5L229.5 439.4L231.2 454.6L235.3 453.5L238.8 451.6L241.6 449.3L246.4 444L252.3 436.4L256.2 432.6L255.6 432.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-37)`}>
          <path
            d="M257.5 441.1L255.6 441.7L253.7 440.6L250.4 437.2L242.3 426.9L237.4 422.3L234.4 420.7L230.9 419.8L227.3 420M263.3 449.8L260.3 451.4L256.8 452.2L253.2 451.9L249.9 450.7L247.1 448.7L244.6 446.5L232.8 432.1L230.4 430.4L229.5 430.3"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M257.5 441.1L255.6 441.7L253.7 440.6L250.4 437.2L244.5 429.5L240 424.5L237.4 422.3L234.4 420.7L230.9 419.8L227.3 420L229.5 430.3L230.4 430.4L232.8 432.1L244.6 446.5L247.1 448.7L249.9 450.7L253.2 451.9L256.8 452.2L260.3 451.4L263.3 449.8Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M257.5 441.1L255.6 441.7L253.7 440.6L250.4 437.2L242.3 426.9L237.4 422.3L234.4 420.7L230.9 419.8L227.3 420M263.3 449.8L260.3 451.4L256.8 452.2L253.2 451.9L249.9 450.7L247.1 448.7L244.6 446.5L232.8 432.1L230.4 430.4L229.5 430.3"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-38`}>
          <path d="M235.3 418.5L231.2 417.4L226.8 417.7L222.9 419.1L219.7 421.2L217 423.7L206.7 436.3L203.4 439.2L205 454.5L209.1 453.4L212.6 451.5L215.6 449.1L220.4 443.8L226.3 436.2L230 432.6L229.5 432.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-38)`}>
          <path
            d="M231.4 441L229.5 441.7L227.7 440.7L226.2 439.3L216.4 427.1L211.7 422.5L208.8 420.8L205.4 419.7L201.8 419.8M237.4 449.7L234.4 451.3L230.9 452.2L227.3 452L224 450.8L221.2 448.9L218.7 446.6L208.5 434L205.4 430.9L203.6 430.1"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M231.4 441L229.5 441.7L227.7 440.7L224.4 437.3L218.6 429.7L214.2 424.7L211.7 422.5L208.8 420.8L205.4 419.7L201.8 419.8L203.6 430.1L205.4 430.9L208.5 434L218.7 446.6L221.2 448.9L224 450.8L227.3 452L230.9 452.2L234.4 451.3L237.4 449.7Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M231.4 441L229.5 441.7L227.7 440.7L226.2 439.3L216.4 427.1L211.7 422.5L208.8 420.8L205.4 419.7L201.8 419.8M237.4 449.7L234.4 451.3L230.9 452.2L227.3 452L224 450.8L221.2 448.9L218.7 446.6L208.5 434L205.4 430.9L203.6 430.1"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <clipPath id={`${p}-pierre-b-x0-39`}>
          <path d="M209.8 418.6L205.8 417.4L201.4 417.4L197.5 418.7L194.3 420.7L191.6 422.9L180.9 434L179.3 435.2L176.9 436.2L174.7 451.3L179.4 451.3L183.6 450.2L187.3 448.3L190.7 445.8L193.5 443.2L202.1 434.1L204 432.5L203.4 432.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-b-x0-39)`}>
          <path
            d="M205.4 440.9L204.3 441.4L203.2 441.6L201.4 440.5L199.9 439.1L196.6 434.8L188.4 421.9L186.4 419.7L183.8 417.9L180.5 417M211.3 449.5L208.2 451.2L204.7 452.1L201 451.9L197.7 450.6L194.8 448.7L192.2 446.3L187.9 440.7L181.3 430L179.2 427.4L179.6 427.5"
            fill="none"
            stroke="#16191D"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M205.4 440.9L204.3 441.4L203.2 441.6L201.4 440.5L199.9 439.1L196.6 434.8L188.4 421.9L186.4 419.7L183.8 417.9L180.5 417L179.6 427.5L179.2 427.4L181.3 430L187.9 440.7L192.2 446.3L194.8 448.7L197.7 450.6L201 451.9L204.7 452.1L208.2 451.2L211.3 449.5Z"
          fill={`url(#${p}-pierre-b-ochre)`}
        />
        <path
          d="M205.4 440.9L204.3 441.4L203.2 441.6L201.4 440.5L199.9 439.1L196.6 434.8L188.4 421.9L186.4 419.7L183.8 417.9L180.5 417M211.3 449.5L208.2 451.2L204.7 452.1L201 451.9L197.7 450.6L194.8 448.7L192.2 446.3L187.9 440.7L181.3 430L179.2 427.4L179.6 427.5"
          fill="none"
          stroke="#16191D"
          strokeWidth="3.6"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
      </g>
      <g id={`${p}-pierre-b-letter`}>
        <path
          d="M216.2 255.4V186H253.7A36.4 34.7 0 0 1 253.7 255.4ZM216.2 255.4H256.4A43.4 41.3 0 0 1 256.4 338H216.2Z"
          fill="none"
          stroke="#5A2414"
          strokeWidth="38"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <g mask={`url(#${p}-pierre-b-lmask)`}>
          <path
            d="M216.2 255.4V186H253.7A36.4 34.7 0 0 1 253.7 255.4ZM216.2 255.4H256.4A43.4 41.3 0 0 1 256.4 338H216.2Z"
            fill="none"
            stroke={`url(#${p}-pierre-b-lpaint)`}
            strokeWidth="38"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
            strokeLinecap="butt"
            transform="translate(6 6)"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/rangs/rank-A.svg */
function rankA(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="A" {...svg}>
      <defs>
        <clipPath id={`${p}-pierre-a-vc`}>
          <path d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z" />
        </clipPath>
        <clipPath id={`${p}-pierre-a-vc2`}>
          <path
            d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z"
            transform="translate(-12 -10)"
          />
        </clipPath>
        <linearGradient
          id={`${p}-pierre-a-body`}
          gradientUnits="userSpaceOnUse"
          x1="90.1"
          y1="17.9"
          x2="426.3"
          y2="486"
        >
          <stop offset="0" stopColor="#33455F" />
          <stop offset="1" stopColor="#162133" />
        </linearGradient>
        <mask id={`${p}-pierre-a-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M172 372L232.4 172L279.6 172L340 372L300.3 372L287.8 330.7L224.2 330.7L211.7 372ZM256 225.4L234.1 298L277.9 298Z"
            fill="#fff"
            fillRule="evenodd"
          />
        </mask>
        <linearGradient
          id={`${p}-pierre-a-ice`}
          gradientUnits="userSpaceOnUse"
          x1="90"
          y1="20"
          x2="420"
          y2="480"
        >
          <stop offset="0" stopColor="#7FE2FF" />
          <stop offset="0.5" stopColor="#45C4F0" />
          <stop offset="1" stopColor="#2391C6" />
        </linearGradient>
        <linearGradient
          id={`${p}-pierre-a-lice`}
          gradientUnits="userSpaceOnUse"
          x1="200"
          y1="170"
          x2="320"
          y2="370"
        >
          <stop offset="0" stopColor="#F2FDFF" />
          <stop offset="0.55" stopColor="#A9EEFF" />
          <stop offset="1" stopColor="#5ED8FF" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-a-frame`}>
        <g clipPath={`url(#${p}-pierre-a-vc)`}>
          <path
            d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z"
            fill="#0E1624"
          />
          <g clipPath={`url(#${p}-pierre-a-vc2)`}>
            <path
              d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z"
              fill="#567599"
            />
            <path
              d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z"
              transform="translate(5 5)"
              fill={`url(#${p}-pierre-a-body)`}
            />
          </g>
        </g>
        <circle cx="229" cy="59.1" r="1.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="247.6" cy="166.9" r="2.3" fill="#0A111C" opacity="0.5" />
        <circle cx="311.1" cy="58.1" r="1.3" fill="#6E8CB0" opacity="0.35" />
        <circle cx="377.6" cy="235" r="2.2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="301.9" cy="446.8" r="1.2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="295.9" cy="274.8" r="2.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="147.3" cy="155.6" r="2.1" fill="#0A111C" opacity="0.5" />
        <circle cx="122.1" cy="350.6" r="1.6" fill="#0A111C" opacity="0.5" />
        <circle cx="365.5" cy="76.2" r="2" fill="#0A111C" opacity="0.5" />
        <circle cx="196" cy="117.8" r="1.6" fill="#6E8CB0" opacity="0.35" />
        <circle cx="388.3" cy="273.5" r="2.3" fill="#0A111C" opacity="0.5" />
        <circle cx="139.2" cy="383.9" r="2.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="133.5" cy="350.9" r="2.3" fill="#6E8CB0" opacity="0.35" />
        <circle cx="299.2" cy="369.6" r="1.2" fill="#0A111C" opacity="0.5" />
        <circle cx="273.1" cy="307.3" r="1.8" fill="#0A111C" opacity="0.5" />
        <circle cx="314" cy="155.6" r="1.5" fill="#6E8CB0" opacity="0.35" />
        <circle cx="204.1" cy="198.3" r="1.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="129.8" cy="224.1" r="2.1" fill="#0A111C" opacity="0.5" />
        <circle cx="240.5" cy="453.4" r="2.2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="324.1" cy="88.7" r="2.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="327.6" cy="53.6" r="1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="290.9" cy="426.7" r="1.7" fill="#6E8CB0" opacity="0.35" />
        <circle cx="125.1" cy="349.9" r="2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="326.1" cy="60.5" r="2.2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="262.7" cy="194.3" r="1.7" fill="#6E8CB0" opacity="0.35" />
        <circle cx="215.8" cy="82.8" r="1.4" fill="#0A111C" opacity="0.5" />
        <circle cx="144.3" cy="393" r="1.9" fill="#0A111C" opacity="0.5" />
        <circle cx="152.4" cy="273.9" r="1.2" fill="#0A111C" opacity="0.5" />
        <circle cx="250.4" cy="279.6" r="1.9" fill="#0A111C" opacity="0.5" />
        <circle cx="305.8" cy="437.6" r="1.8" fill="#6E8CB0" opacity="0.35" />
        <circle cx="269.6" cy="243.3" r="1.9" fill="#0A111C" opacity="0.5" />
        <circle cx="368.3" cy="316.1" r="1.2" fill="#0A111C" opacity="0.5" />
        <circle cx="329.8" cy="301" r="1.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="324" cy="77.4" r="1.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="129.2" cy="108.1" r="1.3" fill="#0A111C" opacity="0.5" />
        <circle cx="190.4" cy="111.7" r="1.7" fill="#0A111C" opacity="0.5" />
        <circle cx="144.5" cy="278" r="1.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="338.2" cy="456.7" r="1.2" fill="#0A111C" opacity="0.5" />
        <circle cx="392.7" cy="245.9" r="1.5" fill="#0A111C" opacity="0.5" />
        <circle cx="174.7" cy="379" r="1.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="269.6" cy="98.8" r="1.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="221.7" cy="430.5" r="1.6" fill="#0A111C" opacity="0.5" />
        <circle cx="369.4" cy="72.7" r="1.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="220" cy="255.1" r="2.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="125.5" cy="121.5" r="1.7" fill="#0A111C" opacity="0.5" />
        <circle cx="154.9" cy="148.4" r="1.6" fill="#6E8CB0" opacity="0.35" />
        <circle cx="327.8" cy="202.9" r="2.2" fill="#6E8CB0" opacity="0.35" />
        <circle cx="145.7" cy="321.9" r="1.6" fill="#0A111C" opacity="0.5" />
        <circle cx="363.3" cy="264.6" r="1.1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="324" cy="458.1" r="1.6" fill="#0A111C" opacity="0.5" />
        <circle cx="213.2" cy="286.8" r="2.2" fill="#0A111C" opacity="0.5" />
        <circle cx="298.8" cy="277.3" r="1.7" fill="#0A111C" opacity="0.5" />
        <circle cx="161" cy="213.7" r="1.6" fill="#0A111C" opacity="0.5" />
        <circle cx="248.2" cy="162" r="1.3" fill="#6E8CB0" opacity="0.35" />
        <circle cx="366.4" cy="307.4" r="1.3" fill="#6E8CB0" opacity="0.35" />
        <circle cx="179.1" cy="378.3" r="1.4" fill="#6E8CB0" opacity="0.35" />
        <circle cx="138.8" cy="329.8" r="1.9" fill="#6E8CB0" opacity="0.35" />
        <circle cx="211.3" cy="80.5" r="1" fill="#6E8CB0" opacity="0.35" />
        <circle cx="284.5" cy="296.2" r="1.5" fill="#6E8CB0" opacity="0.35" />
        <circle cx="364.6" cy="233.4" r="1.6" fill="#0A111C" opacity="0.5" />
        <path
          d="M134 486C134 486 116.7 432.7 110 400C103.3 367.3 97 328 94 290C91 252 88 205.7 92 172C96 138.3 102.3 111 118 88C133.7 65 159.7 45.7 186 34C212.3 22.3 247 17.3 276 18C305 18.7 337.3 24 360 38C382.7 52 401 73.3 412 102C423 130.7 424.7 173.3 426 210C427.3 246.7 424 288.7 420 322C416 355.3 408.3 382.7 402 410C395.7 437.3 382 486 382 486C382 486 134 486 134 486Z"
          fill="none"
          stroke="#5E8DB5"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-a-ornament`}>
        <path
          d="M255 444L253 443.6L251 442.7L245 438.2L241 435.9L237 435.3L233 434.2L199.8 433.6L189.3 432.6L182.3 430.9L177.6 431.6L174.7 431.2L173.6 430.5L171.7 428.4L169.5 424.7L164.7 410.3L163.1 403.1L160.9 387.8L154.2 351.1L151.2 331.7L148.7 312.1L146.3 288.6L144.5 265L143.2 241.4L142.6 219.8L142.8 204.3L143.5 189L145.1 173.8L147.2 160.9L149.6 150.1L153.4 138.1L157.6 128.5L162.8 119.5L169 111.2L177.5 102.5L187.1 94.9L197.7 88.2L209 82.8L220.9 78.4L233.2 75.1L247.7 72.6L262.5 71.4L277.4 71.3L292.1 72.5L306.3 75L318.1 78.6L324.4 81.3L328.9 83.6L333.2 86.2L338.5 90.1L345.9 96.9L351.2 103.4L355.9 110.4L360.5 119.7L363.6 127.9L366.1 136.5L368.4 147.3L370.1 158.5L371.7 173.8L373 193.3L373.7 212.9L373.8 232.5L373.3 252.1L372.3 271.6L370.5 293.2L368.3 312.6L365.5 331.9L362.3 349.2L358.2 368.4L352.3 393.5L348.4 408.2L345.5 416.4L342.9 421.9L339.9 426.1L335.7 429.7L336 429.8L329.5 430.4L321 430L311.9 428.8L301.1 426.6L291 423.2L268.9 413.5L260.9 410.4L237.2 402.9L223.4 399.6L203.7 395.4L159.8 388.1L153.6 387.6L147.3 387.6L130.6 389L120.8 391.8L116.8 392.5L117.2 395.5L121.2 395.4L131.2 395.8L137.1 395.7L142.7 396.3L157.8 399.8L183.1 405.1L204 410.7L241.8 422.3L252.7 426.2L262.8 431L282 442L289.7 446L302.2 450.8L314.7 454.4L325.8 456.5L335.8 457L341.7 456.4L345.8 455.3L351.8 452.1L358.6 446.8L362.5 442.6L367 436L370.4 429.2L373.8 420.6L376.9 410.2L385.9 372.6L392.7 338.5L395.3 322.3L397.5 304L399.5 283.7L400.7 265.4L401.5 247L401.9 226.6L401.6 208.2L400.9 189.9L399.7 171.5L398.2 157L396.4 144.5L394.3 133.9L391.5 123.3L387.9 112.8L383.3 102.4L378.9 94.4L372.4 84.9L366.3 77.8L359.6 71.3L352.3 65.5L344.6 60.4L336.4 56L323.7 50.9L310.8 47.3L297.8 45L282.7 43.5L267.7 43.2L252.7 43.9L237.8 45.8L222.9 48.8L210.4 52.4L198 57L186.1 62.7L174.7 69.5L163.9 77.4L155.4 84.8L147.7 93.1L139.5 104L133.7 113.8L128.9 124.1L124.4 136.6L121 149.2L118.2 163.9L116.3 178.6L115.1 195.3L114.6 211.8L114.9 234.4L116 258.8L118.1 287.1L120.7 313.3L124.1 339.6L128.2 365.7L132.8 389.7L136.1 401.6L143.3 421.9L146.2 428.1L148.7 432.2L154.9 440.1L164.4 449.3L170.2 455.5L172.5 457.1L182.4 459.8L193.9 461.3L206.7 461.9L231 462L241 460.1L245 457.8L251 453.3L253 452.4L255 452Z"
          fill={`url(#${p}-pierre-a-ice)`}
          stroke="#07101B"
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        <path
          d="M245 448L211 448L197 447.5L185.1 446.1L179.3 444.6L175.5 443.2L172 441.5L168.6 439.3L165.6 436.6L161.7 432.1L159.5 428.7L156.8 423.4L154.6 417.8L152.1 410.2L147.8 392.7L143.4 371.1L139.1 345.5L135.8 321.7L133.1 297.8L130.9 271.9L129.4 245.9L128.7 223.9L128.7 205.9L129.4 189.9L130.9 174L133 160.2L135.6 148.4L139 136.9L143.4 125.8L148 116.9L152.3 110.1L157.1 103.7L162.4 97.7L168.1 92.1L175.8 85.8L182.4 81.2L189.2 77L198 72.3L205.4 69.1L214.8 65.7L224.4 62.8L234.1 60.6L244 59L253.9 57.9L263.9 57.3L273.9 57.2L283.9 57.6L293.9 58.6L303.7 60.1L311.6 61.9L319.2 64.2L326.7 67L333.9 70.4L339.1 73.4L345.7 78L351.9 83.1L356.1 87.4L361.3 93.5L364.8 98.3L368.9 105.2L372.5 112.3L375.6 119.7L379.2 131.2L381.8 142.9L384 156.7L385.9 174.6L387.2 196.6L387.8 218.6L387.7 240.6L386.9 262.6L385.5 282.6L383.6 302.5L381.4 320.4L378.6 338.2L374.4 359.8L367.8 389L362.9 408.4L359.2 419.9L356.8 425.4L353.9 430.6L350.3 435.4L347.4 438.2L344.2 440.6L340.7 442.6L336.8 443.4L332.9 443.7L324.9 443.3L316.9 442.1L307.2 440L297.6 437.2L288.3 433.5L261.4 420.2"
          fill="none"
          stroke="#1F7FAE"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <clipPath id={`${p}-pierre-a-k0`}>
          <path d="M270 411.1L261.9 407.9L247.9 403.2L228.1 397.9L200.3 392L160.3 385.4L154 384.9L147.6 384.9L132.4 386.1L128.3 386.8L120.4 389.1L116.6 389.8L117.4 398.2L137.2 398.4L140.8 398.7L157.3 402.5L184.5 408.2L201.5 412.8L242.8 425.5L251.8 428.7L260 432.6Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-a-k0)`}>
          <path
            d="M166.9 417.1L164.7 410.3L163.5 405L160.9 387.8L155.8 360.8M145.2 426L142.5 419.8L134.3 395.7L132 385.7L128.2 365.7"
            fill="none"
            stroke="#07101B"
            strokeWidth="9"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M166.9 417.1L164.7 410.3L163.5 405L160.9 387.8L155.8 360.8L128.2 365.7L132 385.7L134.3 395.7L142.5 419.8L145.2 426Z"
          fill={`url(#${p}-pierre-a-ice)`}
        />
        <path
          d="M166.9 417.1L164.7 410.3L163.5 405L160.9 387.8L155.8 360.8M145.2 426L142.5 419.8L134.3 395.7L132 385.7L128.2 365.7"
          fill="none"
          stroke="#07101B"
          strokeWidth="4.2"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <path
          d="M156 421.5L152.7 412.1L149.6 400.5L145.7 382.9L142 363.3"
          fill="none"
          stroke="#1F7FAE"
          strokeWidth="2.4"
          strokeLinecap="butt"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <path
          d="M224.1 445.1C213.5 455.6 208.3 455.6 198.1 444.8C208.6 434.3 213.8 434.3 224.1 445.1Z"
          fill="#07101B"
        />
        <circle cx="214.1" cy="445" r="3.3" fill="#DFFAFF" />
        <path
          d="M235 454Q209 467.7 195 455.5"
          fill="none"
          stroke="#07101B"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M117 394C107.3 397.1 106.7 409.3 116.4 406.2"
          fill="none"
          stroke={`url(#${p}-pierre-a-ice)`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </g>
      <g id={`${p}-pierre-a-letter`}>
        <path
          d="M172 372L232.4 172L279.6 172L340 372L300.3 372L287.8 330.7L224.2 330.7L211.7 372ZM256 225.4L234.1 298L277.9 298Z"
          fill="#041A2B"
          fillRule="evenodd"
        />
        <g mask={`url(#${p}-pierre-a-lmask)`}>
          <path
            d="M172 372L232.4 172L279.6 172L340 372L300.3 372L287.8 330.7L224.2 330.7L211.7 372ZM256 225.4L234.1 298L277.9 298Z"
            fill={`url(#${p}-pierre-a-lice)`}
            fillRule="evenodd"
            transform="translate(3.5 3.5)"
          />
        </g>
      </g>
    </svg>
  );
}

/** docs/brand/rangs/rank-S.svg */
function rankS(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="S" {...svg}>
      <defs>
        <clipPath id={`${p}-pierre-s-vc`}>
          <path d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z" />
        </clipPath>
        <clipPath id={`${p}-pierre-s-vc2`}>
          <path
            d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
            transform="translate(-12 -10)"
          />
        </clipPath>
        <linearGradient
          id={`${p}-pierre-s-body`}
          gradientUnits="userSpaceOnUse"
          x1="83.3"
          y1="10.9"
          x2="432.3"
          y2="452"
        >
          <stop offset="0" stopColor="#30284F" />
          <stop offset="1" stopColor="#0D0A18" />
        </linearGradient>
        <mask id={`${p}-pierre-s-lmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path
            d="M299.4 172.9A48.8 38.1 0 1 0 228 223.1C250.6 236.8 266 227 288.3 241.1A52.4 42.4 0 1 1 211.5 297"
            fill="none"
            stroke="#fff"
            strokeWidth="42"
            strokeLinejoin="round"
            strokeMiterlimit="8"
            strokeLinecap="butt"
          />
        </mask>
        <filter
          id={`${p}-pierre-s-blur`}
          filterUnits="userSpaceOnUse"
          x="-64"
          y="-64"
          width="640"
          height="640"
        >
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter
          id={`${p}-pierre-s-blur2`}
          filterUnits="userSpaceOnUse"
          x="-64"
          y="-64"
          width="640"
          height="640"
        >
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id={`${p}-pierre-s-halo`} gradientUnits="userSpaceOnUse" cx="256" cy="236" r="256">
          <stop offset="0" stopColor="#8C6BFF" stopOpacity="0.5" />
          <stop offset="0.62" stopColor="#8C6BFF" stopOpacity="0.2" />
          <stop offset="1" stopColor="#8C6BFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${p}-pierre-s-vio`}
          gradientUnits="userSpaceOnUse"
          x1="90"
          y1="20"
          x2="420"
          y2="460"
        >
          <stop offset="0" stopColor="#C9B8FF" />
          <stop offset="0.5" stopColor="#9C80FF" />
          <stop offset="1" stopColor="#7454F0" />
        </linearGradient>
        <linearGradient
          id={`${p}-pierre-s-lvio`}
          gradientUnits="userSpaceOnUse"
          x1="200"
          y1="150"
          x2="320"
          y2="340"
        >
          <stop offset="0" stopColor="#D8CCFF" />
          <stop offset="1" stopColor="#9A7DFF" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-s-glow`}>
        <circle cx="256" cy="236" r="256" fill={`url(#${p}-pierre-s-halo)`} />
        <path
          d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="16"
          opacity="0.55"
          filter={`url(#${p}-pierre-s-blur)`}
        />
        <path
          d="M410 386L452 410"
          stroke="#8C6BFF"
          strokeWidth="14"
          strokeLinecap="round"
          opacity="0.9"
          filter={`url(#${p}-pierre-s-blur2)`}
        />
        <path d="M412 387L436 400" stroke="#F2FDFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        <path d="M452 390L456.8 398L452 406L447.2 398Z" fill="#F2FDFF" opacity="1" />
        <path d="M468 375L471 380L468 385L465 380Z" fill="#C3B1FF" opacity="1" />
        <path d="M462 417.5L464.7 422L462 426.5L459.3 422Z" fill="#C3B1FF" opacity="0.9" />
        <path d="M478 401L479.8 404L478 407L476.2 404Z" fill="#F2FDFF" opacity="0.8" />
      </g>
      <g id={`${p}-pierre-s-frame`}>
        <path d="M70 446L442 446L446 470L66 470Z" fill="#1C1730" />
        <path d="M70 446L442 446L443 451L69 451Z" fill="#3A3060" />
        <path d="M60 470L452 470L462 478L50 478Z" fill="#2E2650" />
        <path d="M50 478L462 478L462 494L50 494Z" fill="#130F22" />
        <path
          d="M70 446L442 446L446 470L66 470Z"
          fill="none"
          stroke="#6B55C8"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M60 470L452 470L462 478L462 494L50 494L50 478Z"
          fill="none"
          stroke="#6B55C8"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g clipPath={`url(#${p}-pierre-s-vc)`}>
          <path
            d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
            fill="#08060F"
          />
          <g clipPath={`url(#${p}-pierre-s-vc2)`}>
            <path
              d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
              fill="#54448C"
            />
            <path
              d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
              transform="translate(5 5)"
              fill={`url(#${p}-pierre-s-body)`}
            />
          </g>
        </g>
        <circle cx="274.6" cy="323.3" r="1.5" fill="#F2FDFF" opacity="0.25" />
        <circle cx="283.2" cy="196.7" r="1.3" fill="#8C6BFF" opacity="0.35" />
        <circle cx="358.6" cy="287.6" r="1.2" fill="#F2FDFF" opacity="0.25" />
        <circle cx="341.1" cy="196.9" r="1.3" fill="#F2FDFF" opacity="0.25" />
        <circle cx="254.2" cy="383.7" r="1.4" fill="#F2FDFF" opacity="0.25" />
        <circle cx="317.6" cy="105.9" r="1.7" fill="#F2FDFF" opacity="0.25" />
        <circle cx="153.1" cy="78.6" r="1.3" fill="#F2FDFF" opacity="0.25" />
        <circle cx="298.3" cy="255.5" r="0.9" fill="#8C6BFF" opacity="0.35" />
        <circle cx="158.7" cy="352" r="0.9" fill="#F2FDFF" opacity="0.25" />
        <circle cx="360.3" cy="123.9" r="1.6" fill="#F2FDFF" opacity="0.25" />
        <circle cx="212.7" cy="124.1" r="1.7" fill="#F2FDFF" opacity="0.25" />
        <circle cx="141.7" cy="369.3" r="1.2" fill="#F2FDFF" opacity="0.25" />
        <circle cx="190.4" cy="333.7" r="1.2" fill="#F2FDFF" opacity="0.25" />
        <circle cx="131.2" cy="346.4" r="1.4" fill="#F2FDFF" opacity="0.25" />
        <circle cx="239.3" cy="103.1" r="1" fill="#F2FDFF" opacity="0.25" />
        <circle cx="211.9" cy="121.1" r="1.6" fill="#F2FDFF" opacity="0.25" />
        <circle cx="182.3" cy="170.3" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="204.5" cy="331.8" r="0.9" fill="#F2FDFF" opacity="0.25" />
        <circle cx="149.9" cy="354.5" r="1.6" fill="#8C6BFF" opacity="0.35" />
        <circle cx="159.2" cy="115.5" r="0.8" fill="#F2FDFF" opacity="0.25" />
        <circle cx="243.1" cy="139.3" r="1.5" fill="#8C6BFF" opacity="0.35" />
        <circle cx="242.5" cy="176" r="1.1" fill="#8C6BFF" opacity="0.35" />
        <circle cx="148" cy="108.8" r="1.1" fill="#8C6BFF" opacity="0.35" />
        <circle cx="403.2" cy="277.3" r="0.9" fill="#8C6BFF" opacity="0.35" />
        <circle cx="183.5" cy="58.4" r="1.6" fill="#8C6BFF" opacity="0.35" />
        <circle cx="156.3" cy="91.5" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="158.2" cy="274.3" r="1.7" fill="#F2FDFF" opacity="0.25" />
        <circle cx="213.3" cy="222.4" r="0.9" fill="#F2FDFF" opacity="0.25" />
        <circle cx="195.3" cy="282.2" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="165.9" cy="244.6" r="1.4" fill="#F2FDFF" opacity="0.25" />
        <circle cx="189.7" cy="376" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="356.1" cy="202.9" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="179.3" cy="375.5" r="1.4" fill="#8C6BFF" opacity="0.35" />
        <circle cx="277.5" cy="201.1" r="1.5" fill="#F2FDFF" opacity="0.25" />
        <circle cx="351.6" cy="348.8" r="1.6" fill="#F2FDFF" opacity="0.25" />
        <circle cx="179.1" cy="332.8" r="1.7" fill="#8C6BFF" opacity="0.35" />
        <circle cx="279.6" cy="301.7" r="1" fill="#F2FDFF" opacity="0.25" />
        <circle cx="320.2" cy="35" r="1.3" fill="#F2FDFF" opacity="0.25" />
        <circle cx="336.9" cy="228.1" r="1.8" fill="#8C6BFF" opacity="0.35" />
        <circle cx="175.5" cy="221.2" r="1.5" fill="#F2FDFF" opacity="0.25" />
        <path
          d="M122 452C122 452 104.3 395.3 98 360C91.7 324.7 85.3 278 84 240C82.7 202 82.3 162 90 132C97.7 102 110.3 78.7 130 60C149.7 41.3 180 28 208 20C236 12 270 9 298 12C326 15 355.7 21.7 376 38C396.3 54.3 410.7 78.3 420 110C429.3 141.7 430.7 190.7 432 228C433.3 265.3 429.2 311 428 334C426.8 357 425 366 425 366C425 366 411 384 411 384C411 384 420 399 420 399C420 399 404 452 404 452C404 452 122 452 122 452Z"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-s-ornament`}>
        <path
          d="M257 408L255 407.6L253 406.7L247 402.2L243 399.9L239 399.3L235 398.2L195.3 397.8L180.9 396.8L173.9 398.9L170.9 398.6L167.1 396.5L164.3 393.7L160.7 387.9L157.6 380.8L156 374L148.1 330.4L144.6 307.1L141.8 283.6L139.8 262.1L138.4 240.6L137.7 219L137.8 197.5L138.5 182.2L139.9 167.1L142 154.3L144.6 143.7L148 133.5L152.3 123.9L157.5 114.9L163.7 106.8L170.9 99.5L180.5 92L191.1 85.6L202.7 80.2L216.5 75.1L230.9 71.1L245.5 68.3L260.3 66.6L275.2 66.1L290 66.8L304.6 68.8L316.7 71.7L327.9 75.9L336.5 80.7L344.2 86.7L350.9 94L356.6 102.3L361.4 111.6L365.3 121.6L368.5 132L371 142.9L373.2 156L375 171.2L376.3 188.7L377.3 210.2L377.7 231.9L377.4 253.4L376.7 273.1L375.1 296.6L372.8 320.2L370.2 341.6L367.3 360.9L365.1 371.9L363.3 378.7L361.2 384.6L358 390L354.9 392.9L351 394.9L345.6 396.5L338.9 397.6L332.5 397.2L323.6 395.9L303.3 391.3L292.9 387.8L264.9 375.8L252.7 371.8L242.7 369L232.7 366.7L206.8 362.2L160.7 356.7L152.5 356.5L129.8 358L121.9 359.9L117.9 360.5L118.1 363.5L141.8 365L159.1 368.6L186.7 372.9L203.9 376.7L242.1 386.7L251.2 389.6L259.7 393.1L268.2 397.5L285.8 407.6L295.8 412.4L311.5 418.4L326 422.7L335.2 424.4L340.6 424.8L343.7 424.6L353.3 423.2L358.3 421.9L363.4 420L368.6 417.3L373.4 413.9L377.8 409.9L381.5 405.4L384.4 400.7L387.7 393.7L390.1 386.9L392.4 378.2L394.9 365.7L397.7 347.4L402.1 309L404.8 270.5L405.5 252.2L405.7 233.8L405.4 213.4L404.7 195.1L403.6 176.7L402.2 162.3L400.3 147.9L398 135.4L395 122.9L391.8 112.4L387.8 102.1L384 94L378.3 84.1L372.9 76.6L366.6 69.5L359.6 63.1L352.1 57.4L343.9 52.6L333.4 47.8L322.6 44.2L309.7 41.2L294.6 39.1L279.7 38.2L264.7 38.3L249.8 39.5L235 41.7L220.4 44.9L206 49.1L191.8 54.4L180 59.9L168.4 66.4L159.2 72.8L148.9 81.8L141.1 90.2L134.2 99.4L128.4 109.1L123.5 119.3L118.9 131.8L115.5 144.5L113 157.2L111.2 172L110.1 188.6L109.7 209.2L110.1 233.7L111.4 258.2L113.5 282.5L116.9 310.8L121.1 338.9L126.1 365.1L129 375.3L133 385.6L138 396.2L142.2 402.6L145.7 406.5L149.8 410L154.4 413L159.1 415.4L166.1 418.3L174.8 423.6L177.1 424.6L186 425.5L196.7 425.9L235 425.8L239 424.7L243 424.1L247 421.8L253 417.3L255 416.4L257 416Z"
          fill={`url(#${p}-pierre-s-vio)`}
          stroke="#06040C"
          strokeWidth="4.4"
          strokeLinejoin="round"
        />
        <path
          d="M245 412L198.9 411.9L183 411.2L175 410.1L169.2 408.6L163.7 406.3L158.6 403.2L154.2 399L150.7 394.2L147 387.1L144.3 379.6L141.5 370L138.9 358.3L133.3 326.7L129.5 299L126.7 273.2L124.9 249.2L123.9 225.2L123.7 201.2L124.5 181.2L126.3 163.3L129.1 147.6L132.9 134.1L137.2 122.9L142.7 112.2L145.9 107.1L150.6 100.7L158.6 91.8L167.7 84L179.3 76.2L191.8 69.7L206.6 63.7L221.9 59L239.5 55.1L255.3 53L271.3 52.1L289.3 52.7L305.2 54.6L318.8 57.7L330.2 61.6L340.9 66.9L349.2 72.6L353.7 76.5L358 80.7L361.9 85.3L365.4 90.1L371.6 100.4L376.5 111.4L381 124.6L383.9 136.3L386.1 148.1L387.8 159.9L389.4 175.9L390.6 193.8L391.4 211.8L391.7 231.8L391.5 249.8L390.9 267.8L389.8 287.8L388 309.7L385.9 329.6L383.3 349.4L380.8 365.2L378.3 377L375.5 386.6L373.1 392.1L370.1 397.3L366.1 401.8L363 404.3L359.6 406.4L354.1 408.6L348.2 410.1L342.3 411L336.3 411L330.4 410.2L322.5 408.6L314.8 406.6L297.6 401.1L283.1 394.5"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <clipPath id={`${p}-pierre-s-k0`}>
          <path d="M261.8 371.7L243.4 366.3L223.4 362.1L199.2 358.3L161 354L150.7 353.7L131.7 354.9L117.8 357.7L118.2 366.3L141.7 367.8L156.9 371L176.5 374L190.1 376.5L203.4 379.5L232 386.9L244.9 390.5L253.7 393.5Z" />
        </clipPath>
        <g clipPath={`url(#${p}-pierre-s-k0)`}>
          <path
            d="M158.7 383.8L156.4 375.7L148.1 330.4M136.9 394L130.5 379.4L127.1 369.2L124 355L120.4 334.9"
            fill="none"
            stroke="#06040C"
            strokeWidth="9.2"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        </g>
        <path
          d="M158.7 383.8L156.4 375.7L148.1 330.4L120.4 334.9L124 355L127.1 369.2L130.5 379.4L136.9 394Z"
          fill={`url(#${p}-pierre-s-vio)`}
        />
        <path
          d="M158.7 383.8L156.4 375.7L148.1 330.4M136.9 394L130.5 379.4L127.1 369.2L124 355L120.4 334.9"
          fill="none"
          stroke="#06040C"
          strokeWidth="4.4"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <path
          d="M147.8 388.9L144.3 379.6L141.1 368L137.7 352.4L134.2 332.7"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="2.6"
          strokeLinecap="butt"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <path
          d="M225.9 409C215.5 419.6 210.3 419.6 199.9 409C210.4 398.4 215.6 398.4 225.9 409Z"
          fill="#06040C"
        />
        <circle cx="215.9" cy="409" r="3.3" fill="#F2FDFF" />
        <path
          d="M237 418Q211 432 197 420"
          fill="none"
          stroke="#06040C"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M118 362C108.2 364.7 107 376.8 116.8 374.1"
          fill="none"
          stroke="#B9A3FF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M174.4 339.1L172.3 329.3L170.3 317.4L165.7 281.7L163.1 251.8L161.8 221.9L161.9 195.9L163.2 175.9L165.8 160.1L167.7 152.4L170.3 144.8L173.5 137.5L176.5 132.2L179.8 127.3L183.6 122.6L187.8 118.3L193.9 113.2L198.9 109.8L205.8 105.8L213 102.4L220.5 99.4L228.1 97L237.8 94.5L245.6 92.9L255.5 91.5L263.5 90.8L273.5 90.4L287.4 91.1L293.4 91.8L301.2 93.4L307 95.1L312.6 97.2L317.9 100L321.3 102.1L324.5 104.5L329 108.5L331.6 111.5L335.2 116.3L338.2 121.5L340.8 126.9L344.8 138.2L346.8 146L348.7 155.8L351.2 175.6L353 201.6L353.7 229.6L353.3 257.6L351.8 285.5L348.8 319.4L345.8 339.2"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="9"
          opacity="0.55"
          filter={`url(#${p}-pierre-s-blur2)`}
        />
        <path
          d="M174.4 339.1L172.3 329.3L170.3 317.4L165.7 281.7L163.1 251.8L161.8 221.9L161.9 195.9L163.2 175.9L165.8 160.1L167.7 152.4L170.3 144.8L173.5 137.5L176.5 132.2L179.8 127.3L183.6 122.6L187.8 118.3L193.9 113.2L198.9 109.8L205.8 105.8L213 102.4L220.5 99.4L228.1 97L237.8 94.5L245.6 92.9L255.5 91.5L263.5 90.8L273.5 90.4L287.4 91.1L293.4 91.8L301.2 93.4L307 95.1L312.6 97.2L317.9 100L321.3 102.1L324.5 104.5L329 108.5L331.6 111.5L335.2 116.3L338.2 121.5L340.8 126.9L344.8 138.2L346.8 146L348.7 155.8L351.2 175.6L353 201.6L353.7 229.6L353.3 257.6L351.8 285.5L348.8 319.4L345.8 339.2"
          fill="none"
          stroke="#06040C"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M174.4 339.1L172.3 329.3L170.3 317.4L165.7 281.7L163.1 251.8L161.8 221.9L161.9 195.9L163.2 175.9L165.8 160.1L167.7 152.4L170.3 144.8L173.5 137.5L176.5 132.2L179.8 127.3L183.6 122.6L187.8 118.3L193.9 113.2L198.9 109.8L205.8 105.8L213 102.4L220.5 99.4L228.1 97L237.8 94.5L245.6 92.9L255.5 91.5L263.5 90.8L273.5 90.4L287.4 91.1L293.4 91.8L301.2 93.4L307 95.1L312.6 97.2L317.9 100L321.3 102.1L324.5 104.5L329 108.5L331.6 111.5L335.2 116.3L338.2 121.5L340.8 126.9L344.8 138.2L346.8 146L348.7 155.8L351.2 175.6L353 201.6L353.7 229.6L353.3 257.6L351.8 285.5L348.8 319.4L345.8 339.2"
          fill="none"
          stroke="#C3B1FF"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <g clipPath={`url(#${p}-pierre-s-vc)`}>
          <path
            d="M424.1 382.5L418.4 383L416.1 382.8L412 376.2L397.5 373L392.2 371.4L386.8 368.6L381.3 367.1L377.4 363.2L371.8 358.7L365.3 357.5L360.8 355.1L357.3 348.7L351.4 345.9L346.5 342.4L345.5 343.6L350 347.9L354.8 350.9L357.5 357.8L363.2 362.1L368.9 364L376.9 373.6L383 376.4L387.9 380L394.1 382.9L400.5 385.3L404.3 385.8L406.7 392.1L415.5 396.8L423.9 397.5Z"
            fill="#030208"
          />
          <path
            d="M387.1 375.3L387 380.7L382.9 387.1L386.1 393.7L384.3 399.5L387.6 405.9L388.5 405.5L386.3 399.4L389.1 393.6L386.9 387.7L391.5 382.7L393.1 376.1Z"
            fill="#030208"
          />
          <path
            d="M424 390L417 389.9L411.4 387.4L408.2 381L401.8 379.8L395.8 377.9L390.1 375.7L384.9 372.5L379.1 370.4L374.9 365.6L370.4 361.4L364.2 359.8L359.2 356.4L356.1 349.8"
            fill="none"
            stroke="#8C6BFF"
            strokeWidth="9"
            strokeLinejoin="round"
            opacity="0.95"
            filter={`url(#${p}-pierre-s-blur2)`}
          />
          <path
            d="M424 390L417 389.9L411.4 387.4L408.2 381L401.8 379.8L395.8 377.9L390.1 375.7L384.9 372.5L379.1 370.4L374.9 365.6L370.4 361.4L364.2 359.8L359.2 356.4L356.1 349.8"
            fill="none"
            stroke="#C9B8FF"
            strokeWidth="3.4"
            strokeLinejoin="round"
          />
          <path
            d="M424 390L417 389.9L411.4 387.4L408.2 381L401.8 379.8L395.8 377.9L390.1 375.7L384.9 372.5L379.1 370.4L374.9 365.6L370.4 361.4L364.2 359.8"
            fill="none"
            stroke="#F2FDFF"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M390.1 375.7L389.3 381.7L384.9 387.4L387.6 393.6L385.3 399.5"
            fill="none"
            stroke="#C9B8FF"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <g id={`${p}-pierre-s-letter`}>
        <path
          d="M299.4 172.9A48.8 38.1 0 1 0 228 223.1C250.6 236.8 266 227 288.3 241.1A52.4 42.4 0 1 1 211.5 297"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="58"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
          opacity="0.85"
          filter={`url(#${p}-pierre-s-blur)`}
        />
        <path
          d="M299.4 172.9A48.8 38.1 0 1 0 228 223.1C250.6 236.8 266 227 288.3 241.1A52.4 42.4 0 1 1 211.5 297"
          fill="none"
          stroke="#2A1E5C"
          strokeWidth="42"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <g mask={`url(#${p}-pierre-s-lmask)`}>
          <path
            d="M299.4 172.9A48.8 38.1 0 1 0 228 223.1C250.6 236.8 266 227 288.3 241.1A52.4 42.4 0 1 1 211.5 297"
            fill="none"
            stroke={`url(#${p}-pierre-s-lvio)`}
            strokeWidth="42"
            strokeLinejoin="round"
            strokeMiterlimit="8"
            strokeLinecap="butt"
            transform="translate(5 5)"
          />
        </g>
        <path
          d="M299.4 172.9A48.8 38.1 0 1 0 228 223.1C250.6 236.8 266 227 288.3 241.1A52.4 42.4 0 1 1 211.5 297"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="15.1"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-E.svg */
function miniE(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="E-mini" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-e-body`}
          gradientUnits="userSpaceOnUse"
          x1="18.8"
          y1="57.4"
          x2="497.6"
          y2="456.6"
        >
          <stop offset="0" stopColor="#C3BDB3" />
          <stop offset="1" stopColor="#8F887E" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-e-frame`}>
        <path
          d="M20 286.7C15.8 251.8 22.8 211.3 36.8 180.6C50.7 149.9 72.1 122.4 103.8 102.4C135.4 82.4 184.3 67.5 226.7 60.5C269 53.5 357.9 60.5 357.9 60.5C357.9 60.5 438.9 96.8 438.9 96.8C438.9 96.8 483.6 160.6 492 197.3C500.4 234.1 499.4 282.5 489.2 317.4C479 352.4 459.9 384.5 430.6 406.8C401.2 429.2 357.5 444.5 313.3 451.5C269 458.5 207.1 459 165.2 448.7C123.3 438.5 86.1 417.1 61.9 390.1C37.7 363.1 24.2 321.6 20 286.7Z"
          fill={`url(#${p}-pierre-e-body)`}
          stroke="#47423B"
          strokeWidth="20"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-e-letter`}>
        <path
          d="M332.8 173H220.2V351H332.8M220.2 258.5H311.6"
          fill="none"
          stroke="#2F2B26"
          strokeWidth="58"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-D.svg */
function miniD(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="D-mini" {...svg}>
      <g id={`${p}-pierre-d-frame`}>
        <path d="M52.8 103.3L86.5 46.4L106.2 79.8L86.7 112.8Z" fill="#d0d4d9" />
        <path d="M86.5 46.4L422.9 36L407.9 70.5L106.2 79.8Z" fill="#cdd1d7" />
        <path d="M422.9 36L459.2 77.4L425.4 90.4L407.9 70.5Z" fill="#a6aab0" />
        <path d="M459.2 77.4L464.4 424.2L430.2 412.8L425.4 90.4Z" fill="#83888e" />
        <path d="M464.4 424.2L428.1 470.8L411.3 437.1L430.2 412.8Z" fill="#70757c" />
        <path d="M428.1 470.8L81.3 476L96.6 441.8L411.3 437.1Z" fill="#757980" />
        <path d="M81.3 476L47.6 437.2L81.8 424.7L96.6 441.8Z" fill="#989ca3" />
        <path d="M47.6 437.2L52.8 103.3L86.7 112.8L81.8 424.7Z" fill="#bdc2c7" />
        <path
          d="M86.7 112.8L106.2 79.8L407.9 70.5L425.4 90.4L430.2 412.8L411.3 437.1L96.6 441.8L81.8 424.7Z"
          fill="#A2A7AD"
        />
        <path
          d="M52.8 103.3L86.5 46.4L422.9 36L459.2 77.4L464.4 424.2L428.1 470.8L81.3 476L47.6 437.2Z"
          fill="none"
          stroke="#33373D"
          strokeWidth="20"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-d-letter`}>
        <path
          d="M201.2 164H235.9A78.9 94 0 0 1 235.9 352H201.2Z"
          fill="none"
          stroke="#22262B"
          strokeWidth="60"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-C.svg */
function miniC(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="C-mini" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-c-body`}
          gradientUnits="userSpaceOnUse"
          x1="60.1"
          y1="43.1"
          x2="451.2"
          y2="470.2"
        >
          <stop offset="0" stopColor="#A3AEBB" />
          <stop offset="1" stopColor="#6E7987" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-c-frame`}>
        <path
          d="M76.4 470.2C76.4 470.2 64.4 379.5 62 331.2C59.6 282.9 59.2 220.7 62 180.4C64.8 140 66 110.9 78.8 89.3C91.5 67.8 109.9 58.6 138.6 51C167.4 43.4 213.7 41.8 251.2 43.8C288.7 45.8 334.6 53 363.8 63C392.9 73 412.1 82.2 426 103.7C440 125.3 443.6 153.6 447.6 192.3C451.6 231.1 452 289.7 450 336C448 382.3 435.6 470.2 435.6 470.2C435.6 470.2 76.4 470.2 76.4 470.2Z"
          fill={`url(#${p}-pierre-c-body)`}
          stroke="#2A313A"
          strokeWidth="20"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-c-ornament`}>
        <path
          d="M123.3 417.1L120.6 414.2L118.3 410.9L115 403.7L113.3 397.9L112.1 392.1L110.1 378.2L107.5 348.3L105.7 318.4L104.6 284.4L104.2 248.4L104.6 220.4L105.6 192.5L107.2 168.5L109.1 150.6L111.8 136.9L114.8 127.4L119.2 118.4L123.9 112L128.2 107.7L131.3 105.2L136.2 101.9L139.7 99.9L149 96.1L160.5 92.9L176.3 90.1L194.2 88.4L214.2 87.6L236.1 87.8L258.1 88.9L282 91.2L303.7 94.5L323.3 98.4L340.7 103L353.9 107.8L364.7 113L369.8 116.1L374.7 119.6L381.9 126.5L387.9 134.5L392.5 143.4L395.9 152.7L398.9 164.4L401.5 180.1L403.7 200L405.4 221.9L406.6 251.9L407 285.9L406.3 319.9L404.7 349.8L402.6 375.7L400.1 393.5L398.7 399.4L396.9 405.1L394.3 410.5L392.1 413.8L389.4 416.8L386.3 419.2L382.8 421.2L377.2 423.3L367.4 425.2L351.4 426.1L157.4 426L145.5 425.2L137.6 423.9L130 421.4L124.9 418.4Z"
          fill="none"
          stroke="#3A434F"
          strokeWidth="16"
        />
      </g>
      <g id={`${p}-pierre-c-letter`}>
        <path
          d="M317 209.5A78.2 90 0 1 0 317 334.5"
          fill="none"
          stroke="#1E242C"
          strokeWidth="56"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-B.svg */
function miniB(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="B-mini" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-b-body`}
          gradientUnits="userSpaceOnUse"
          x1="78.5"
          y1="13.6"
          x2="433.3"
          y2="498"
        >
          <stop offset="0" stopColor="#646B77" />
          <stop offset="1" stopColor="#3A4049" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-b-frame`}>
        <path
          d="M116.6 498C116.6 498 98.4 436.7 92.1 397.6C85.7 358.6 79.4 305.1 78.7 263.8C77.9 222.5 79.4 181.7 87.6 150.1C95.8 118.5 108 94.3 127.8 74.2C147.5 54.1 176.1 39.6 205.8 29.6C235.6 19.6 276.4 11.8 306.2 14C335.9 16.2 364.9 26.3 384.2 43C403.6 59.7 414 79.8 422.2 114.4C430.3 148.9 433.7 203.2 433.3 250.4C432.9 297.6 425.9 356.4 419.9 397.6C414 438.9 397.6 498 397.6 498C397.6 498 116.6 498 116.6 498Z"
          fill={`url(#${p}-pierre-b-body)`}
          stroke="#2A2F36"
          strokeWidth="18"
          strokeLinejoin="round"
        />
        <path
          d="M116.6 498C116.6 498 98.4 436.7 92.1 397.6C85.7 358.6 79.4 305.1 78.7 263.8C77.9 222.5 79.4 181.7 87.6 150.1C95.8 118.5 108 94.3 127.8 74.2C147.5 54.1 176.1 39.6 205.8 29.6C235.6 19.6 276.4 11.8 306.2 14C335.9 16.2 364.9 26.3 384.2 43C403.6 59.7 414 79.8 422.2 114.4C430.3 148.9 433.7 203.2 433.3 250.4C432.9 297.6 425.9 356.4 419.9 397.6C414 438.9 397.6 498 397.6 498C397.6 498 116.6 498 116.6 498Z"
          fill="none"
          stroke="#9AA2AF"
          strokeWidth="7"
          strokeLinejoin="round"
          opacity="0.8"
        />
      </g>
      <g id={`${p}-pierre-b-ornament`}>
        <path
          d="M158.4 443.2L155.4 440.5L152.8 437.5L150.6 434.2L147.8 428.8L143.8 417.5L140.1 402L135.3 374.4L131 342.7L127.6 308.9L125.6 279L124.9 255L125.1 231L126.1 209.1L127.9 191.2L130.4 175.4L134.1 159.8L138.5 146.5L144.2 133.8L150.2 123.4L153.7 118.5L158.7 112.3L167.1 103.8L178.1 95.1L190 87.7L202.5 81.4L217.3 75.4L234.4 70L249.9 66.1L267.7 63L283.6 61.6L291.6 61.4L299.6 61.7L313.4 63.4L325.1 66.3L330.7 68.3L336.2 70.7L341.5 73.6L346.5 76.9L351.2 80.6L355.5 84.8L359.4 89.3L363 94.1L367.1 101L369.7 106.4L374.5 119.5L378.5 135L381.8 154.7L384.5 178.5L386.1 202.5L387 232.4L386.7 262.4L385.2 292.4L382.7 322.3L377.9 364L372.6 399.5L370.3 411.3L368.4 419.1L365.9 426.7L363.5 432.2L360.4 437.3L357.8 440.4L354.9 443.1L349.9 446.3L346.2 448L340.5 449.7L334.6 450.7L326.6 451.5L304.7 452L208.7 452L190.7 451.7L180.8 451L172.9 449.7L165.3 447.2L160 444.3Z"
          fill="none"
          stroke="#D9673C"
          strokeWidth="26"
        />
        <path
          d="M158.4 443.2L155.4 440.5L152.8 437.5L150.6 434.2L147.8 428.8L143.8 417.5L140.1 402L135.3 374.4L131 342.7L127.6 308.9L125.6 279L124.9 255L125.1 231L126.1 209.1L127.9 191.2L130.4 175.4L134.1 159.8L138.5 146.5L144.2 133.8L150.2 123.4L153.7 118.5L158.7 112.3L167.1 103.8L178.1 95.1L190 87.7L202.5 81.4L217.3 75.4L234.4 70L249.9 66.1L267.7 63L283.6 61.6L291.6 61.4L299.6 61.7L313.4 63.4L325.1 66.3L330.7 68.3L336.2 70.7L341.5 73.6L346.5 76.9L351.2 80.6L355.5 84.8L359.4 89.3L363 94.1L367.1 101L369.7 106.4L374.5 119.5L378.5 135L381.8 154.7L384.5 178.5L386.1 202.5L387 232.4L386.7 262.4L385.2 292.4L382.7 322.3L377.9 364L372.6 399.5L370.3 411.3L368.4 419.1L365.9 426.7L363.5 432.2L360.4 437.3L357.8 440.4L354.9 443.1L349.9 446.3L346.2 448L340.5 449.7L334.6 450.7L326.6 451.5L304.7 452L208.7 452L190.7 451.7L180.8 451L172.9 449.7L165.3 447.2L160 444.3Z"
          fill="none"
          stroke="#2A2F36"
          strokeWidth="6"
          strokeDasharray="18 22"
        />
      </g>
      <g id={`${p}-pierre-b-letter`}>
        <path
          d="M207.9 253.5V168H250.7A44.9 42.7 0 0 1 250.7 253.5ZM207.9 253.5H254.2A53.8 51.3 0 0 1 254.2 356H207.9Z"
          fill="none"
          stroke="#F08A57"
          strokeWidth="56"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-A.svg */
function miniA(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="A-mini" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-a-body`}
          gradientUnits="userSpaceOnUse"
          x1="78.4"
          y1="9.9"
          x2="431.9"
          y2="502"
        >
          <stop offset="0" stopColor="#33455F" />
          <stop offset="1" stopColor="#162133" />
        </linearGradient>
      </defs>
      <g id={`${p}-pierre-a-frame`}>
        <path
          d="M124.6 502C124.6 502 106.4 445.9 99.4 411.6C92.4 377.2 85.7 335.9 82.5 295.9C79.4 256 76.2 207.3 80.4 171.9C84.6 136.5 91.3 107.8 107.8 83.6C124.2 59.4 151.6 39.1 179.3 26.8C206.9 14.6 243.4 9.3 273.9 10C304.4 10.7 338.4 16.3 362.2 31C386 45.7 405.3 68.2 416.8 98.3C428.4 128.4 430.2 173.3 431.6 211.8C433 250.4 429.5 294.5 425.3 329.6C421.1 364.6 413 393.4 406.3 422.1C399.7 450.8 385.3 502 385.3 502C385.3 502 124.6 502 124.6 502Z"
          fill={`url(#${p}-pierre-a-body)`}
          stroke="#0E1624"
          strokeWidth="18"
          strokeLinejoin="round"
        />
        <path
          d="M124.6 502C124.6 502 106.4 445.9 99.4 411.6C92.4 377.2 85.7 335.9 82.5 295.9C79.4 256 76.2 207.3 80.4 171.9C84.6 136.5 91.3 107.8 107.8 83.6C124.2 59.4 151.6 39.1 179.3 26.8C206.9 14.6 243.4 9.3 273.9 10C304.4 10.7 338.4 16.3 362.2 31C386 45.7 405.3 68.2 416.8 98.3C428.4 128.4 430.2 173.3 431.6 211.8C433 250.4 429.5 294.5 425.3 329.6C421.1 364.6 413 393.4 406.3 422.1C399.7 450.8 385.3 502 385.3 502C385.3 502 124.6 502 124.6 502Z"
          fill="none"
          stroke="#5E8DB5"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-a-ornament`}>
        <path
          d="M163.7 449.2L160.6 446.6L156.8 442L154.6 438.7L151.9 433.3L147.8 422.1L143.8 406.6L137.8 377.2L132.7 345.6L128.7 313.8L125.8 281.9L124 254L123 228L123.1 206L124.1 186L126.2 168.1L129.5 150.4L133.3 137L138.5 124L142.1 116.8L145.2 111.7L152.3 102L157.7 96.1L161.9 91.9L171.2 84.2L182.8 76.4L195.2 69.9L208.2 64.7L221.6 60.7L229.4 58.9L239.3 57.2L255.2 55.6L273.2 55.2L289.1 56.2L304.9 58.7L318.4 62.4L329.6 66.9L334.9 69.6L341.7 73.9L346.5 77.5L352.5 82.8L356.6 87.1L361.6 93.3L366.1 100L369.1 105.2L372.5 112.4L375.4 119.8L377.9 127.5L379.8 135.2L383 152.9L385.4 174.8L386.9 202.8L387.4 232.8L386.6 262.8L384.4 294.7L381.1 324.5L376.3 354.1L369.2 387.4L361.5 418.5L358.5 428L355.5 435.4L352.6 440.7L349 445.4L344.5 449.5L341.2 451.7L337.6 453.4L331.9 455.3L326 456.5L318.1 457.4L296.1 458L214 458L196 457.7L186.1 457L178.2 455.7L170.6 453.2L165.3 450.4Z"
          fill="none"
          stroke="#5ED8FF"
          strokeWidth="26"
        />
      </g>
      <g id={`${p}-pierre-a-letter`}>
        <path
          d="M150.2 394L222.5 142L289.5 142L361.8 394L305.7 394L292.2 347.2L219.8 347.2L206.3 394ZM256 221.1L233.1 300.8L278.9 300.8Z"
          fill="#8FE6FF"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/** docs/brand/rangs/mini/rank-S.svg */
function miniS(p: string, svg: ArtSvgProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)
    <svg viewBox="0 0 512 512" data-variant="S-mini" {...svg}>
      <defs>
        <linearGradient
          id={`${p}-pierre-s-body`}
          gradientUnits="userSpaceOnUse"
          x1="78.9"
          y1="4.8"
          x2="432.6"
          y2="452"
        >
          <stop offset="0" stopColor="#30284F" />
          <stop offset="1" stopColor="#0D0A18" />
        </linearGradient>
        <filter
          id={`${p}-pierre-s-blur`}
          filterUnits="userSpaceOnUse"
          x="-64"
          y="-64"
          width="640"
          height="640"
        >
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id={`${p}-pierre-s-halo`} gradientUnits="userSpaceOnUse" cx="256" cy="250" r="256">
          <stop offset="0" stopColor="#8C6BFF" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#8C6BFF" stopOpacity="0.18" />
          <stop offset="1" stopColor="#8C6BFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g id={`${p}-pierre-s-glow`}>
        <circle cx="256" cy="250" r="256" fill={`url(#${p}-pierre-s-halo)`} />
      </g>
      <g id={`${p}-pierre-s-frame`}>
        <path
          d="M40 452H472V506H40Z"
          fill="#1C1730"
          stroke="#8C6BFF"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M118.1 452C118.1 452 100.2 394.6 93.8 358.7C87.4 322.9 81 275.6 79.6 237.1C78.3 198.6 77.9 158 85.7 127.6C93.5 97.2 106.3 73.6 126.3 54.7C146.2 35.7 176.9 22.2 205.3 14.1C233.7 6 268.2 3 296.5 6C324.9 9 355 15.8 375.6 32.4C396.2 48.9 410.7 73.2 420.2 105.3C429.7 137.4 431 187.1 432.4 224.9C433.7 262.8 429.5 309.1 428.3 332.4C427.1 355.7 425.3 364.8 425.3 364.8C425.3 364.8 411.1 383.1 411.1 383.1C411.1 383.1 420.2 398.3 420.2 398.3C420.2 398.3 404 452 404 452C404 452 118.1 452 118.1 452Z"
          fill={`url(#${p}-pierre-s-body)`}
          stroke="#08060F"
          strokeWidth="16"
          strokeLinejoin="round"
        />
        <path
          d="M118.1 452C118.1 452 100.2 394.6 93.8 358.7C87.4 322.9 81 275.6 79.6 237.1C78.3 198.6 77.9 158 85.7 127.6C93.5 97.2 106.3 73.6 126.3 54.7C146.2 35.7 176.9 22.2 205.3 14.1C233.7 6 268.2 3 296.5 6C324.9 9 355 15.8 375.6 32.4C396.2 48.9 410.7 73.2 420.2 105.3C429.7 137.4 431 187.1 432.4 224.9C433.7 262.8 429.5 309.1 428.3 332.4C427.1 355.7 425.3 364.8 425.3 364.8C425.3 364.8 411.1 383.1 411.1 383.1C411.1 383.1 420.2 398.3 420.2 398.3C420.2 398.3 404 452 404 452C404 452 118.1 452 118.1 452Z"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="8"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-s-ornament`}>
        <path
          d="M156.3 401.2L153.3 398.5L150.7 395.6L148.4 392.3L145.5 387L141.4 375.8L137.5 360.3L132.6 334.8L128.2 305.1L124.8 275.3L122.6 247.5L121.5 223.5L121.3 199.5L121.9 181.5L123.4 163.6L125.9 147.8L129.2 134.3L133.9 121.1L139.2 110.3L145.6 100.2L153.3 91L162 82.8L168.3 77.9L173.3 74.5L185.5 67.7L198.2 62L213.3 56.8L228.8 52.8L244.6 50L260.5 48.5L278.4 48.2L294.4 49.3L310.1 51.9L323.6 55.7L334.6 60.4L339.9 63.3L344.9 66.5L349.6 70.2L354 74.3L358.1 78.7L361.9 83.3L368.3 93.4L374.3 106.1L378.9 119.3L382.7 134.8L385.7 152.5L388 174.4L389.6 204.3L390.1 236.3L389.3 266.2L387.3 296.1L383.7 331.9L379.4 361.6L377.5 371.4L375.6 379.2L373 386.7L370.4 392.1L367.1 397.1L364.3 400L361.2 402.5L355.9 405.4L352.2 406.7L346.4 408.2L340.5 409L332.5 409.6L308.5 410L206.6 410L188.6 409.7L178.7 409L170.8 407.7L163.2 405.2L157.9 402.4Z"
          fill="none"
          stroke="#9C82FF"
          strokeWidth="24"
        />
        <path
          d="M424.3 389.2L417.1 389.1L411.5 386.5L408.2 380L401.8 378.8L395.7 376.9L389.9 374.7L384.7 371.4L378.8 369.2L374.5 364.5L369.9 360.1L363.7 358.5L358.5 355.1L355.4 348.4L350 345.5L345.2 341.5"
          fill="none"
          stroke="#08060F"
          strokeWidth="22"
          strokeLinejoin="round"
        />
        <path
          d="M424.3 389.2L417.1 389.1L411.5 386.5L408.2 380L401.8 378.8L395.7 376.9L389.9 374.7L384.7 371.4L378.8 369.2L374.5 364.5L369.9 360.1L363.7 358.5L358.5 355.1L355.4 348.4L350 345.5L345.2 341.5"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="8"
          strokeLinejoin="round"
        />
      </g>
      <g id={`${p}-pierre-s-letter`}>
        <path
          d="M307.2 160.4A57.4 45.6 0 1 0 223.2 220.5C249.6 236.9 267.8 225.3 294 242.1A61.7 50.8 0 1 1 203.7 309.1"
          fill="none"
          stroke="#8C6BFF"
          strokeWidth="82"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
          opacity="0.9"
          filter={`url(#${p}-pierre-s-blur)`}
        />
        <path
          d="M307.2 160.4A57.4 45.6 0 1 0 223.2 220.5C249.6 236.9 267.8 225.3 294 242.1A61.7 50.8 0 1 1 203.7 309.1"
          fill="none"
          stroke="#B9A3FF"
          strokeWidth="58"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
        <path
          d="M307.2 160.4A57.4 45.6 0 1 0 223.2 220.5C249.6 236.9 267.8 225.3 294 242.1A61.7 50.8 0 1 1 203.7 309.1"
          fill="none"
          stroke="#F2FDFF"
          strokeWidth="24.4"
          strokeLinejoin="round"
          strokeMiterlimit="8"
          strokeLinecap="butt"
        />
      </g>
    </svg>
  );
}

const FULL: Record<Rank, (p: string, svg: ArtSvgProps) => JSX.Element> = {
  E: rankE,
  D: rankD,
  C: rankC,
  B: rankB,
  A: rankA,
  S: rankS,
};

const MINI: Record<Rank, (p: string, svg: ArtSvgProps) => JSX.Element> = {
  E: miniE,
  D: miniD,
  C: miniC,
  B: miniB,
  A: miniA,
  S: miniS,
};

/** Pierre du rang, en grand ou en mini ; ids préfixés par idPrefix. */
export function RankStone({ rank, mini = false, idPrefix, ...svg }: RankStoneProps) {
  return (mini ? MINI : FULL)[rank](idPrefix, svg);
}

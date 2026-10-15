import { EXPERIENCES, type Experience, type Goal, type PlaceKind } from '@rune/contracts';
import type { ReactNode } from 'react';

/*
 * Icônes des cartes de choix de l'onboarding, tracées d'après les maquettes B01 (objectif), B03 (type de lieu) et
 * B05 (niveau). Décoratives : la carte qui les porte les cache aux lecteurs d'écran ; elles prennent la couleur
 * de la tuile (texte secondaire, accent une fois la carte choisie).
 */

function Icon(p: { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={p.strokeWidth ?? 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p.children}
    </svg>
  );
}

const DUMBBELL = <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />;

export const GOAL_ICONS: Readonly<Record<Goal, ReactNode>> = {
  muscle: <Icon>{DUMBBELL}</Icon>,
  strength: (
    <Icon>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </Icon>
  ),
  fat_loss: (
    <Icon>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Icon>
  ),
  fitness: (
    <Icon>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </Icon>
  ),
  sport_support: (
    <Icon>
      <path d="M10 2h4" />
      <path d="m12 14 3-3" />
      <circle cx="12" cy="14" r="8" />
    </Icon>
  ),
};

export const PLACE_KIND_ICONS: Readonly<Record<PlaceKind, ReactNode>> = {
  gym: <Icon>{DUMBBELL}</Icon>,
  home: (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  ),
};

/** Quatre barres de hauteur croissante : autant de pleines que le niveau (une pour « Jamais »). */
const BARS = ['M5 20v-3', 'M10 20v-7', 'M15 20v-11', 'M20 20v-15'];

function LevelIcon(p: { level: number }) {
  return (
    <Icon strokeWidth={2.6}>
      {BARS.map((d, i) => (
        <path key={d} d={d} opacity={i < p.level ? 1 : 0.3} />
      ))}
    </Icon>
  );
}

export const EXPERIENCE_ICONS: Readonly<Record<Experience, ReactNode>> = Object.fromEntries(
  EXPERIENCES.map((e, i) => [e, <LevelIcon key={e} level={i + 1} />]),
) as Record<Experience, ReactNode>;

/** Petit i cerclé des notes (maquettes B03 et B07). */
export function InfoGlyph() {
  return (
    <Icon strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

/** Bouclier de la carte « Accord santé » (maquette B07). */
export function ShieldGlyph() {
  return (
    <Icon>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  );
}

/** Cadenas des limitations, en attente de l'accord (maquette B07). */
export function LockGlyph() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

/** Calendrier de la carte « Ton rythme » (maquette B06). */
export function CalendarGlyph() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  );
}

import { z } from 'zod';

export const SPORTS = [
  { code: 'running', label: 'Course à pied' },
  { code: 'cycling', label: 'Vélo' },
  { code: 'swimming', label: 'Natation' },
  { code: 'football', label: 'Football' },
  { code: 'rugby', label: 'Rugby' },
  { code: 'basketball', label: 'Basket' },
  { code: 'handball', label: 'Handball' },
  { code: 'tennis', label: 'Tennis' },
  { code: 'padel', label: 'Padel' },
  { code: 'badminton', label: 'Badminton' },
  { code: 'combat_sports', label: 'Sports de combat' },
  { code: 'climbing', label: 'Escalade' },
  { code: 'skiing', label: 'Ski' },
  { code: 'dance', label: 'Danse' },
  { code: 'other', label: 'Autre' },
] as const;

export const SPORT_CODES = SPORTS.map((s) => s.code) as unknown as readonly [
  (typeof SPORTS)[number]['code'],
  ...(typeof SPORTS)[number]['code'][],
];

export type SportCode = (typeof SPORTS)[number]['code'];
export const SportCodeSchema = z.enum(SPORT_CODES);

export const SPORTS_LIST_VERSION = 1;
export const SPORT_OTHER_LABEL_MAX = 40;

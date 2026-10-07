import { z } from 'zod';
import { EQUIPMENT, EQUIPMENT_CATEGORIES, type EquipmentCode, REFERENCE_PROFILES } from './taxonomy';

export const PRESET_IDS = [
  'gym_large',
  'gym_small',
  'gym_crossfit',
  'gym_other',
  'home_none',
  'home_small',
  'home_gym',
] as const;

export type PresetId = (typeof PRESET_IDS)[number];
export const PresetIdSchema = z.enum(PRESET_IDS);

export const HOME_DEFAULT_PRESET = 'home_none' satisfies PresetId;

export interface Preset {
  readonly kind: 'gym' | 'home';
  readonly label: string;
  readonly equipment: readonly EquipmentCode[];
}

const HOUSEHOLD: readonly EquipmentCode[] = EQUIPMENT_CATEGORIES.household;

export const PRESETS: Record<PresetId, Preset> = {
  gym_large: {
    kind: 'gym',
    label: 'Grande salle ou chaîne',
    equipment: EQUIPMENT.filter((c) => !HOUSEHOLD.includes(c)),
  },
  gym_small: {
    kind: 'gym',
    label: 'Petite salle de quartier',
    equipment: [
      'dumbbells',
      'barbell',
      'ez_bar',
      'flat_bench',
      'adjustable_bench',
      'squat_rack',
      'cable_station',
      'lat_pulldown',
      'seated_row',
      'leg_press',
      'pull_up_bar',
      'dip_station',
    ],
  },
  gym_crossfit: {
    kind: 'gym',
    label: 'Box de cross-training',
    equipment: [
      'barbell',
      'squat_rack',
      'dumbbells',
      'kettlebell',
      'flat_bench',
      'pull_up_bar',
      'suspension_trainer',
      'box',
      'resistance_band',
    ],
  },
  gym_other: { kind: 'gym', label: 'Autre', equipment: [] },
  home_none: { kind: 'home', label: 'Sans matériel', equipment: REFERENCE_PROFILES.home_bodyweight },
  home_small: { kind: 'home', label: 'Petit matériel', equipment: REFERENCE_PROFILES.home_small_equipment },
  home_gym: {
    kind: 'home',
    label: 'Home gym',
    equipment: [
      'chair',
      'table',
      'pull_up_bar',
      'resistance_band',
      'dumbbells',
      'kettlebell',
      'barbell',
      'squat_rack',
      'flat_bench',
    ],
  },
};

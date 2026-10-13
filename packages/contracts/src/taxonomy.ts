import { z } from 'zod';

export const EQUIPMENT_CATEGORIES = {
  household: ['chair', 'table'],
  small_equipment: ['resistance_band', 'dumbbells', 'kettlebell', 'pull_up_bar', 'suspension_trainer', 'box'],
  benches_racks: ['flat_bench', 'adjustable_bench', 'squat_rack', 'dip_station', 'back_extension_bench'],
  free_weights: ['barbell', 'ez_bar'],
  machines: [
    'cable_station',
    'lat_pulldown',
    'seated_row',
    'leg_press',
    'smith_machine',
    'leg_extension',
    'leg_curl',
    'upper_body_machines',
  ],
} as const;

export type EquipmentCategory = keyof typeof EQUIPMENT_CATEGORIES;

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  household: 'Objets du quotidien',
  small_equipment: 'Petit matériel',
  benches_racks: 'Bancs et supports',
  free_weights: 'Charges libres',
  machines: 'Poulies et machines',
};

export const EQUIPMENT = [
  'chair',
  'table',
  'resistance_band',
  'dumbbells',
  'kettlebell',
  'pull_up_bar',
  'suspension_trainer',
  'box',
  'flat_bench',
  'adjustable_bench',
  'squat_rack',
  'dip_station',
  'back_extension_bench',
  'barbell',
  'ez_bar',
  'cable_station',
  'lat_pulldown',
  'seated_row',
  'leg_press',
  'smith_machine',
  'leg_extension',
  'leg_curl',
  'upper_body_machines',
] as const;

export type EquipmentCode = (typeof EQUIPMENT)[number];
export const EquipmentCodeSchema = z.enum(EQUIPMENT);

export const EQUIPMENT_LABELS: Record<EquipmentCode, string> = {
  chair: 'Chaise ou banc stable',
  table: 'Table solide (rowing sous la table)',
  resistance_band: 'Élastiques (bandes, avec poignées ou mini-bandes)',
  dumbbells: 'Haltères fixes ou réglables',
  kettlebell: 'Kettlebell',
  pull_up_bar: 'Barre de traction',
  suspension_trainer: 'Sangles de suspension ou anneaux',
  box: 'Box ou step stable',
  flat_bench: 'Banc plat',
  adjustable_bench: 'Banc inclinable',
  squat_rack: 'Cage ou supports à squat avec sécurités',
  dip_station: 'Barres parallèles',
  back_extension_bench: 'Banc à lombaires (45° ou GHD)',
  barbell: 'Barre droite et disques',
  ez_bar: 'Barre EZ',
  cable_station: 'Poulie réglable ou vis-à-vis',
  lat_pulldown: 'Tirage vertical',
  seated_row: 'Tirage horizontal assis',
  leg_press: 'Presse à cuisses',
  smith_machine: 'Barre guidée (Smith)',
  leg_extension: 'Leg extension',
  leg_curl: 'Leg curl',
  upper_body_machines: 'Machines guidées du haut du corps (développé, pec deck, épaules)',
};

export const EQUIPMENT_IMPLIES: Partial<Record<EquipmentCode, readonly EquipmentCode[]>> = {
  adjustable_bench: ['flat_bench'],
};

export const REFERENCE_PROFILES = {
  home_bodyweight: ['chair', 'table'],
  home_small_equipment: ['chair', 'table', 'pull_up_bar', 'resistance_band', 'dumbbells'],
  gym_reference: [
    'dumbbells',
    'barbell',
    'squat_rack',
    'flat_bench',
    'adjustable_bench',
    'dip_station',
    'pull_up_bar',
    'cable_station',
    'lat_pulldown',
    'seated_row',
    'leg_press',
    'leg_extension',
    'leg_curl',
    'upper_body_machines',
  ],
} as const satisfies Record<string, readonly EquipmentCode[]>;

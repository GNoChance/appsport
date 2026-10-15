import type { EquipmentCode } from './taxonomy';

/**
 * Libellés courts du matériel, pour les pastilles et l'historique (spec refonte §10.3) : le libellé de
 * `EQUIPMENT_LABELS` jusqu'à la parenthèse. Exception écrite à la main : « Barre guidée (Smith) » reste entier,
 * la parenthèse dit ce qu'est la machine. Un `Record` sur tous les codes : un code ajouté sans libellé court ne
 * compile pas.
 */
export const EQUIPMENT_SHORT_LABELS: Record<EquipmentCode, string> = {
  chair: 'Chaise ou banc stable',
  table: 'Table solide',
  resistance_band: 'Élastiques',
  dumbbells: 'Haltères fixes ou réglables',
  kettlebell: 'Kettlebell',
  pull_up_bar: 'Barre de traction',
  suspension_trainer: 'Sangles de suspension ou anneaux',
  box: 'Box ou step stable',
  flat_bench: 'Banc plat',
  adjustable_bench: 'Banc inclinable',
  squat_rack: 'Cage ou supports à squat avec sécurités',
  dip_station: 'Barres parallèles',
  back_extension_bench: 'Banc à lombaires',
  barbell: 'Barre droite et disques',
  ez_bar: 'Barre EZ',
  cable_station: 'Poulie réglable ou vis-à-vis',
  lat_pulldown: 'Tirage vertical',
  seated_row: 'Tirage horizontal assis',
  leg_press: 'Presse à cuisses',
  smith_machine: 'Barre guidée (Smith)',
  leg_extension: 'Leg extension',
  leg_curl: 'Leg curl',
  upper_body_machines: 'Machines guidées du haut du corps',
};

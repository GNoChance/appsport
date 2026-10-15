import { describe, expect, it } from 'vitest';
import { EQUIPMENT_SHORT_LABELS } from '../src/equipment-short-labels';
import { EQUIPMENT, EQUIPMENT_LABELS, type EquipmentCode } from '../src/taxonomy';

/** Exceptions écrites à la main : libellé gardé entier (la parenthèse dit ce qu'est la machine). */
const KEPT_WHOLE: readonly EquipmentCode[] = ['smith_machine'];

describe('EQUIPMENT_SHORT_LABELS (spec refonte §10.3, pastilles d’équipement)', () => {
  it('un libellé court pour chaque code de la taxonomie, et rien d’autre', () => {
    expect(Object.keys(EQUIPMENT_SHORT_LABELS).sort()).toEqual([...EQUIPMENT].sort());
  });

  it('libellé jusqu’à la parenthèse ; « Barre guidée (Smith) » gardé entier', () => {
    for (const code of EQUIPMENT) {
      const full = EQUIPMENT_LABELS[code];
      const expected = KEPT_WHOLE.includes(code) ? full : (full.split(' (')[0] ?? full).trim();
      expect(EQUIPMENT_SHORT_LABELS[code], code).toBe(expected);
    }
    expect(EQUIPMENT_SHORT_LABELS.smith_machine).toBe('Barre guidée (Smith)');
    expect(EQUIPMENT_SHORT_LABELS.resistance_band).toBe('Élastiques');
    expect(EQUIPMENT_SHORT_LABELS.table).toBe('Table solide');
    expect(EQUIPMENT_SHORT_LABELS.upper_body_machines).toBe('Machines guidées du haut du corps');
  });

  it('exporté par le paquet', async () => {
    const contracts = await import('../src/index');
    expect(contracts.EQUIPMENT_SHORT_LABELS).toBe(EQUIPMENT_SHORT_LABELS);
  });
});

import { describe, expect, it } from 'vitest';
import { defaultLoadSettings, LoadSettingsSchema } from '../src/load-settings';

const ok = { barG: 20000, smallestPlateG: 1250, dumbbellsG: [2000, 4000], machineStepG: 5000 };

describe('load-settings', () => {
  it('fournit les défauts salle et domicile', () => {
    expect(defaultLoadSettings('gym')).toEqual({
      barG: 20000,
      smallestPlateG: 1250,
      dumbbellsG: Array.from({ length: 20 }, (_, i) => 2000 * (i + 1)),
      machineStepG: 5000,
    });
    expect(defaultLoadSettings('home')).toEqual({
      barG: 20000,
      smallestPlateG: 1250,
      dumbbellsG: [],
      machineStepG: 5000,
    });
  });

  it('renvoie une copie neuve à chaque appel', () => {
    const a = defaultLoadSettings('gym');
    a.dumbbellsG.push(1);
    expect(defaultLoadSettings('gym').dumbbellsG).toHaveLength(20);
    const h = defaultLoadSettings('home');
    h.dumbbellsG.push(1);
    expect(defaultLoadSettings('home').dumbbellsG).toEqual([]);
  });

  it('valide les défauts', () => {
    expect(LoadSettingsSchema.safeParse(defaultLoadSettings('gym')).success).toBe(true);
    expect(LoadSettingsSchema.safeParse(defaultLoadSettings('home')).success).toBe(true);
  });

  it.each([
    ['barG 4999', { ...ok, barG: 4999 }],
    ['barG 25001', { ...ok, barG: 25001 }],
    ['barG décimal', { ...ok, barG: 20000.5 }],
    ['smallestPlateG 249', { ...ok, smallestPlateG: 249 }],
    ['smallestPlateG 5001', { ...ok, smallestPlateG: 5001 }],
    ['machineStepG 499', { ...ok, machineStepG: 499 }],
    ['machineStepG 10001', { ...ok, machineStepG: 10001 }],
    ['haltères décroissants', { ...ok, dumbbellsG: [4000, 2000] }],
    ['haltères dupliqués', { ...ok, dumbbellsG: [2000, 2000] }],
    ['61 haltères', { ...ok, dumbbellsG: Array.from({ length: 61 }, (_, i) => 500 + 100 * i) }],
    ['haltère 400', { ...ok, dumbbellsG: [400] }],
    ['haltère 80500', { ...ok, dumbbellsG: [80500] }],
    ['clé inconnue', { barKg: 20, smallestPlateG: 1250, dumbbellsG: [], machineStepG: 5000 }],
    ['clé en trop', { ...ok, extra: 1 }],
    ['champ manquant', { barG: 20000, smallestPlateG: 1250, dumbbellsG: [] }],
  ])('refuse %s', (_name, value) => {
    expect(LoadSettingsSchema.safeParse(value).success).toBe(false);
  });

  it('accepte les bornes', () => {
    const sixty = Array.from({ length: 60 }, (_, i) => 500 + i * 500);
    expect(sixty[59]).toBe(30000);
    expect(LoadSettingsSchema.safeParse({ ...ok, dumbbellsG: sixty }).success).toBe(true);
    for (const v of [
      { barG: 5000 },
      { barG: 25000 },
      { smallestPlateG: 250 },
      { smallestPlateG: 5000 },
      { machineStepG: 500 },
      { machineStepG: 10000 },
      { dumbbellsG: [80000] },
    ]) {
      expect(LoadSettingsSchema.safeParse({ ...ok, ...v }).success).toBe(true);
    }
  });
});

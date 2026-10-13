import { z } from 'zod';

export const LoadSettingsSchema = z.strictObject({
  barG: z.number().int().min(5000).max(25000),
  smallestPlateG: z.number().int().min(250).max(5000),
  dumbbellsG: z
    .array(z.number().int().min(500).max(80000))
    .max(60)
    .refine((a) => a.every((v, i) => i === 0 || v > (a[i - 1] as number)), {
      message: 'dumbbellsG doit être strictement croissant',
    }),
  machineStepG: z.number().int().min(500).max(10000),
});

export type LoadSettings = z.infer<typeof LoadSettingsSchema>;

export function defaultLoadSettings(kind: 'gym' | 'home'): LoadSettings {
  return {
    barG: 20000,
    smallestPlateG: 1250,
    dumbbellsG: kind === 'gym' ? Array.from({ length: 20 }, (_, i) => 2000 * (i + 1)) : [],
    machineStepG: 5000,
  };
}

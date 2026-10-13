import { z } from 'zod';

/** Format de /data/ops/status.json, écrit par les scripts hôte. */
export const OpsCheck = z.object({ at: z.string(), ok: z.boolean(), detail: z.string().optional() });
export type OpsCheck = z.infer<typeof OpsCheck>;

export const OpsStatus = z.object({
  backup: OpsCheck.optional(),
  restoreTest: OpsCheck.optional(),
  host: OpsCheck.extend({
    disks: z.array(z.object({ mount: z.string(), usedPct: z.number() })),
    smartOk: z.boolean(),
    rebootRequired: z.boolean(),
  }).optional(),
  deploy: z
    .object({ at: z.string(), version: z.string(), previousVersion: z.string().nullable(), ok: z.boolean() })
    .optional(),
});
export type OpsStatus = z.infer<typeof OpsStatus>;

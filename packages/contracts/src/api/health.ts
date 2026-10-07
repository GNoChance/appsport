import { z } from 'zod';

export const HealthResponse = z.object({
  status: z.enum(['ok', 'error']),
  version: z.string(),
  db: z.enum(['ok', 'error']),
  protocol: z.number().int(),
  minProtocol: z.number().int(),
  epoch: z.string().nullable(),
  swKill: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

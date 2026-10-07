import { z } from 'zod';

export const EXPORT_FORMAT = 'appsport-export/1';

const Row = z.record(z.string(), z.unknown());

/** `tables` est indexé par le nom SQL ; lignes en camelCase, valeurs telles que stockées (0/1, JSON en texte). */
export const ExportV1 = z.object({
  format: z.literal(EXPORT_FORMAT),
  exportedAt: z.string(),
  account: Row,
  tables: z.record(z.string(), z.array(Row)),
  gyms: z.array(Row),
  gymHistory: z.array(Row),
});
export type ExportV1 = z.infer<typeof ExportV1>;

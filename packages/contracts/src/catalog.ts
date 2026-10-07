import { z } from 'zod';

/** Nom d'un fichier d'illustration : `<id>.<empreinte 8 hex>.<ext>`, sans chemin. */
export const ILLUSTRATION_FILE_RE = /^([a-z0-9][a-z0-9-]*)\.([0-9a-f]{8})\.(svg|png|webp|jpg)$/;

export const IllustrationRef = z.object({
  id: z.string().min(1),
  file: z.string().regex(ILLUSTRATION_FILE_RE),
});
export type IllustrationRef = z.infer<typeof IllustrationRef>;

export const CatalogBundle = z.object({
  version: z.string(),
  exercises: z.array(z.unknown()),
  illustrations: z.array(IllustrationRef),
  programTemplates: z.array(z.unknown()),
  adviceSheets: z.array(z.unknown()),
});
export type CatalogBundle = z.infer<typeof CatalogBundle>;

import { z } from 'zod';

export const BODY_AREAS = [
  'shoulder',
  'elbow',
  'wrist_hand',
  'neck',
  'upper_back',
  'lower_back',
  'hip',
  'knee',
  'ankle_foot',
  'other',
] as const;
export const BodyArea = z.enum(BODY_AREAS);
export type BodyArea = z.infer<typeof BodyArea>;

export const LIMITATION_SIDES = ['left', 'right', 'both', 'not_applicable'] as const;
export const LimitationSide = z.enum(LIMITATION_SIDES);
export type LimitationSide = z.infer<typeof LimitationSide>;

export const LIMITATION_SEVERITIES = ['mild', 'severe'] as const;
export const LimitationSeverity = z.enum(LIMITATION_SEVERITIES);
export type LimitationSeverity = z.infer<typeof LimitationSeverity>;

export const BODY_AREA_LABELS: Record<BodyArea, string> = {
  shoulder: 'Épaule',
  elbow: 'Coude',
  wrist_hand: 'Poignet ou main',
  neck: 'Cou',
  upper_back: 'Haut du dos',
  lower_back: 'Bas du dos',
  hip: 'Hanche',
  knee: 'Genou',
  ankle_foot: 'Cheville ou pied',
  other: 'Autre',
};

export const LIMITATION_SIDE_LABELS: Record<LimitationSide, string> = {
  left: 'Gauche',
  right: 'Droite',
  both: 'Les deux',
  not_applicable: 'Sans objet',
};

export const LIMITATION_SEVERITY_LABELS: Record<LimitationSeverity, string> = {
  mild: 'Légère',
  severe: "Forte : m'empêche certains mouvements",
};

export const LIMITATION_NOTE_MAX = 200;

export const GrantConsentRequest = z.strictObject({ type: z.literal('health'), textVersion: z.string() });
export type GrantConsentRequest = z.infer<typeof GrantConsentRequest>;

export const WithdrawConsentRequest = z.strictObject({
  type: z.literal('health'),
  password: z.string().min(1).max(1024),
});
export type WithdrawConsentRequest = z.infer<typeof WithdrawConsentRequest>;

/** Renvoi d'un retrait fait avant une restauration (R-SYN-28), sans mot de passe. */
export const ReplayWithdrawRequest = z.strictObject({ withdrawnAt: z.iso.datetime() });
export type ReplayWithdrawRequest = z.infer<typeof ReplayWithdrawRequest>;

export const HealthScreeningRequest = z.strictObject({
  answers: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
  questionnaireVersion: z.string(),
});
export type HealthScreeningRequest = z.infer<typeof HealthScreeningRequest>;

export const HealthScreeningResponse = z.object({ caution: z.boolean() });
export type HealthScreeningResponse = z.infer<typeof HealthScreeningResponse>;

export const LimitationInput = z.strictObject({
  bodyArea: BodyArea,
  side: LimitationSide,
  severity: LimitationSeverity,
  note: z.string().trim().max(LIMITATION_NOTE_MAX).nullable().optional(),
  active: z.boolean().optional(),
});
export type LimitationInput = z.infer<typeof LimitationInput>;

export const LimitationPatch = LimitationInput.partial().refine((v) => Object.keys(v).length > 0);
export type LimitationPatch = z.infer<typeof LimitationPatch>;

export const CreateLimitationResponse = z.object({ id: z.string() });
export type CreateLimitationResponse = z.infer<typeof CreateLimitationResponse>;

import { z } from 'zod';

export const CivilDate = z.iso.date();
export type CivilDate = z.infer<typeof CivilDate>;

export const RoleSchema = z.enum(['admin', 'member']);
export const UserStatusSchema = z.enum(['active', 'disabled']);
export const AgeBandSchema = z.enum(['minor', 'adult']);

export const ONBOARDING_STEPS = [
  'goal',
  'sport',
  'place_kind',
  'place',
  'experience',
  'availability',
  'health',
  'ready',
] as const;
export const OnboardingStep = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const ConsentStatus = z.object({
  active: z.boolean(),
  textVersion: z.string().nullable(),
  at: z.string().nullable(),
});
export type ConsentStatus = z.infer<typeof ConsentStatus>;

/** Clés JSON en camelCase ; la valeur SQL et ConsentType restent 'ai_coach'. */
export const ConsentState = z.object({ health: ConsentStatus, aiCoach: ConsentStatus });
export type ConsentState = z.infer<typeof ConsentState>;

export const MeResponse = z.object({
  id: z.string(),
  username: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  birthDate: CivilDate,
  ageBand: AgeBandSchema,
  cautious: z.boolean(),
  mustChangePassword: z.boolean(),
  passwordReminderDue: z.boolean(),
  onboardingStep: OnboardingStep.nullable(),
  onboardingCompletedAt: z.string().nullable(),
  termsVersion: z.string().nullable(),
  consents: ConsentState,
});
export type MeResponse = z.infer<typeof MeResponse>;

export const LoginRequest = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

/** Strict : birthDate ou tout autre champ → 400 validation (P-MIN-2). */
export const UpdateMeRequest = z.strictObject({ username: z.string().min(1).max(100) });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

export const CodeRequest = z.object({ code: z.string().min(1).max(300) });
export type CodeRequest = z.infer<typeof CodeRequest>;

/** `role` : rôle visé, qui fixe le minimum de mot de passe côté client (14 caractères pour l'amorçage). */
export const InvitationCheckResponse = z.object({ birthDate: CivilDate, role: RoleSchema });
export type InvitationCheckResponse = z.infer<typeof InvitationCheckResponse>;

export const AcceptInvitationRequest = z.object({
  code: z.string().min(1).max(300),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(1024),
  termsVersion: z.string(),
});
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequest>;

/** `role` : rôle de la cible, qui fixe le minimum de mot de passe côté client (14 caractères pour un admin). */
export const ResetCheckResponse = z.object({ username: z.string(), role: RoleSchema });
export type ResetCheckResponse = z.infer<typeof ResetCheckResponse>;

export const ResetPasswordRequest = z.object({
  code: z.string().min(1).max(300),
  newPassword: z.string().min(1).max(1024),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

export const DeleteAccountRequest = z.object({ password: z.string().min(1).max(1024) });
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequest>;

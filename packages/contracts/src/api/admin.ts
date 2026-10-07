import { z } from 'zod';
import { INVITATION_NOTE_MAX } from '../auth-constants';
import { OpsStatus } from '../ops';
import { CivilDate, RoleSchema, UserStatusSchema } from './auth';

export const InvitationState = z.enum(['pending', 'used', 'revoked', 'expired']);
export type InvitationState = z.infer<typeof InvitationState>;

export const InvitationSummary = z.object({
  id: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  state: InvitationState,
  usedByUsername: z.string().nullable(),
});
export type InvitationSummary = z.infer<typeof InvitationSummary>;

export const CreateInvitationRequest = z.object({
  birthDate: CivilDate,
  note: z.string().max(INVITATION_NOTE_MAX).optional(),
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequest>;

export const CreateInvitationResponse = z.object({
  invitation: InvitationSummary,
  code: z.string(),
  link: z.string(),
});
export type CreateInvitationResponse = z.infer<typeof CreateInvitationResponse>;

export const MemberSummary = z
  .object({
    id: z.string(),
    username: z.string(),
    role: RoleSchema,
    status: UserStatusSchema,
    isMinor: z.boolean(),
    lastLoginAt: z.string().nullable(),
    onboardingCompleted: z.boolean(),
    consents: z.object({ health: z.boolean(), aiCoach: z.boolean() }),
    activeSessions: z.number().int(),
  })
  .strict();
export type MemberSummary = z.infer<typeof MemberSummary>;

export const ResetLinkResponse = z.object({ code: z.string(), link: z.string(), expiresAt: z.string() });
export type ResetLinkResponse = z.infer<typeof ResetLinkResponse>;

export const SetStatusRequest = z.object({ status: UserStatusSchema });
export type SetStatusRequest = z.infer<typeof SetStatusRequest>;

export const SetRoleRequest = z.object({ role: RoleSchema, password: z.string().min(1).max(1024) });
export type SetRoleRequest = z.infer<typeof SetRoleRequest>;

export const SetBirthDateRequest = z.object({ birthDate: CivilDate });
export type SetBirthDateRequest = z.infer<typeof SetBirthDateRequest>;

export const OpsStatusResponse = z.object({ version: z.string(), opsStatus: OpsStatus.nullable() });
export type OpsStatusResponse = z.infer<typeof OpsStatusResponse>;

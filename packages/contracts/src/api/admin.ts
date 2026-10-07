import { z } from 'zod';
import { INVITATION_NOTE_MAX } from '../auth-constants';
import { CivilDate } from './auth';

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

import { z } from 'zod';

export const CivilDate = z.iso.date();
export type CivilDate = z.infer<typeof CivilDate>;

export const RoleSchema = z.enum(['admin', 'member']);
export const UserStatusSchema = z.enum(['active', 'disabled']);
export const AgeBandSchema = z.enum(['minor', 'adult']);

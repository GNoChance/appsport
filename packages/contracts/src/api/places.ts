import { z } from 'zod';
import { LoadSettingsSchema } from '../load-settings';
import { EQUIPMENT_CATEGORIES, EquipmentCodeSchema } from '../taxonomy';

const HOUSEHOLD: readonly string[] = EQUIPMENT_CATEGORIES.household;

/** Matériel d'une salle : tout le catalogue sauf les objets du quotidien (R-EQ-3). */
export const GymEquipmentCode = EquipmentCodeSchema.refine((code) => !HOUSEHOLD.includes(code), {
  message: 'objet du quotidien non autorisé en salle',
});

export const GymHistoryAction = z.enum([
  'create',
  'update_info',
  'add_equipment',
  'remove_equipment',
  'update_load_settings',
]);
export type GymHistoryAction = z.infer<typeof GymHistoryAction>;

export const GymSummary = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  visibleMemberCount: z.number().int(),
});
export type GymSummary = z.infer<typeof GymSummary>;

export const GymDetail = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  loadSettings: LoadSettingsSchema,
  deletedAt: z.string().nullable(),
  equipment: z.array(EquipmentCodeSchema),
  canEdit: z.boolean(),
  visibleMembers: z.array(z.string()),
  history: z.array(
    z.object({
      at: z.string(),
      action: GymHistoryAction,
      authorUsername: z.string().nullable(),
      detail: z.unknown(),
    }),
  ),
});
export type GymDetail = z.infer<typeof GymDetail>;

export const CreateGymRequest = z.strictObject({
  name: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  equipment: z.array(GymEquipmentCode),
  isPrimary: z.boolean(),
  visibleAtGym: z.boolean().optional(),
});
export type CreateGymRequest = z.infer<typeof CreateGymRequest>;

export const CreateGymResponse = z.object({ gymId: z.string(), placeId: z.string() });
export type CreateGymResponse = z.infer<typeof CreateGymResponse>;

export const UpdateGymRequest = z
  .strictObject({
    name: z.string().trim().min(2).max(60).optional(),
    city: z.string().trim().min(2).max(60).optional(),
    loadSettings: LoadSettingsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export type UpdateGymRequest = z.infer<typeof UpdateGymRequest>;

export const HOME_PLACE_DEFAULT_NAME = 'Maison';

export const CreatePlaceRequest = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('gym'),
    gymId: z.string(),
    isPrimary: z.boolean(),
    visibleAtGym: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('home'),
    name: z.string().trim().min(1).max(30).optional(),
    equipment: z.array(EquipmentCodeSchema),
    isPrimary: z.boolean(),
  }),
]);
export type CreatePlaceRequest = z.infer<typeof CreatePlaceRequest>;

export const CreatePlaceResponse = z.object({ id: z.string() });
export type CreatePlaceResponse = z.infer<typeof CreatePlaceResponse>;

export const UpdatePlaceRequest = z
  .strictObject({
    name: z.string().trim().min(1).max(30).optional(),
    isPrimary: z.literal(true).optional(),
    visibleAtGym: z.boolean().optional(),
    loadSettings: LoadSettingsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export type UpdatePlaceRequest = z.infer<typeof UpdatePlaceRequest>;

export const DeletePlaceRequest = z.strictObject({ newPrimaryId: z.string().optional() });
export type DeletePlaceRequest = z.infer<typeof DeletePlaceRequest>;

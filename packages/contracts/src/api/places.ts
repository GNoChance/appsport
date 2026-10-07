import { z } from 'zod';
import { LoadSettingsSchema } from '../load-settings';
import { EQUIPMENT_CATEGORIES, EquipmentCodeSchema } from '../taxonomy';

const HOUSEHOLD: readonly string[] = EQUIPMENT_CATEGORIES.household;

/** Matériel d'une salle : tout le catalogue sauf les objets du quotidien (R-EQ-3). */
export const GymEquipmentCode = EquipmentCodeSchema.refine((code) => !HOUSEHOLD.includes(code), {
  message: 'objet du quotidien non autorisé en salle',
});

export const PLACE_KINDS = ['gym', 'home'] as const;
export const PlaceKindSchema = z.enum(PLACE_KINDS);
export type PlaceKind = z.infer<typeof PlaceKindSchema>;

export const GYM_NAME_MIN = 2;
export const GYM_NAME_MAX = 60;
export const GYM_CITY_MIN = 2;
export const GYM_CITY_MAX = 60;
export const PLACE_NAME_MAX = 30;

const gymName = () => z.string().trim().min(GYM_NAME_MIN).max(GYM_NAME_MAX);
const gymCity = () => z.string().trim().min(GYM_CITY_MIN).max(GYM_CITY_MAX);
const placeName = () => z.string().trim().min(1).max(PLACE_NAME_MAX);

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
  name: gymName(),
  city: gymCity(),
  equipment: z.array(GymEquipmentCode),
  isPrimary: z.boolean(),
  visibleAtGym: z.boolean().optional(),
});
export type CreateGymRequest = z.infer<typeof CreateGymRequest>;

export const CreateGymResponse = z.object({ gymId: z.string(), placeId: z.string() });
export type CreateGymResponse = z.infer<typeof CreateGymResponse>;

export const UpdateGymRequest = z
  .strictObject({
    name: gymName().optional(),
    city: gymCity().optional(),
    loadSettings: LoadSettingsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export type UpdateGymRequest = z.infer<typeof UpdateGymRequest>;

export const HOME_PLACE_DEFAULT_NAME = 'Maison';

export const CreatePlaceRequest = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: PlaceKindSchema.extract(['gym']),
    gymId: z.string(),
    isPrimary: z.boolean(),
    visibleAtGym: z.boolean().optional(),
  }),
  z.strictObject({
    kind: PlaceKindSchema.extract(['home']),
    name: placeName().optional(),
    equipment: z.array(EquipmentCodeSchema),
    isPrimary: z.boolean(),
  }),
]);
export type CreatePlaceRequest = z.infer<typeof CreatePlaceRequest>;

export const CreatePlaceResponse = z.object({ id: z.string() });
export type CreatePlaceResponse = z.infer<typeof CreatePlaceResponse>;

export const UpdatePlaceRequest = z
  .strictObject({
    name: placeName().optional(),
    isPrimary: z.literal(true).optional(),
    visibleAtGym: z.boolean().optional(),
    loadSettings: LoadSettingsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export type UpdatePlaceRequest = z.infer<typeof UpdatePlaceRequest>;

export const DeletePlaceRequest = z.strictObject({ newPrimaryId: z.string().optional() });
export type DeletePlaceRequest = z.infer<typeof DeletePlaceRequest>;

import { snakeToCamel } from '@appsport/contracts';
import type { Generated, Kysely, Transaction } from 'kysely';

/** Gabarit +SYNC des tables à propriétaire (09 §0). */
interface SyncColumns {
  ownerId: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface SoftDelete {
  deletedAt: string | null;
}

export interface ServerMetaTable {
  id: number;
  serverEpoch: string;
  epochStartedAt: string;
  epochBaseRev: Generated<number>;
  syncCounter: Generated<number>;
  tombstonePurgeRev: Generated<number>;
  catalogVersion: string | null;
  catalogUpdatedAt: string | null;
}

export interface SchemaMigrationsTable {
  id: string;
  breaking: number;
  appliedAt: string;
}

export interface AppliedOpTable {
  opId: string;
  userId: string;
  entity: string;
  rowId: string;
  status: 'applied' | 'applied_partial' | 'duplicate' | 'rejected';
  assignedRev: number | null;
  appliedAt: string;
}

export interface SyncRejectionTable extends SyncColumns, SoftDelete {
  id: string;
  opId: string;
  entity: string;
  rowId: string;
  code: 'validation' | 'forbidden' | 'parent_rejected' | 'stale_revision' | 'unknown_entity' | 'protocol';
  detailJson: string | null;
  dismissedAt: string | null;
}

export interface UserTable {
  id: string;
  username: string;
  usernameKey: string;
  passwordHash: string;
  role: 'admin' | 'member';
  status: Generated<'active' | 'disabled'>;
  birthDate: string;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  onboardingStep:
    | 'goal'
    | 'sport'
    | 'place_kind'
    | 'place'
    | 'experience'
    | 'availability'
    | 'health'
    | 'ready'
    | null;
  onboardingCompletedAt: string | null;
  invitationId: string | null;
  rev: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface InvitationTable {
  id: string;
  codeHash: string;
  note: string | null;
  birthDate: string | null;
  isAdminBootstrap: Generated<number>;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  revokedAt: string | null;
}

export interface PasswordResetTable {
  id: string;
  userId: string;
  codeHash: string;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
}

export interface SessionTable {
  id: string;
  tokenHash: string;
  userId: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  mustChangePassword: Generated<number>;
  revokedAt: string | null;
  revokedReason:
    | 'logout'
    | 'logout_all'
    | 'password_change'
    | 'password_reset'
    | 'admin'
    | 'account_deleted'
    | null;
}

export interface ConsentEventTable extends SyncColumns {
  id: string;
  type: 'health' | 'ai_coach';
  action: 'grant' | 'withdraw';
  textVersion: string;
}

export interface SecurityEventTable {
  id: string;
  at: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  tailnetIp: string | null;
  outcome: 'success' | 'failure' | 'blocked';
  details: string | null;
}

export interface TrainingProfileTable extends SyncColumns, SoftDelete {
  id: string;
  goal: 'muscle' | 'strength' | 'fat_loss' | 'fitness' | 'sport_support' | null;
  experience: 'none' | 'lt_6_months' | '6_to_24_months' | 'gt_24_months' | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  sportCode: string | null;
  sportOtherLabel: string | null;
  cautiousMode: Generated<number>;
}

export interface HealthScreeningTable extends SyncColumns, SoftDelete {
  id: string;
  caution: number | null;
  questionnaireVersion: string | null;
  answeredAt: string | null;
}

export interface LimitationTable extends SyncColumns, SoftDelete {
  id: string;
  bodyArea:
    | 'shoulder'
    | 'elbow'
    | 'wrist_hand'
    | 'neck'
    | 'upper_back'
    | 'lower_back'
    | 'hip'
    | 'knee'
    | 'ankle_foot'
    | 'other'
    | null;
  side: 'left' | 'right' | 'both' | 'not_applicable' | null;
  severity: 'mild' | 'severe' | null;
  note: string | null;
  active: number | null;
}

export interface GymTable extends SoftDelete {
  id: string;
  name: string;
  nameKey: string;
  city: string;
  cityKey: string;
  loadSettings: string;
  createdBy: string | null;
  updatedBy: string | null;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface GymEquipmentTable extends SoftDelete {
  id: string;
  gymId: string;
  equipmentCode: string;
  addedBy: string | null;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface GymHistoryTable {
  id: string;
  gymId: string;
  authorId: string | null;
  at: string;
  action: 'create' | 'update_info' | 'add_equipment' | 'remove_equipment' | 'update_load_settings';
  detail: string;
}

export interface PlaceTable extends SyncColumns, SoftDelete {
  id: string;
  kind: 'gym' | 'home';
  gymId: string | null;
  name: string | null;
  isPrimary: Generated<number>;
  visibleAtGym: Generated<number>;
  loadSettings: string | null;
}

export interface HomeEquipmentTable extends SyncColumns, SoftDelete {
  id: string;
  placeId: string;
  equipmentCode: string;
}

export interface Database {
  serverMeta: ServerMetaTable;
  schemaMigrations: SchemaMigrationsTable;
  appliedOp: AppliedOpTable;
  syncRejection: SyncRejectionTable;
  user: UserTable;
  invitation: InvitationTable;
  passwordReset: PasswordResetTable;
  session: SessionTable;
  consentEvent: ConsentEventTable;
  securityEvent: SecurityEventTable;
  trainingProfile: TrainingProfileTable;
  healthScreening: HealthScreeningTable;
  limitation: LimitationTable;
  gym: GymTable;
  gymEquipment: GymEquipmentTable;
  gymHistory: GymHistoryTable;
  place: PlaceTable;
  homeEquipment: HomeEquipmentTable;
}

export type DbExecutor = Kysely<Database> | Transaction<Database>;

/** Nom de table SQL (snake_case) vers clé de `Database` (camelCase) : 'training_profile' → 'trainingProfile'. */
export function tableKey(sqlTable: string): keyof Database {
  return snakeToCamel(sqlTable) as keyof Database;
}

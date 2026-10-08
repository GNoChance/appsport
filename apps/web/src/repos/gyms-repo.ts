import {
  type CreateGymRequest,
  CreateGymResponse,
  defaultLoadSettings,
  type EquipmentCode,
  GymDetail,
  GymSummary,
  LoadSettingsSchema,
  type UpdateGymRequest,
} from '@appsport/contracts';
import { z } from 'zod';
import { NetworkRequiredError } from '../api/client';
import type { AppServices } from '../app-services';
import { equipmentOf } from './places-repo';
import { isLive, parseJsonColumn, sendThenPull, text } from './rows';

export interface GymsRepo {
  search(q: string): Promise<GymSummary[]>;
  similar(name: string, city: string): Promise<GymSummary[]>;
  create(r: CreateGymRequest): Promise<CreateGymResponse>;
  /**
   * En ligne : fiche du serveur. Hors ligne : fiche tirée des miroirs (`offline: true`), sans droit
   * d'édition, historique ni membres visibles ; l'écran affiche alors « Liste disponible en ligne »
   * au lieu de la liste vide. Salle absente des miroirs ou supprimée (R-SAL-7) : l'erreur réseau est
   * relancée.
   */
  detail(id: string): Promise<{ detail: GymDetail; offline: boolean }>;
  update(id: string, r: UpdateGymRequest): Promise<void>;
  setEquipment(id: string, code: EquipmentCode, present: boolean): Promise<void>;
}

const GymSummaries = z.array(GymSummary);

export function createGymsRepo(s: AppServices): GymsRepo {
  const { db, api } = s;
  const gymPath = (id: string) => `/api/gyms/${encodeURIComponent(id)}`;

  async function offlineDetail(id: string): Promise<GymDetail | null> {
    const gym = await db.mirror('gym').get(id);
    if (!gym || !isLive(gym)) return null;
    return {
      id: gym.id,
      name: text(gym.name) ?? '',
      city: text(gym.city) ?? '',
      loadSettings: parseJsonColumn(gym.loadSettings, LoadSettingsSchema) ?? defaultLoadSettings('gym'),
      deletedAt: null,
      equipment: await equipmentOf(db, 'gym_equipment', 'gymId', gym.id),
      canEdit: false,
      visibleMembers: [],
      history: [],
    };
  }

  return {
    search: (q) => api.get(`/api/gyms?${new URLSearchParams({ q })}`, GymSummaries),
    similar: (name, city) =>
      api.get(`/api/gyms/similar?${new URLSearchParams({ name, city })}`, GymSummaries),
    create: (r) => sendThenPull(s, 'POST', '/api/gyms', { body: r, schema: CreateGymResponse }),
    async detail(id) {
      try {
        return { detail: await api.get(gymPath(id), GymDetail), offline: false };
      } catch (error) {
        if (!(error instanceof NetworkRequiredError)) throw error;
        const detail = await offlineDetail(id);
        if (!detail) throw error;
        return { detail, offline: true };
      }
    },
    async update(id, r) {
      await sendThenPull(s, 'PATCH', gymPath(id), { body: r });
    },
    async setEquipment(id, code, present) {
      await sendThenPull(s, present ? 'PUT' : 'DELETE', `${gymPath(id)}/equipment/${code}`);
    },
  };
}

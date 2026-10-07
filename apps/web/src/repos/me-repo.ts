import {
  type AcceptInvitationRequest,
  type ChangePasswordRequest,
  ExportV1,
  InvitationCheckResponse,
  type LoginRequest,
  MeResponse,
  ResetCheckResponse,
  type ResetPasswordRequest,
} from '@appsport/contracts';
import { ApiError, NetworkRequiredError } from '../api/client';
import type { AppServices } from '../app-services';
import { getMeta, setMeta } from '../local-db/meta';
import { wipeUserData } from '../local-db/wipe';
import { pendingCount } from '../sync/outbox';

export interface MeRepo {
  current(): Promise<MeResponse | null>;
  /** GET /api/me ; hors ligne → cache ; ApiError → null sans effacer le cache. */
  refresh(): Promise<MeResponse | null>;
  /** Propriétaire des données de l'appareil, pour avertir avant qu'un autre pseudo se connecte (P-AUT-6). */
  deviceOwner(): Promise<{ userId: string | null; username: string | null; pending: number }>;
  login(r: LoginRequest): Promise<MeResponse>;
  checkInvitation(code: string): Promise<InvitationCheckResponse>;
  acceptInvitation(r: AcceptInvitationRequest): Promise<MeResponse>;
  checkReset(code: string): Promise<ResetCheckResponse>;
  resetPassword(r: ResetPasswordRequest): Promise<MeResponse>;
  updateUsername(u: string): Promise<MeResponse>;
  /** 204 → refresh() puis synchro manuelle (débloquée après R-MDP-1). */
  changePassword(r: ChangePasswordRequest): Promise<void>;
  logout(mode: 'current' | 'all'): Promise<void>;
  exportData(): Promise<ExportV1>;
  deleteAccount(password: string): Promise<void>;
  /** Message des 18 ans à afficher : tranche vue « minor » sur l'appareil, « adult » maintenant (R-AGE-6). */
  adultNotice(): Promise<boolean>;
  dismissAdultNotice(): Promise<void>;
}

export function createMeRepo(s: AppServices): MeRepo {
  const { db, api, sync } = s;

  /** meta.me, et la tranche d'âge vue : posée si absente, ou tant que l'utilisateur est mineur. */
  async function rememberMe(me: MeResponse): Promise<void> {
    await db.transaction('rw', db.meta, async () => {
      await setMeta(db, 'me', me);
      const last = await getMeta(db, 'lastAgeBand');
      if (last === undefined || me.ageBand === 'minor') await setMeta(db, 'lastAgeBand', me.ageBand);
    });
  }

  /**
   * Session ouverte sous `me` (moteur déjà arrêté). Autre utilisateur que celui de l'appareil :
   * données locales effacées, file comprise (P-AUT-6, l'écran a averti grâce à `deviceOwner`),
   * puis meta.userId posé avant toute synchro sous le nouveau cookie. Le moteur est relancé
   * (réarmé même après un 410) et une synchro manuelle demandée.
   */
  async function adoptSession(me: MeResponse): Promise<void> {
    if ((await getMeta(db, 'userId')) !== me.id) {
      await wipeUserData(db, { keepOutbox: false });
      await setMeta(db, 'userId', me.id);
    }
    await rememberMe(me);
    sync.start();
    void sync.syncNow('manual');
  }

  /**
   * Le moteur est arrêté avant la requête : aucun cycle de l'ancien utilisateur ne part sous le
   * cookie que la réponse pose. En cas d'échec, il est relancé tel quel.
   */
  async function openSession(request: () => Promise<MeResponse>): Promise<MeResponse> {
    sync.stop();
    let me: MeResponse;
    try {
      me = await request();
    } catch (error) {
      sync.start();
      throw error;
    }
    await adoptSession(me);
    return me;
  }

  const current = async () => (await getMeta(db, 'me')) ?? null;

  const repo: MeRepo = {
    current,
    async refresh() {
      let me: MeResponse;
      try {
        me = await api.get('/api/me', MeResponse);
      } catch (error) {
        if (error instanceof NetworkRequiredError) return current();
        if (error instanceof ApiError) return null;
        throw error;
      }
      if ((await getMeta(db, 'userId')) === me.id) {
        await rememberMe(me);
      } else {
        // Session d'un autre compte (ouverte ailleurs dans ce navigateur) : on l'adopte.
        sync.stop();
        await adoptSession(me);
      }
      return me;
    },
    async deviceOwner() {
      const userId = (await getMeta(db, 'userId')) ?? null;
      return {
        userId,
        username: (await getMeta(db, 'me'))?.username ?? null,
        pending: userId ? await pendingCount(db, userId) : 0,
      };
    },
    login: (r) => openSession(() => api.send('POST', '/api/auth/login', r, MeResponse)),
    checkInvitation: (code) => api.send('POST', '/api/invitations/check', { code }, InvitationCheckResponse),
    acceptInvitation: (r) => openSession(() => api.send('POST', '/api/invitations/accept', r, MeResponse)),
    checkReset: (code) => api.send('POST', '/api/auth/reset/check', { code }, ResetCheckResponse),
    resetPassword: (r) => openSession(() => api.send('POST', '/api/auth/reset', r, MeResponse)),
    async updateUsername(username) {
      const me = await api.send('PATCH', '/api/me', { username }, MeResponse);
      await rememberMe(me);
      await sync.pullNow();
      return me;
    },
    async changePassword(r) {
      await api.send('POST', '/api/auth/password', r);
      await repo.refresh();
      void sync.syncNow('manual');
    },
    async logout(mode) {
      await api.send('POST', mode === 'all' ? '/api/auth/logout-all' : '/api/auth/logout');
      await wipeUserData(db, { keepOutbox: false });
    },
    exportData: () => api.get('/api/me/export', ExportV1),
    async deleteAccount(password) {
      await api.send('POST', '/api/me/delete', { password });
      await wipeUserData(db, { keepOutbox: false });
    },
    async adultNotice() {
      const last = await getMeta(db, 'lastAgeBand');
      return last === 'minor' && (await current())?.ageBand === 'adult';
    },
    async dismissAdultNotice() {
      await setMeta(db, 'lastAgeBand', 'adult');
    },
  };
  return repo;
}

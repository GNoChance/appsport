import {
  BODY_AREAS,
  type BodyArea,
  type ConsentState,
  CreateLimitationResponse,
  HEALTH_CONSENT_TEXT,
  HEALTH_QUESTIONNAIRE,
  HealthScreeningResponse,
  LIMITATION_SEVERITIES,
  LIMITATION_SIDES,
  type LimitationInput,
  type LimitationPatch,
  type LimitationSeverity,
  type LimitationSide,
  MeResponse,
  majorOf,
} from '@appsport/contracts';
import type { AppServices } from '../app-services';
import { getMeta, setMeta } from '../local-db/meta';
import { purgeHealthData } from '../local-db/wipe';
import { currentUserId, isLive, oneOf, ownedRows, sendThenPull, text } from './rows';

export interface LimitationView {
  id: string;
  bodyArea: BodyArea;
  side: LimitationSide;
  severity: LimitationSeverity;
  note: string | null;
  active: boolean;
}

export interface ConsentRepo {
  state(): Promise<ConsentState | null>;
  /** Accord santé actif donné sur une version majeure antérieure du texte (P-CST-4). */
  needsHealthReconsent(): Promise<boolean>;
  grantHealth(): Promise<MeResponse>;
  /** MeResponse → meta.me, purge locale des données de santé (P-CST-3), puis pull. */
  withdrawHealth(password: string): Promise<MeResponse>;
  screening(): Promise<{ caution: boolean; questionnaireVersion: string; answeredAt: string } | null>;
  saveScreening(a: [boolean, boolean, boolean, boolean]): Promise<{ caution: boolean }>;
  limitations(): Promise<LimitationView[]>;
  addLimitation(i: LimitationInput): Promise<{ id: string }>;
  updateLimitation(id: string, p: LimitationPatch): Promise<void>;
  removeLimitation(id: string): Promise<void>;
}

export function createConsentRepo(s: AppServices): ConsentRepo {
  const { db } = s;
  const saveMe = (me: MeResponse) => setMeta(db, 'me', me);
  const limitationPath = (id: string) => `/api/me/limitations/${encodeURIComponent(id)}`;

  return {
    async state() {
      return (await getMeta(db, 'me'))?.consents ?? null;
    },
    async needsHealthReconsent() {
      const health = (await getMeta(db, 'me'))?.consents.health;
      if (!health?.active || health.textVersion === null) return false;
      return majorOf(health.textVersion) < majorOf(HEALTH_CONSENT_TEXT.version);
    },
    grantHealth: () =>
      sendThenPull(s, 'POST', '/api/me/consents', {
        body: { type: 'health', textVersion: HEALTH_CONSENT_TEXT.version },
        schema: MeResponse,
        apply: saveMe,
      }),
    withdrawHealth: (password) =>
      sendThenPull(s, 'POST', '/api/me/consents/withdraw', {
        body: { type: 'health', password },
        schema: MeResponse,
        apply: async (me) => {
          await saveMe(me);
          await purgeHealthData(db);
        },
      }),
    async screening() {
      const userId = await currentUserId(db);
      // id = owner_id pour health_screening.
      const row = userId === null ? undefined : await db.mirror('health_screening').get(userId);
      if (!row || !isLive(row) || typeof row.caution !== 'boolean') return null;
      const questionnaireVersion = text(row.questionnaireVersion);
      const answeredAt = text(row.answeredAt);
      if (questionnaireVersion === null || answeredAt === null) return null;
      return { caution: row.caution, questionnaireVersion, answeredAt };
    },
    saveScreening: (answers) =>
      sendThenPull(s, 'PUT', '/api/me/health-screening', {
        body: { answers, questionnaireVersion: HEALTH_QUESTIONNAIRE.version },
        schema: HealthScreeningResponse,
      }),
    async limitations() {
      const rows = await ownedRows(db, 'limitation', await currentUserId(db));
      return rows.flatMap((r) => {
        const bodyArea = oneOf(BODY_AREAS, r.bodyArea);
        const side = oneOf(LIMITATION_SIDES, r.side);
        const severity = oneOf(LIMITATION_SEVERITIES, r.severity);
        if (!bodyArea || !side || !severity) return [];
        return [{ id: r.id, bodyArea, side, severity, note: text(r.note), active: r.active === true }];
      });
    },
    addLimitation: (i) =>
      sendThenPull(s, 'POST', '/api/me/limitations', { body: i, schema: CreateLimitationResponse }),
    async updateLimitation(id, p) {
      await sendThenPull(s, 'PATCH', limitationPath(id), { body: p });
    },
    async removeLimitation(id) {
      await sendThenPull(s, 'DELETE', limitationPath(id));
    },
  };
}

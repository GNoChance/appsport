import {
  BODY_AREAS,
  CONSENT_ACTIONS,
  CONSENT_TYPES,
  DAYS_PER_WEEK,
  EXPERIENCES,
  GOALS,
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  GymHistoryAction,
  INVITATION_NOTE_MAX,
  LIMITATION_NOTE_MAX,
  LIMITATION_SEVERITIES,
  LIMITATION_SIDES,
  ONBOARDING_STEPS,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PushResult,
  RejectionCode,
  RoleSchema,
  SECURITY_OUTCOMES,
  SESSION_MINUTES,
  SESSION_REVOKED_REASONS,
  SPORT_OTHER_LABEL_MAX,
  UserStatusSchema,
} from '@appsport/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support';

// 01 §9.1.4 : chaque énumération et chaque borne du DDL a sa constante dans contracts, et les deux concordent.
const ENUMS: Record<string, readonly (string | number)[]> = {
  'applied_op.status': PushResult.shape.status.options,
  'consent_event.type': CONSENT_TYPES,
  'consent_event.action': CONSENT_ACTIONS,
  'gym_history.action': GymHistoryAction.options,
  'limitation.body_area': BODY_AREAS,
  'limitation.side': LIMITATION_SIDES,
  'limitation.severity': LIMITATION_SEVERITIES,
  'place.kind': PLACE_KINDS,
  'security_event.outcome': SECURITY_OUTCOMES,
  'session.revoked_reason': SESSION_REVOKED_REASONS,
  'sync_rejection.code': RejectionCode.options,
  'training_profile.goal': GOALS,
  'training_profile.experience': EXPERIENCES,
  'training_profile.session_minutes': SESSION_MINUTES,
  'user.role': RoleSchema.options,
  'user.status': UserStatusSchema.options,
  'user.onboarding_step': ONBOARDING_STEPS,
};

const BOUNDS: Record<string, { min: number | null; max: number }> = {
  'gym.name': { min: GYM_NAME_MIN, max: GYM_NAME_MAX },
  'gym.city': { min: GYM_CITY_MIN, max: GYM_CITY_MAX },
  'invitation.note': { min: null, max: INVITATION_NOTE_MAX },
  'limitation.note': { min: null, max: LIMITATION_NOTE_MAX },
  'place.name': { min: null, max: PLACE_NAME_MAX },
  'training_profile.days_per_week': { min: Math.min(...DAYS_PER_WEEK), max: Math.max(...DAYS_PER_WEEK) },
  'training_profile.sport_other_label': { min: null, max: SPORT_OTHER_LABEL_MAX },
};

const IN_RE = /\b(\w+) IN \(([^)]*)\)/g;
const BETWEEN_RE = /(?:length\((\w+)\)|\b(\w+)) BETWEEN (\d+) AND (\d+)/g;
const MAX_RE = /length\((\w+)\) <= (\d+)/g;

function parseList(raw: string): (string | number)[] {
  return raw.split(',').map((v) => {
    const t = v.trim();
    return t.startsWith("'") ? t.slice(1, -1) : Number(t);
  });
}

const sorted = (v: readonly (string | number)[]) => [...v].map(String).sort();

let ctx: TestContext;
afterEach(() => ctx?.close());

async function schemaChecks() {
  ctx = await createTestContext();
  const tables = ctx.deps.sqlite
    .prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name")
    .all() as { name: string; sql: string }[];
  const enums = new Map<string, (string | number)[]>();
  const bounds = new Map<string, { min: number | null; max: number }>();
  for (const { name, sql } of tables) {
    for (const m of sql.matchAll(IN_RE)) {
      const values = parseList(m[2] as string);
      if (sorted(values).join() === '0,1') continue; // booléen
      enums.set(`${name}.${m[1]}`, values);
    }
    for (const m of sql.matchAll(BETWEEN_RE)) {
      bounds.set(`${name}.${m[1] ?? m[2]}`, { min: Number(m[3]), max: Number(m[4]) });
    }
    for (const m of sql.matchAll(MAX_RE)) bounds.set(`${name}.${m[1]}`, { min: null, max: Number(m[2]) });
  }
  return { enums, bounds };
}

describe('cohérence du DDL et des constantes de contracts (01 §9.1.4)', () => {
  it('chaque énumération IN (...) du schéma égale la constante de sa colonne', async () => {
    const { enums } = await schemaChecks();
    expect(enums.size).toBeGreaterThan(0);
    for (const [column, values] of enums) {
      const expected = ENUMS[column];
      expect(expected, `colonne sans constante : ${column}`).toBeDefined();
      expect(sorted(values), column).toEqual(sorted(expected ?? []));
    }
    expect([...enums.keys()].sort()).toEqual(Object.keys(ENUMS).sort());
  });

  it('chaque borne du schéma égale la constante de sa colonne', async () => {
    const { bounds } = await schemaChecks();
    for (const [column, bound] of bounds) {
      expect(BOUNDS[column], `colonne sans constante : ${column}`).toBeDefined();
      expect(bound, column).toEqual(BOUNDS[column]);
    }
    expect([...bounds.keys()].sort()).toEqual(Object.keys(BOUNDS).sort());
  });
});

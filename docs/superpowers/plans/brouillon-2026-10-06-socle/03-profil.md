### Task 14: Taxonomie du matériel, préréglages, réglages de charge, sports et textes versionnés

**Files:**
- Create: `packages/contracts/src/taxonomy.ts`
- Create: `packages/contracts/src/presets.ts`
- Create: `packages/contracts/src/load-settings.ts`
- Create: `packages/contracts/src/sports.ts`
- Create: `packages/contracts/src/texts.ts`
- Modify: `packages/contracts/src/index.ts` (ajouter `export * from './taxonomy'`, `'./presets'`, `'./load-settings'`, `'./sports'`, `'./texts'`)
- Create: `packages/domain/src/text.ts`
- Modify: `packages/domain/src/index.ts` (ajouter `export * from './text'`)
- Test: `packages/contracts/test/taxonomy.test.ts`, `packages/contracts/test/load-settings.test.ts`, `packages/contracts/test/sports-texts.test.ts`, `packages/domain/test/text.test.ts`

**Interfaces:**
- Consumes : `zod` (v4) ; rien d'autre (tâche sans dépendance interne hors du squelette T1).
- Produces :
```ts
// packages/contracts/src/taxonomy.ts
export const EQUIPMENT = ['chair','table','resistance_band','dumbbells','kettlebell','pull_up_bar','suspension_trainer','box',
  'flat_bench','adjustable_bench','squat_rack','dip_station','back_extension_bench','barbell','ez_bar','cable_station','lat_pulldown',
  'seated_row','leg_press','smith_machine','leg_extension','leg_curl','upper_body_machines'] as const;
export type EquipmentCode = typeof EQUIPMENT[number];
export const EquipmentCodeSchema: z.ZodType<EquipmentCode>;            // z.enum(EQUIPMENT)
export type EquipmentCategory = 'household'|'small_equipment'|'benches_racks'|'free_weights'|'machines';
export const EQUIPMENT_CATEGORIES: Record<EquipmentCategory, readonly EquipmentCode[]>;
export const EQUIPMENT_LABELS: Record<EquipmentCode, string>;
export const EQUIPMENT_IMPLIES: Partial<Record<EquipmentCode, readonly EquipmentCode[]>>;
export const REFERENCE_PROFILES: Record<'home_bodyweight'|'home_small_equipment'|'gym_reference', readonly EquipmentCode[]>;
// packages/contracts/src/presets.ts
export type EquipmentPresetId = 'gym_large'|'gym_small'|'gym_crossfit'|'gym_other'|'home_none'|'home_small'|'home_gym';
export const EQUIPMENT_PRESETS: Record<EquipmentPresetId, { kind: 'gym'|'home'; label: string; codes: readonly EquipmentCode[] }>;
export const HOME_DEFAULT_PRESET: EquipmentPresetId;                     // 'home_none'
// packages/contracts/src/load-settings.ts
export const LoadSettings: z.ZodType<...>; export type LoadSettings = { barG: number; smallestPlateG: number; dumbbellsG: number[]; machineStepG: number };
export function defaultLoadSettings(kind: 'gym'|'home'): LoadSettings;  // copie neuve à chaque appel
// packages/contracts/src/sports.ts
export const SPORT_CODES = ['running','cycling','swimming','football','rugby','basketball','handball','tennis','padel','badminton','combat_sports','climbing','skiing','dance','other'] as const;
export type SportCode = typeof SPORT_CODES[number];
export const SportCodeSchema: z.ZodType<SportCode>;                     // z.enum(SPORT_CODES)
export const SPORTS: readonly { code: SportCode; label: string }[];
export const SPORTS_LIST_VERSION = 1; export const SPORT_OTHER_LABEL_MAX = 40;
// packages/contracts/src/texts.ts
export const HEALTH_CONSENT_TEXT: { version: '1.0'; text: string };
export const HEALTH_QUESTIONNAIRE: { version: '1.0'; questions: readonly [string, string, string, string] };
export function majorOf(version: string): number;                        // 'MAJEUR.MINEUR' → MAJEUR ; sinon throw Error
// packages/domain/src/text.ts
export function normalize(text: string): string;
```

**Spec:** 02 R-MAT-1, R-MAT-2, 04 R-EQ-1 à R-EQ-4, 04 §3.2, §3.3, 02 §10.3 (R-CHG-1), 02 §8 E2, 02 R-CST-1 (textes versionnés), 03 P-CST-1, 02 R-SAL-3 (normalisation), 02 §15 n°16 (bornes).

- [ ] **Step 1: Write the failing test**

```ts
// packages/contracts/test/taxonomy.test.ts
import { describe, expect, it } from 'vitest';
import { EQUIPMENT, EQUIPMENT_CATEGORIES, EQUIPMENT_LABELS, EQUIPMENT_IMPLIES, REFERENCE_PROFILES,
  EquipmentCodeSchema, EQUIPMENT_PRESETS, HOME_DEFAULT_PRESET } from '../src';

const sorted = (a: readonly string[]) => [...a].sort();

describe('taxonomie du matériel', () => {
  it('EQUIPMENT compte 23 codes uniques', () => {
    expect(EQUIPMENT).toHaveLength(23);
    expect(new Set(EQUIPMENT).size).toBe(23);
  });
  it('les 5 catégories partitionnent EQUIPMENT', () => {
    expect(sorted(Object.keys(EQUIPMENT_CATEGORIES))).toEqual(['benches_racks','free_weights','household','machines','small_equipment']);
    const all = Object.values(EQUIPMENT_CATEGORIES).flat();
    expect(all).toHaveLength(23);
    expect(sorted(all)).toEqual(sorted(EQUIPMENT));
    expect(EQUIPMENT_CATEGORIES.household).toEqual(['chair','table']);
    expect(EQUIPMENT_CATEGORIES.free_weights).toEqual(['barbell','ez_bar']);
    expect(EQUIPMENT_CATEGORIES.small_equipment).toEqual(['resistance_band','dumbbells','kettlebell','pull_up_bar','suspension_trainer','box']);
  });
  it('chaque code a un libellé français non vide', () => {
    for (const c of EQUIPMENT) expect(EQUIPMENT_LABELS[c]).toMatch(/\S/);
    expect(EQUIPMENT_LABELS.squat_rack).toBe('Cage ou supports à squat avec sécurités');
    expect(EQUIPMENT_LABELS.chair).toBe('Chaise ou banc stable');
  });
  it('R-EQ-2 : seule implication adjustable_bench → flat_bench', () => {
    expect(EQUIPMENT_IMPLIES).toEqual({ adjustable_bench: ['flat_bench'] });
  });
  it('profils de référence (04 §3.3)', () => {
    expect(REFERENCE_PROFILES.home_bodyweight).toEqual(['chair','table']);
    expect(sorted(REFERENCE_PROFILES.home_small_equipment)).toEqual(sorted(['chair','table','pull_up_bar','resistance_band','dumbbells']));
    expect(REFERENCE_PROFILES.gym_reference).toHaveLength(14);
    for (const c of ['kettlebell','smith_machine','ez_bar','back_extension_bench','box','resistance_band','suspension_trainer'])
      expect(REFERENCE_PROFILES.gym_reference).not.toContain(c);
  });
  it('EquipmentCodeSchema refuse un code inconnu', () => {
    expect(EquipmentCodeSchema.safeParse('cardio').success).toBe(false);
    expect(EquipmentCodeSchema.parse('box')).toBe('box');
  });
});

describe('préréglages (R-MAT-2)', () => {
  it('7 préréglages dont chaque code existe', () => {
    expect(sorted(Object.keys(EQUIPMENT_PRESETS))).toEqual(['gym_crossfit','gym_large','gym_other','gym_small','home_gym','home_none','home_small']);
    for (const p of Object.values(EQUIPMENT_PRESETS)) for (const c of p.codes) expect(EQUIPMENT).toContain(c);
  });
  it('gym_large = tous les codes sauf household', () => {
    expect(sorted(EQUIPMENT_PRESETS.gym_large.codes)).toEqual(sorted(EQUIPMENT.filter((c) => c !== 'chair' && c !== 'table')));
  });
  it('home_none = home_bodyweight ; home_small = home_small_equipment ; défaut maison home_none', () => {
    expect(sorted(EQUIPMENT_PRESETS.home_none.codes)).toEqual(sorted(REFERENCE_PROFILES.home_bodyweight));
    expect(sorted(EQUIPMENT_PRESETS.home_small.codes)).toEqual(sorted(REFERENCE_PROFILES.home_small_equipment));
    expect(HOME_DEFAULT_PRESET).toBe('home_none');
  });
  it('préréglages détaillés exacts', () => {
    expect(sorted(EQUIPMENT_PRESETS.gym_small.codes)).toEqual(sorted(['dumbbells','barbell','ez_bar','flat_bench','adjustable_bench','squat_rack','cable_station','lat_pulldown','seated_row','leg_press','pull_up_bar','dip_station']));
    expect(sorted(EQUIPMENT_PRESETS.gym_crossfit.codes)).toEqual(sorted(['barbell','squat_rack','dumbbells','kettlebell','flat_bench','pull_up_bar','suspension_trainer','box','resistance_band']));
    expect(sorted(EQUIPMENT_PRESETS.home_gym.codes)).toEqual(sorted(['chair','table','pull_up_bar','resistance_band','dumbbells','kettlebell','barbell','squat_rack','flat_bench']));
    expect(EQUIPMENT_PRESETS.gym_other.codes).toEqual([]);
  });
  it('kind correct et aucun code household dans un préréglage de salle (R-EQ-3)', () => {
    for (const [id, p] of Object.entries(EQUIPMENT_PRESETS)) {
      expect(p.kind).toBe(id.startsWith('gym_') ? 'gym' : 'home');
      if (p.kind === 'gym') for (const c of p.codes) expect(EQUIPMENT_CATEGORIES.household).not.toContain(c);
    }
  });
});
```

```ts
// packages/contracts/test/load-settings.test.ts
import { describe, expect, it } from 'vitest';
import { LoadSettings, defaultLoadSettings } from '../src';

const gym = defaultLoadSettings('gym');
describe('LoadSettings (02 §10.3)', () => {
  it('défauts salle et maison complets', () => {
    expect(gym).toEqual({ barG: 20000, smallestPlateG: 1250, dumbbellsG: Array.from({ length: 20 }, (_, i) => 2000 * (i + 1)), machineStepG: 5000 });
    expect(gym.dumbbellsG).toHaveLength(20);
    expect(gym.dumbbellsG.at(-1)).toBe(40000);
    expect(defaultLoadSettings('home')).toEqual({ barG: 20000, smallestPlateG: 1250, dumbbellsG: [], machineStepG: 5000 });
    expect(LoadSettings.safeParse(gym).success).toBe(true);
    expect(LoadSettings.safeParse(defaultLoadSettings('home')).success).toBe(true);
  });
  it('renvoie une copie neuve', () => {
    defaultLoadSettings('gym').dumbbellsG.push(1);
    expect(defaultLoadSettings('gym').dumbbellsG).toHaveLength(20);
  });
  it.each([
    ['barG = 4999', { barG: 4999 }], ['barG = 25001', { barG: 25001 }], ['barG non entier', { barG: 20000.5 }],
    ['smallestPlateG = 249', { smallestPlateG: 249 }], ['smallestPlateG = 5001', { smallestPlateG: 5001 }],
    ['machineStepG = 499', { machineStepG: 499 }], ['machineStepG = 10001', { machineStepG: 10001 }],
    ['haltères non croissants', { dumbbellsG: [4000, 2000] }], ['haltères en double', { dumbbellsG: [2000, 2000] }],
    ['61 haltères', { dumbbellsG: Array.from({ length: 61 }, (_, i) => 500 + 500 * i) }],
    ['haltère < 500', { dumbbellsG: [400] }], ['haltère > 80000', { dumbbellsG: [80500] }],
    ['clé inconnue', { barKg: 20 }], ['champ manquant', { machineStepG: undefined }],
  ])('refuse %s', (_label, patch) => {
    expect(LoadSettings.safeParse({ ...gym, ...patch }).success).toBe(false);
  });
  it('accepte 60 haltères et les bornes incluses', () => {
    expect(LoadSettings.safeParse({ barG: 5000, smallestPlateG: 250, machineStepG: 10000,
      dumbbellsG: Array.from({ length: 60 }, (_, i) => 500 + 500 * i) }).success).toBe(true);
    expect(LoadSettings.safeParse({ ...gym, barG: 25000, smallestPlateG: 5000, machineStepG: 500, dumbbellsG: [80000] }).success).toBe(true);
  });
});
```

```ts
// packages/contracts/test/sports-texts.test.ts
import { describe, expect, it } from 'vitest';
import { SPORTS, SPORT_CODES, SportCodeSchema, SPORTS_LIST_VERSION, SPORT_OTHER_LABEL_MAX,
  HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, majorOf } from '../src';

describe('sports (E2)', () => {
  it('15 codes uniques dont other, libellés FR', () => {
    expect(SPORTS).toHaveLength(15);
    expect(SPORTS.map((s) => s.code)).toEqual([...SPORT_CODES]);
    expect(SPORTS.find((s) => s.code === 'other')?.label).toBe('Autre');
    expect(SPORTS.find((s) => s.code === 'running')?.label).toBe('Course à pied');
    expect(SPORTS_LIST_VERSION).toBe(1);
    expect(SPORT_OTHER_LABEL_MAX).toBe(40);
    expect(SportCodeSchema.safeParse('golf').success).toBe(false);
  });
});
describe('textes versionnés', () => {
  it('consentement santé v1.0', () => {
    expect(HEALTH_CONSENT_TEXT.version).toBe('1.0');
    expect(HEALTH_CONSENT_TEXT.text).toMatch(/^J'accepte qu'appsport enregistre mes données de santé/);
    expect(HEALTH_CONSENT_TEXT.text).toMatch(/elles seront alors supprimées\.$/);
  });
  it('questionnaire : 4 questions, version 1.0', () => {
    expect(HEALTH_QUESTIONNAIRE.version).toBe('1.0');
    expect(HEALTH_QUESTIONNAIRE.questions).toHaveLength(4);
    for (const q of HEALTH_QUESTIONNAIRE.questions) expect(q).toMatch(/\?$/);
  });
  it('majorOf', () => {
    expect(majorOf('1.2')).toBe(1);
    expect(majorOf('12.0')).toBe(12);
    expect(() => majorOf('abc')).toThrow();
    expect(() => majorOf('1')).toThrow();
  });
});
```

```ts
// packages/domain/test/text.test.ts
import { describe, expect, it } from 'vitest';
import { normalize } from '../src';

describe('normalize (R-SAL-3)', () => {
  it.each([
    ['Basic-Fit  Lyon Part-Dieu', 'basic fit lyon part dieu'],
    ['Salle Énergie', 'salle energie'],
    ["L'Orange Bleue — Saint-Étienne", 'l orange bleue saint etienne'],
    ['  Fitness   Park!! ', 'fitness park'],
    ['Crossfit 69', 'crossfit 69'],
    ['', ''],
  ])('%s → %s', (input, expected) => expect(normalize(input)).toBe(expected));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/contracts test -- taxonomy load-settings sports-texts` puis `pnpm --filter @appsport/domain test -- text`
Expected: FAIL, les exports `EQUIPMENT`, `LoadSettings`, `SPORTS`, `normalize`… n'existent pas (« does not provide an export named »).

- [ ] **Step 3: Implement**

`packages/contracts/src/taxonomy.ts` : `EQUIPMENT` dans l'ordre ci-dessus ; `EquipmentCodeSchema = z.enum(EQUIPMENT)`. Catégories (ordre interne fixé) :
- `household` : chair, table
- `small_equipment` : resistance_band, dumbbells, kettlebell, pull_up_bar, suspension_trainer, box
- `benches_racks` : flat_bench, adjustable_bench, squat_rack, dip_station, back_extension_bench
- `free_weights` : barbell, ez_bar
- `machines` : cable_station, lat_pulldown, seated_row, leg_press, smith_machine, leg_extension, leg_curl, upper_body_machines

`EQUIPMENT_LABELS` (exacts) : chair « Chaise ou banc stable » ; table « Table solide (rowing sous la table) » ; resistance_band « Élastiques (bandes, avec poignées ou mini-bandes) » ; dumbbells « Haltères fixes ou réglables » ; kettlebell « Kettlebell » ; pull_up_bar « Barre de traction » ; suspension_trainer « Sangles de suspension ou anneaux » ; box « Box ou step stable » ; flat_bench « Banc plat » ; adjustable_bench « Banc inclinable » ; squat_rack « Cage ou supports à squat avec sécurités » ; dip_station « Barres parallèles » ; back_extension_bench « Banc à lombaires (45° ou GHD) » ; barbell « Barre droite et disques » ; ez_bar « Barre EZ » ; cable_station « Poulie réglable ou vis-à-vis » ; lat_pulldown « Tirage vertical » ; seated_row « Tirage horizontal assis » ; leg_press « Presse à cuisses » ; smith_machine « Barre guidée (Smith) » ; leg_extension « Leg extension » ; leg_curl « Leg curl » ; upper_body_machines « Machines guidées du haut du corps (développé, pec deck, épaules) ».

`EQUIPMENT_IMPLIES = { adjustable_bench: ['flat_bench'] }`. `REFERENCE_PROFILES` : `home_bodyweight` = chair, table ; `home_small_equipment` = chair, table, pull_up_bar, resistance_band, dumbbells ; `gym_reference` = dumbbells, barbell, squat_rack, flat_bench, adjustable_bench, dip_station, pull_up_bar, cable_station, lat_pulldown, seated_row, leg_press, leg_extension, leg_curl, upper_body_machines.

`presets.ts` : libellés `gym_large` « Grande salle ou chaîne », `gym_small` « Petite salle de quartier », `gym_crossfit` « Box de cross-training », `gym_other` « Autre », `home_none` « Sans matériel », `home_small` « Petit matériel », `home_gym` « Home gym ». `gym_large.codes` est dérivé (`EQUIPMENT.filter` hors household), `home_none`/`home_small` réutilisent `REFERENCE_PROFILES`. Codes des autres préréglages : ceux des assertions du test.

`load-settings.ts` : `z.strictObject` ; `barG` int 5000..25000 ; `smallestPlateG` int 250..5000 ; `machineStepG` int 500..10000 ; `dumbbellsG` tableau d'int 500..80000, `.max(60)`, `.refine` strictement croissant (ce qui exclut les doublons). Défaut salle `dumbbellsG` = 2000 à 40000 par pas de 2000, maison `[]`.

`sports.ts` : libellés : running « Course à pied », cycling « Vélo », swimming « Natation », football « Football », rugby « Rugby », basketball « Basket », handball « Handball », tennis « Tennis », padel « Padel », badminton « Badminton », combat_sports « Sports de combat », climbing « Escalade », skiing « Ski », dance « Danse », other « Autre ».

`texts.ts` : `HEALTH_CONSENT_TEXT.text` = exactement « J'accepte qu'appsport enregistre mes données de santé : limitations et zones sensibles, réponses de prudence, douleurs signalées pendant les séances, taille, poids, profil et suivi nutritionnels. Elles servent uniquement à adapter mes séances et mes repères. Elles restent sur le serveur du cercle et l'administrateur ne les consulte pas dans l'appli. Je peux retirer cet accord à tout moment : elles seront alors supprimées. » Questions v1.0 (à faire relire par l'admin avant la mise en service, ce qui changera la version) :
1. « As-tu un problème cardiaque connu, ou pratiques-tu une activité physique sous surveillance médicale ? »
2. « As-tu ressenti une douleur à la poitrine pendant un effort, ou perdu connaissance, au cours des 12 derniers mois ? »
3. « As-tu une maladie ou un traitement qui limite ton activité physique ? »
4. « As-tu un problème d'os, d'articulation ou de muscle qui s'aggrave à l'effort ? »

`majorOf` : accepte `/^\d+\.\d+$/`, sinon `throw new Error('version invalide')`.

`packages/domain/src/text.ts` `normalize` : `toLowerCase()` → `normalize('NFD')` → retirer `\p{M}` → remplacer toute suite de caractères hors `[\p{L}\p{N}]` par une espace → `trim()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/contracts test -- taxonomy load-settings sports-texts` puis `pnpm --filter @appsport/domain test -- text`, puis `pnpm typecheck` et `pnpm lint`
Expected: PASS, tous les tests verts ; typecheck et lint sans erreur.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/taxonomy.ts packages/contracts/src/presets.ts packages/contracts/src/load-settings.ts packages/contracts/src/sports.ts packages/contracts/src/texts.ts packages/contracts/src/index.ts packages/contracts/test/taxonomy.test.ts packages/contracts/test/load-settings.test.ts packages/contracts/test/sports-texts.test.ts packages/domain/src/text.ts packages/domain/src/index.ts packages/domain/test/text.test.ts
git commit -m "feat(profil): taxonomie du matériel, préréglages, réglages de charge et textes versionnés"
```

---

### Task 15: recommendTemplate, objectifs et reprise de l'onboarding

**Files:**
- Create: `packages/contracts/src/api/profile.ts` (partie objectifs et niveaux ; complété par T16)
- Modify: `packages/contracts/src/index.ts` (ajouter `export * from './api/profile'`)
- Create: `packages/domain/src/recommend-template.ts`
- Create: `packages/domain/src/onboarding.ts`
- Modify: `packages/domain/src/index.ts` (ajouter `export * from './recommend-template'`, `'./onboarding'`)
- Create: `packages/domain/test/fixtures/templates.ts`
- Test: `packages/domain/test/recommend-template.test.ts`, `packages/domain/test/onboarding.test.ts`

**Interfaces:**
- Consumes : `ONBOARDING_STEPS`, `OnboardingStep` (schéma Zod et type) de `packages/contracts/src/api/auth.ts` [comptes T10] ; `AgeBand` de `packages/contracts/src/constants.ts` [T2].
- Produces :
```ts
// packages/contracts/src/api/profile.ts [T15]
export const GOALS = ['muscle','strength','fat_loss','fitness','sport_support'] as const;
export const Goal = z.enum(GOALS); export type Goal = z.infer<typeof Goal>;
export const EXPERIENCES = ['none','lt_6_months','6_to_24_months','gt_24_months'] as const;
export const Experience = z.enum(EXPERIENCES); export type Experience = z.infer<typeof Experience>;
export const GOAL_LABELS: Record<Goal, string>; export const EXPERIENCE_LABELS: Record<Experience, string>;
export { OnboardingStep, ONBOARDING_STEPS } from './auth';
// packages/domain/src/recommend-template.ts
export type { Goal, Experience } from '@appsport/contracts';
export type TemplateContext = 'gym'|'home'|'sport'; export type TrainingLevel = 'beginner'|'intermediate';
export interface TemplateDescriptor { id: string; context: TemplateContext; level: TrainingLevel; days: { min: number; max: number }; available: boolean }
export interface RecommendInput { goal: Goal; sportCode: string | null; primaryPlaceKind: 'gym'|'home'; experience: Experience; daysPerWeek: 2|3|4 }
export type RecommendReason = 'FEW_DAYS_FULL_BODY'|'NO_TEMPLATE_AVAILABLE'|'DAYS_ADJUSTED';
export interface Recommendation { templateId: string | null; context: TemplateContext; level: TrainingLevel; daysPerWeek: number; reasons: RecommendReason[] }
export function levelFromExperience(e: Experience): TrainingLevel;
export function recommendTemplate(input: RecommendInput, templates: readonly TemplateDescriptor[]): Recommendation;
// packages/domain/src/onboarding.ts
export { ONBOARDING_STEPS } from '@appsport/contracts'; export type { OnboardingStep } from '@appsport/contracts';
export function availableGoals(ageBand: AgeBand): Goal[];   // minor → sans 'fat_loss' ; ordre de GOALS
export function firstIncompleteStep(s: { goal: Goal|null; experience: Experience|null; daysPerWeek: number|null; sessionMinutes: number|null;
  hasPrimaryPlace: boolean; lastValidatedStep: OnboardingStep|null }): OnboardingStep;
// packages/domain/test/fixtures/templates.ts
export const FAKE_TEMPLATES: readonly TemplateDescriptor[];
export function withUnavailable(ids: readonly string[]): TemplateDescriptor[]; // copie de FAKE_TEMPLATES, ces ids à available=false
```

**Spec:** 02 §9 R-REC-1 à R-REC-8, 05 §3 (règles 1 à 4), 02 R-ONB-2, 02 §8 E1 (objectif masqué pour les mineurs), 02 §15 n°11 (partie objectif) et n°12.

- [ ] **Step 1: Write the failing test**

```ts
// packages/domain/test/fixtures/templates.ts
import type { TemplateDescriptor } from '../../src';
export const FAKE_TEMPLATES: readonly TemplateDescriptor[] = [
  { id: 'gym-beginner-full-body-ab', context: 'gym', level: 'beginner', days: { min: 2, max: 3 }, available: true },
  { id: 'gym-intermediate-upper-lower', context: 'gym', level: 'intermediate', days: { min: 3, max: 4 }, available: true },
  { id: 'home-beginner-full-body', context: 'home', level: 'beginner', days: { min: 2, max: 3 }, available: true },
  { id: 'home-intermediate-upper-lower', context: 'home', level: 'intermediate', days: { min: 3, max: 4 }, available: true },
  { id: 'sport-beginner-complement', context: 'sport', level: 'beginner', days: { min: 2, max: 2 }, available: true },
  { id: 'sport-intermediate-strength-prevention', context: 'sport', level: 'intermediate', days: { min: 2, max: 2 }, available: true },
];
export const withUnavailable = (ids: readonly string[]) => FAKE_TEMPLATES.map((t) => ({ ...t, available: !ids.includes(t.id) }));
```

```ts
// packages/domain/test/recommend-template.test.ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GOALS, EXPERIENCES } from '@appsport/contracts';
import { recommendTemplate, levelFromExperience, type RecommendInput, type Recommendation, type TemplateContext, type TrainingLevel } from '../src';
import { FAKE_TEMPLATES, withUnavailable } from './fixtures/templates';

type Row = Omit<Recommendation, 'context'>;
const B = (id: string, d: number, r: Row['reasons'] = []): Row => ({ templateId: id, level: 'beginner', daysPerWeek: d, reasons: r });
const I = (id: string, d: number, r: Row['reasons'] = []): Row => ({ templateId: id, level: 'intermediate', daysPerWeek: d, reasons: r });
// Oracle écrit à la main : (contexte, niveau issu de l'expérience, jours demandés) → résultat attendu
const ORACLE: Record<string, Row> = {
  'gym:beginner:2': B('gym-beginner-full-body-ab', 2), 'gym:beginner:3': B('gym-beginner-full-body-ab', 3),
  'gym:beginner:4': B('gym-beginner-full-body-ab', 3, ['DAYS_ADJUSTED']),
  'gym:intermediate:2': B('gym-beginner-full-body-ab', 2, ['FEW_DAYS_FULL_BODY']),
  'gym:intermediate:3': I('gym-intermediate-upper-lower', 3), 'gym:intermediate:4': I('gym-intermediate-upper-lower', 4),
  'home:beginner:2': B('home-beginner-full-body', 2), 'home:beginner:3': B('home-beginner-full-body', 3),
  'home:beginner:4': B('home-beginner-full-body', 3, ['DAYS_ADJUSTED']),
  'home:intermediate:2': B('home-beginner-full-body', 2, ['FEW_DAYS_FULL_BODY']),
  'home:intermediate:3': I('home-intermediate-upper-lower', 3), 'home:intermediate:4': I('home-intermediate-upper-lower', 4),
  'sport:beginner:2': B('sport-beginner-complement', 2),
  'sport:beginner:3': B('sport-beginner-complement', 2, ['DAYS_ADJUSTED']), 'sport:beginner:4': B('sport-beginner-complement', 2, ['DAYS_ADJUSTED']),
  'sport:intermediate:2': I('sport-intermediate-strength-prevention', 2),
  'sport:intermediate:3': I('sport-intermediate-strength-prevention', 2, ['DAYS_ADJUSTED']),
  'sport:intermediate:4': I('sport-intermediate-strength-prevention', 2, ['DAYS_ADJUSTED']),
};
const LEVEL: Record<string, TrainingLevel> = { none: 'beginner', lt_6_months: 'beginner', '6_to_24_months': 'intermediate', gt_24_months: 'intermediate' };

describe('recommendTemplate — table exhaustive (02 §15 n°12)', () => {
  const cases: RecommendInput[] = [];
  for (const goal of GOALS) for (const sportCode of [null, 'football']) for (const primaryPlaceKind of ['gym', 'home'] as const)
    for (const experience of EXPERIENCES) for (const daysPerWeek of [2, 3, 4] as const)
      cases.push({ goal, sportCode, primaryPlaceKind, experience, daysPerWeek });
  it('génère 240 cas', () => expect(cases).toHaveLength(240));
  it.each(cases)('%o', (input) => {
    const context: TemplateContext = input.goal === 'sport_support' && input.sportCode ? 'sport' : input.primaryPlaceKind;
    expect(recommendTemplate(input, FAKE_TEMPLATES)).toEqual({ context, ...ORACLE[`${context}:${LEVEL[input.experience]}:${input.daysPerWeek}`] });
  });
});

describe('recommendTemplate — règles ciblées', () => {
  const base: RecommendInput = { goal: 'muscle', sportCode: null, primaryPlaceKind: 'gym', experience: 'gt_24_months', daysPerWeek: 2 };
  it('R-REC-2 levelFromExperience', () => {
    expect(EXPERIENCES.map(levelFromExperience)).toEqual(['beginner', 'beginner', 'intermediate', 'intermediate']);
  });
  it('R-REC-1 : sport_support sans sport (null, vide ou espaces) → contexte du lieu', () => {
    for (const sportCode of [null, '', '   '])
      expect(recommendTemplate({ ...base, goal: 'sport_support', sportCode, primaryPlaceKind: 'home' }, FAKE_TEMPLATES).context).toBe('home');
  });
  it('R-REC-3 : intermédiaire salle 2 jours', () => {
    expect(recommendTemplate(base, FAKE_TEMPLATES)).toEqual({ templateId: 'gym-beginner-full-body-ab', context: 'gym', level: 'beginner', daysPerWeek: 2, reasons: ['FEW_DAYS_FULL_BODY'] });
  });
  it('R-REC-4 : modèle indisponible → autre niveau du même contexte', () => {
    expect(recommendTemplate({ ...base, daysPerWeek: 4 }, withUnavailable(['gym-intermediate-upper-lower'])))
      .toEqual({ templateId: 'gym-beginner-full-body-ab', context: 'gym', level: 'beginner', daysPerWeek: 3, reasons: ['DAYS_ADJUSTED'] });
    expect(recommendTemplate(base, withUnavailable(['gym-beginner-full-body-ab'])))
      .toEqual({ templateId: 'gym-intermediate-upper-lower', context: 'gym', level: 'intermediate', daysPerWeek: 3, reasons: ['FEW_DAYS_FULL_BODY', 'DAYS_ADJUSTED'] });
  });
  it('R-REC-4 : aucun modèle du contexte → null + NO_TEMPLATE_AVAILABLE, jours inchangés', () => {
    expect(recommendTemplate({ ...base, daysPerWeek: 4 }, withUnavailable(['gym-beginner-full-body-ab', 'gym-intermediate-upper-lower'])))
      .toEqual({ templateId: null, context: 'gym', level: 'intermediate', daysPerWeek: 4, reasons: ['NO_TEMPLATE_AVAILABLE'] });
    expect(recommendTemplate(base, []).templateId).toBeNull();
  });
  it('R-REC-5 : DAYS_ADJUSTED seulement si les jours changent', () => {
    expect(recommendTemplate({ ...base, experience: 'none', daysPerWeek: 3 }, FAKE_TEMPLATES).reasons).toEqual([]);
    expect(recommendTemplate({ ...base, experience: 'none', daysPerWeek: 4 }, FAKE_TEMPLATES).reasons).toEqual(['DAYS_ADJUSTED']);
  });
});

describe('recommendTemplate — propriétés (fast-check)', () => {
  const input = fc.record({
    goal: fc.constantFrom(...GOALS), sportCode: fc.constantFrom(null, '', ' ', 'football', 'other'),
    primaryPlaceKind: fc.constantFrom('gym' as const, 'home' as const), experience: fc.constantFrom(...EXPERIENCES),
    daysPerWeek: fc.constantFrom(2 as const, 3 as const, 4 as const),
  });
  const templates = fc.array(fc.boolean(), { minLength: 6, maxLength: 6 })
    .map((av) => FAKE_TEMPLATES.map((t, i) => ({ ...t, available: av[i] as boolean })));
  it('jours dans [min, max] du modèle retenu, et modèle retenu disponible', () => fc.assert(fc.property(input, templates, (i, ts) => {
    const r = recommendTemplate(i, ts);
    if (r.templateId === null) return r.reasons.includes('NO_TEMPLATE_AVAILABLE');
    const t = ts.find((x) => x.id === r.templateId)!;
    return t.available && t.context === r.context && r.daysPerWeek >= t.days.min && r.daysPerWeek <= t.days.max;
  })));
  it('contexte sport ⇔ goal = sport_support et sportCode non vide', () => fc.assert(fc.property(input, templates, (i, ts) =>
    (recommendTemplate(i, ts).context === 'sport') === (i.goal === 'sport_support' && !!i.sportCode?.trim()))));
  it('déterministe', () => fc.assert(fc.property(input, templates, (i, ts) =>
    JSON.stringify(recommendTemplate(i, ts)) === JSON.stringify(recommendTemplate(i, ts)))));
});
```

```ts
// packages/domain/test/onboarding.test.ts
import { describe, expect, it } from 'vitest';
import { availableGoals, firstIncompleteStep, ONBOARDING_STEPS } from '../src';

const empty = { goal: null, experience: null, daysPerWeek: null, sessionMinutes: null, hasPrimaryPlace: false, lastValidatedStep: null } as const;
const full = { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45, hasPrimaryPlace: true } as const;

describe('firstIncompleteStep (R-ONB-2)', () => {
  it('ordre des étapes', () => expect(ONBOARDING_STEPS).toEqual(['goal','sport','place_kind','place','experience','availability','health','ready']));
  it.each([
    ['rien', empty, 'goal'],
    ['E1 validé', { ...empty, goal: 'muscle', lastValidatedStep: 'goal' }, 'sport'],
    ['E2 validé', { ...empty, goal: 'muscle', lastValidatedStep: 'sport' }, 'place_kind'],
    ['E3 validé sans lieu', { ...empty, goal: 'muscle', lastValidatedStep: 'place_kind' }, 'place_kind'],
    ['lieu principal : E3 et E4 complets ensemble', { ...empty, goal: 'muscle', hasPrimaryPlace: true, lastValidatedStep: 'sport' }, 'experience'],
    ['E5 rempli', { ...empty, goal: 'muscle', hasPrimaryPlace: true, experience: 'none', lastValidatedStep: 'experience' }, 'availability'],
    ['E6 à moitié', { ...full, sessionMinutes: null, lastValidatedStep: 'experience' }, 'availability'],
    ['E6 rempli, E7 non validé', { ...full, lastValidatedStep: 'availability' }, 'health'],
    ['E7 validé', { ...full, lastValidatedStep: 'health' }, 'ready'],
    ['E8 atteint', { ...full, lastValidatedStep: 'ready' }, 'ready'],
    ['retour arrière sur E1', { ...full, lastValidatedStep: 'goal' }, 'sport'],
    ['objectif manquant malgré la suite', { ...full, goal: null, lastValidatedStep: 'health' }, 'goal'],
    ['lieu supprimé', { ...full, hasPrimaryPlace: false, lastValidatedStep: 'health' }, 'place_kind'],
  ] as const)('%s', (_l, s, expected) => expect(firstIncompleteStep(s)).toBe(expected));
});
describe('availableGoals (E1, 02 §15 n°11)', () => {
  it('mineur sans fat_loss', () => {
    expect(availableGoals('minor')).toEqual(['muscle','strength','fitness','sport_support']);
    expect(availableGoals('adult')).toEqual(['muscle','strength','fat_loss','fitness','sport_support']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/domain test -- recommend-template onboarding`
Expected: FAIL, `recommendTemplate`, `firstIncompleteStep`, `availableGoals`, `GOALS` introuvables.

- [ ] **Step 3: Implement**

`packages/contracts/src/api/profile.ts` : `GOAL_LABELS` = muscle « Prendre du muscle », strength « Gagner en force », fat_loss « Perdre du gras », fitness « Forme et santé », sport_support « Me renforcer pour mon sport » ; `EXPERIENCE_LABELS` = none « Jamais », lt_6_months « Moins de 6 mois », 6_to_24_months « 6 mois à 2 ans », gt_24_months « Plus de 2 ans ». Le domaine réexporte les types `Goal` et `Experience` sans les redéfinir.

`recommendTemplate` (ordre R-REC-1 à R-REC-5 ; aucun paramètre d'âge ni de prudence, R-REC-6) :
```ts
const find = (ctx, lvl) => templates.find((t) => t.context === ctx && t.level === lvl);
const context = input.goal === 'sport_support' && input.sportCode?.trim() ? 'sport' : input.primaryPlaceKind;
let level = levelFromExperience(input.experience); const reasons: RecommendReason[] = [];
if (level === 'intermediate') {                                  // R-REC-3 : bornes du descripteur, même indisponible
  const inter = find(context, 'intermediate');
  if (inter && input.daysPerWeek < inter.days.min) { level = 'beginner'; reasons.push('FEW_DAYS_FULL_BODY'); }
}
let tpl = find(context, level);
if (!tpl?.available) {                                           // R-REC-4
  const other = find(context, level === 'beginner' ? 'intermediate' : 'beginner');
  if (!other?.available) return { templateId: null, context, level: levelFromExperience(input.experience), daysPerWeek: input.daysPerWeek, reasons: [...reasons, 'NO_TEMPLATE_AVAILABLE'] };
  tpl = other;
}
const days = Math.min(Math.max(input.daysPerWeek, tpl.days.min), tpl.days.max);   // R-REC-5
if (days !== input.daysPerWeek) reasons.push('DAYS_ADJUSTED');
return { templateId: tpl.id, context, level: tpl.level, daysPerWeek: days, reasons };
```
**[décision plan]** `level` en sortie est celui du modèle retenu ; si aucun modèle n'est retenu, c'est le niveau issu de l'expérience.

`firstIncompleteStep` (index `ONBOARDING_STEPS.indexOf`, `validated(step)` = `lastValidatedStep !== null && idx(lastValidatedStep) >= idx(step)`) : `goal === null` → `goal` ; `!validated('sport')` → `sport` ; `!hasPrimaryPlace` → `place_kind` (le type choisi en E3 n'est pas stocké, la reprise repart de E3) ; `experience === null` → `experience` ; `daysPerWeek === null || sessionMinutes === null` → `availability` ; `!validated('health')` → `health` ; sinon `ready`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/domain test -- recommend-template onboarding` puis `pnpm typecheck`
Expected: PASS (240 cas de la table, 6 cas ciblés, 3 propriétés, 13 cas d'onboarding, availableGoals).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/profile.ts packages/contracts/src/index.ts packages/domain/src/recommend-template.ts packages/domain/src/onboarding.ts packages/domain/src/index.ts packages/domain/test/fixtures/templates.ts packages/domain/test/recommend-template.test.ts packages/domain/test/onboarding.test.ts
git commit -m "feat(profil): recommendTemplate et reprise de l'onboarding"
```

---

### Task 16: Profil d'entraînement et fin de l'onboarding côté serveur

**Files:**
- Modify: `packages/contracts/src/api/profile.ts` (ajout de `DAYS_PER_WEEK`, `SESSION_MINUTES`, `TrainingProfilePatch`)
- Create: `apps/server/src/profile/routes.ts`
- Modify: `apps/server/src/routes.ts` (une ligne : `app.route('/api/me', profileRoutes(deps))`)
- Create: `apps/server/test/support/onboarding.ts`
- Modify: `apps/server/test/support/index.ts` (ajouter `export * from './onboarding'`)
- Test: `apps/server/test/profile/training-profile.test.ts`, `apps/server/test/profile/onboarding-complete.test.ts`

**Interfaces:**
- Consumes : `AppDeps` (deps.ts T6), `AppEnv`, `SessionUser` (app-env.ts T6), `httpError` (http/errors.ts T6), `parseJson` (http/validate.ts T6), `writeStamp(trx, deps, actorId)` (db/rev.ts T4), `requireUser` (auth/session.ts T9), `buildMe(db, deps, userId): Promise<MeResponse>` (auth/me.ts T10), `MeResponse`, `OnboardingStep` (api/auth.ts T10), `ageBandOn`, `parisDate` (domain T2), `availableGoals`, `firstIncompleteStep` (T15), `Goal`, `Experience` (T15), `SportCodeSchema`, `SPORT_OTHER_LABEL_MAX` (T14), `defaultLoadSettings` (T14), `createTestContext`, `TestContext`, `insertFixtureRow` (support T5/T6), `createUser`, `createUserAndLogin` (support T10).
- Produces :
```ts
// packages/contracts/src/api/profile.ts [T16]
export const DAYS_PER_WEEK = [2, 3, 4] as const; export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;
export const TrainingProfilePatch = z.strictObject({ goal: Goal.optional(), experience: Experience.optional(),
  daysPerWeek: z.literal(DAYS_PER_WEEK).optional(), sessionMinutes: z.literal(SESSION_MINUTES).optional(),
  sportCode: SportCodeSchema.nullable().optional(), sportOtherLabel: z.string().trim().min(1).max(40).nullable().optional(),
  cautiousMode: z.boolean().optional(), onboardingStep: OnboardingStep.optional() });
export type TrainingProfilePatch = z.infer<typeof TrainingProfilePatch>;
// apps/server/src/profile/routes.ts
export function profileRoutes(deps: AppDeps): Hono<AppEnv>;  // PATCH /training-profile, POST /onboarding/complete (monté sur /api/me)
// apps/server/test/support/onboarding.ts
export async function completeOnboarding(ctx: TestContext, user: { id: string; cookie: string }): Promise<{ placeId: string }>;
// remplit le profil (muscle, none, 3 j, 45 min, onboardingStep 'health'), insère un lieu maison principal par insertFixtureRow, appelle POST /api/me/onboarding/complete (attend 200)
```
- Routes : `PATCH /api/me/training-profile` → 200 `MeResponse` ; `POST /api/me/onboarding/complete` → 200 `MeResponse`, ou 409 `{ error: 'onboarding_incomplete', step: OnboardingStep }`.

**Spec:** 02 R-ONB-1 à R-ONB-3, 02 §8 E1, E2, E5, E6, 02 R-AGE-5, R-AGE-6, R-CST-7, 02 §15 n°11, 03 P-MIN-8, décision plan (3) et (4) du modèle.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/profile/training-profile.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';

let ctx: TestContext;
beforeEach(async () => { ctx = await createTestContext(); });   // horloge 2026-10-06T10:00:00.000Z
afterEach(() => ctx.close());
const patch = (cookie: string, json: unknown) => ctx.request('/api/me/training-profile', { method: 'PATCH', json, cookie });
const row = (id: string) => ctx.deps.db.selectFrom('trainingProfile').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const me = async (cookie: string) => (await ctx.request('/api/me', { cookie })).json();

describe('PATCH /api/me/training-profile', () => {
  it('crée la ligne (id = owner_id) au premier appel puis met à jour champ par champ', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { goal: 'muscle', onboardingStep: 'goal' })).status).toBe(200);
    const r1 = await row(u.id);
    expect(r1).toMatchObject({ id: u.id, ownerId: u.id, goal: 'muscle', experience: null, daysPerWeek: null, sessionMinutes: null,
      sportCode: null, sportOtherLabel: null, cautiousMode: 0, updatedBy: u.id, deletedAt: null });
    expect((await patch(u.cookie, { experience: 'lt_6_months', daysPerWeek: 3, sessionMinutes: 45 })).status).toBe(200);
    const r2 = await row(u.id);
    expect(r2).toMatchObject({ goal: 'muscle', experience: 'lt_6_months', daysPerWeek: 3, sessionMinutes: 45 });
    expect(r2.rev).toBeGreaterThan(r1.rev);
    const user = await ctx.deps.db.selectFrom('user').select('onboardingStep').where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(user.onboardingStep).toBe('goal');
  });
  it('un corps avec seulement onboardingStep crée la ligne vide et enregistre l’étape', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { onboardingStep: 'place_kind' })).status).toBe(200);
    expect((await row(u.id)).goal).toBeNull();
  });
  it('un corps sans changement ne crée pas de nouveau rev', async () => {
    const u = await createUserAndLogin(ctx);
    await patch(u.cookie, { goal: 'fitness' });
    const r1 = await row(u.id);
    await patch(u.cookie, { goal: 'fitness' });
    expect((await row(u.id)).rev).toBe(r1.rev);
  });
  it.each([
    [{ daysPerWeek: 5 }], [{ daysPerWeek: 1 }], [{ sessionMinutes: 50 }], [{ goal: 'cardio' }], [{ experience: 'expert' }],
    [{ sportCode: 'golf' }], [{ unknown: 1 }],
  ])('400 validation pour %o', async (body) => {
    const u = await createUserAndLogin(ctx);
    const res = await patch(u.cookie, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation');
  });
  it('fat_loss refusé pour un mineur, accepté pour un majeur (E1)', async () => {
    const minor = await createUserAndLogin(ctx, { birthDate: '2009-10-07' });   // 16 ans
    const res = await patch(minor.cookie, { goal: 'fat_loss' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation');
    const adult = await createUserAndLogin(ctx);
    expect((await patch(adult.cookie, { goal: 'fat_loss' })).status).toBe(200);
  });
  it('E2 : sport_support à l’étape sport exige un sportCode', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { goal: 'sport_support', onboardingStep: 'goal' })).status).toBe(200);
    expect((await patch(u.cookie, { sportCode: null, onboardingStep: 'sport' })).status).toBe(400);
    expect((await patch(u.cookie, { sportCode: 'tennis', onboardingStep: 'sport' })).status).toBe(200);
    expect((await row(u.id)).sportCode).toBe('tennis');
  });
  it('sportOtherLabel : 40 caractères, seulement avec other, effacé si le sport change', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await patch(u.cookie, { sportCode: 'tennis', sportOtherLabel: 'Ultimate' })).status).toBe(400);
    expect((await patch(u.cookie, { sportCode: 'other', sportOtherLabel: 'x'.repeat(41) })).status).toBe(400);
    expect((await patch(u.cookie, { sportCode: 'other', sportOtherLabel: 'Ultimate' })).status).toBe(200);
    expect((await row(u.id)).sportOtherLabel).toBe('Ultimate');
    expect((await patch(u.cookie, { sportCode: 'rugby' })).status).toBe(200);
    expect((await row(u.id)).sportOtherLabel).toBeNull();
  });
  it('mode prudent modifiable par tous ; cautious suit cautious_mode pour un majeur (R-CST-7)', async () => {
    const u = await createUserAndLogin(ctx);
    await patch(u.cookie, { cautiousMode: true });
    expect((await me(u.cookie)).cautious).toBe(true);
    await patch(u.cookie, { cautiousMode: false });
    expect((await me(u.cookie)).cautious).toBe(false);
    expect((await row(u.id)).cautiousMode).toBe(0);
  });
  it('mineur : cautious vrai sans mode prudent ni consentement ; à 18 ans rien ne s’active seul (R-AGE-6)', async () => {
    const u = await createUserAndLogin(ctx, { birthDate: '2008-10-07' });     // 17 ans le 2026-10-06
    await patch(u.cookie, { goal: 'muscle', cautiousMode: false });
    expect(await me(u.cookie)).toMatchObject({ ageBand: 'minor', cautious: true });
    ctx.clock.set('2026-10-06T22:30:00.000Z');                                 // 00:30 le 7 octobre à Paris
    expect(await me(u.cookie)).toMatchObject({ ageBand: 'adult', cautious: false });
    expect(await row(u.id)).toMatchObject({ goal: 'muscle', cautiousMode: 0 });
    expect((await patch(u.cookie, { goal: 'fat_loss' })).status).toBe(200);
  });
  it('401 sans session', async () => {
    expect((await ctx.request('/api/me/training-profile', { method: 'PATCH', json: { goal: 'muscle' } })).status).toBe(401);
  });
});
```

```ts
// apps/server/test/profile/onboarding-complete.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultLoadSettings } from '@appsport/contracts';
import { completeOnboarding, createTestContext, createUserAndLogin, insertFixtureRow, type TestContext } from '@appsport/server/testing';

let ctx: TestContext;
beforeEach(async () => { ctx = await createTestContext(); });
afterEach(() => ctx.close());
const complete = (cookie: string) => ctx.request('/api/me/onboarding/complete', { method: 'POST', json: {}, cookie });
const patch = (cookie: string, json: unknown) => ctx.request('/api/me/training-profile', { method: 'PATCH', json, cookie });
const fillProfile = (cookie: string, step = 'health') =>
  patch(cookie, { goal: 'muscle', experience: 'none', daysPerWeek: 3, sessionMinutes: 45, onboardingStep: step });
const addHome = (ownerId: string) => insertFixtureRow(ctx.deps.db, 'place', { ownerId, kind: 'home', name: 'Maison', isPrimary: 1,
  visibleAtGym: 0, gymId: null, loadSettings: JSON.stringify(defaultLoadSettings('home')) });

describe('POST /api/me/onboarding/complete (R-ONB-1)', () => {
  it('409 onboarding_incomplete avec la première étape incomplète', async () => {
    const u = await createUserAndLogin(ctx);
    let res = await complete(u.cookie);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'onboarding_incomplete', step: 'goal' });
    await fillProfile(u.cookie);
    res = await complete(u.cookie);
    expect(await res.json()).toEqual({ error: 'onboarding_incomplete', step: 'place_kind' });   // pas de lieu principal
    await addHome(u.id);
    await fillProfile(u.cookie, 'availability');
    res = await complete(u.cookie);
    expect(await res.json()).toEqual({ error: 'onboarding_incomplete', step: 'health' });
  });
  it('profil complet + lieu principal + E7 validé → onboardingCompletedAt, idempotent', async () => {
    const u = await createUserAndLogin(ctx);
    await fillProfile(u.cookie);
    await addHome(u.id);
    const res = await complete(u.cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).onboardingCompletedAt).toBe('2026-10-06T10:00:00.000Z');
    ctx.clock.advance(60_000);
    expect((await (await complete(u.cookie)).json()).onboardingCompletedAt).toBe('2026-10-06T10:00:00.000Z');
  });
  it('après la fin de l’onboarding, onboardingStep est ignoré mais le profil reste modifiable (R-ONB-3)', async () => {
    const u = await createUserAndLogin(ctx);
    await completeOnboarding(ctx, u);
    expect((await patch(u.cookie, { goal: 'strength', onboardingStep: 'goal' })).status).toBe(200);
    const user = await ctx.deps.db.selectFrom('user').select('onboardingStep').where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(user.onboardingStep).toBe('health');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/server test -- training-profile onboarding-complete`
Expected: FAIL, les routes renvoient 404 et `completeOnboarding` n'est pas exporté par `@appsport/server/testing`.

- [ ] **Step 3: Implement**

`profileRoutes(deps)` : nouveau `Hono<AppEnv>`, `requireUser` posé sur chaque route (`r.patch('/training-profile', requireUser, handler)`), jamais `r.use('*')` (d'autres routeurs partagent le préfixe `/api/me`).

PATCH, dans une transaction `deps.db.transaction().execute(trx => …)` :
1. `parseJson(c, TrainingProfilePatch)` ; lire la ligne `training_profile` (id = user.id) et `user.onboarding_completed_at`.
2. Calculer l'état fusionné (ligne existante + champs présents). Règles métier → `httpError('validation', { field })` :
   - `goal` hors de `availableGoals(ageBandOn(user.birthDate, parisDate(deps.clock.now())))` → `field: 'goal'` ;
   - `onboardingStep === 'sport'` et objectif fusionné `sport_support` et `sportCode` fusionné nul → `field: 'sportCode'` ;
   - `sportOtherLabel` non nul fourni alors que le `sportCode` fusionné ≠ `other` → `field: 'sportOtherLabel'` ; si le `sportCode` fusionné ≠ `other`, la colonne `sport_other_label` est écrite à NULL.
3. Ligne absente : insertion `{ id: user.id, ownerId: user.id, cautiousMode: 0, colonnes de contenu NULL sauf celles du patch, rev/createdAt/updatedAt/updatedBy de writeStamp(trx, deps, user.id), deletedAt: null }`. Ligne présente : mise à jour des seules colonnes qui changent, avec un nouveau `writeStamp` ; aucune écriture si rien ne change. `cautiousMode` est stocké en 0/1.
4. `onboardingStep` présent et `onboarding_completed_at` NULL : `UPDATE user SET onboarding_step`, avec `rev`, `updated_at`, `updated_by` d'un `writeStamp` distinct.
5. Répondre `c.json(await buildMe(trx, deps, user.id))`.

POST `/onboarding/complete` (transaction) : lire le profil, `hasPrimaryPlace` (= un `place` du propriétaire avec `deleted_at IS NULL AND is_primary = 1`) et `user.onboarding_step` ; `step = firstIncompleteStep(...)` ; si `step !== 'ready'` → `httpError('onboarding_incomplete', { step })`. Si `onboarding_completed_at` est NULL, l'écrire avec `deps.clock.now().toISOString()` et un `writeStamp` sur la ligne `user`. Répondre `buildMe`.

`completeOnboarding` (support de test) : appelle `fillProfile` avec `onboardingStep: 'health'`, insère le lieu maison principal comme dans le test (clés camelCase), POST complete, vérifie 200 (sinon `throw`), renvoie `{ placeId }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/server test -- training-profile onboarding-complete` puis `pnpm typecheck`
Expected: PASS, tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/profile.ts apps/server/src/profile/routes.ts apps/server/src/routes.ts apps/server/test/support/onboarding.ts apps/server/test/support/index.ts apps/server/test/profile/training-profile.test.ts apps/server/test/profile/onboarding-complete.test.ts
git commit -m "feat(profil): profil d'entraînement et fin de l'onboarding"
```

---

### Task 17: Salles partagées (création, doublons, droits, matériel, historique, visibilité, suppression)

**Files:**
- Create: `packages/contracts/src/api/places.ts` (partie salles)
- Modify: `packages/contracts/src/index.ts` (ajouter `export * from './api/places'`)
- Create: `apps/server/src/places/place-rows.ts`
- Create: `apps/server/src/places/gyms.ts`
- Create: `apps/server/src/places/gym-routes.ts`
- Modify: `apps/server/src/admin/routes.ts` (une route : `DELETE /gyms/:id`)
- Modify: `apps/server/src/routes.ts` (une ligne : `app.route('/api/gyms', gymRoutes(deps))`)
- Test: `apps/server/test/places/gyms.test.ts`

**Interfaces:**
- Consumes : `AppDeps`, `AppEnv`, `SessionUser`, `httpError`, `parseJson`, `parseQuery`, `clientIp` (T6), `writeStamp` (T4), `DbExecutor`, `Database` (T4), `requireUser`, `requireAdmin` (T9), `logSecurityEvent` (T9, type `gym_deleted`), le routeur admin de T12 (`adminRoutes(deps)`, monté sur `/api/admin`), `normalize`, `ageBandOn`, `parisDate` (domain), `EquipmentCodeSchema`, `EQUIPMENT`, `EQUIPMENT_CATEGORIES`, `LoadSettings`, `defaultLoadSettings` (T14), `createTestContext`, `createUserAndLogin` (support).
- Produces :
```ts
// packages/contracts/src/api/places.ts [T17]
export const GymEquipmentCode: z.ZodType<EquipmentCode>;   // EquipmentCodeSchema sans les codes household (R-EQ-3)
export const GymHistoryAction = z.enum(['create','update_info','add_equipment','remove_equipment','update_load_settings']);
export const GymSummary = z.object({ id: z.string(), name: z.string(), city: z.string(), visibleMemberCount: z.number().int() });
export const GymDetail = z.object({ id: z.string(), name: z.string(), city: z.string(), loadSettings: LoadSettings, deletedAt: z.string().nullable(),
  equipment: z.array(EquipmentCodeSchema), canEdit: z.boolean(), visibleMembers: z.array(z.string()),
  history: z.array(z.object({ at: z.string(), action: GymHistoryAction, authorUsername: z.string().nullable(), detail: z.unknown() })) });
export const CreateGymRequest = z.strictObject({ name: z.string().trim().min(2).max(60), city: z.string().trim().min(2).max(60),
  equipment: z.array(GymEquipmentCode), isPrimary: z.boolean(), visibleAtGym: z.boolean().optional() });
export const CreateGymResponse = z.object({ gymId: z.string(), placeId: z.string() });
export const UpdateGymRequest = z.strictObject({ name: …optional(), city: …optional(), loadSettings: LoadSettings.optional() })
  .refine((v) => Object.keys(v).length > 0);
// (chaque schéma avec son type du même nom)
// apps/server/src/places/place-rows.ts
export async function demotePrimaries(trx: DbExecutor, deps: AppDeps, userId: string, exceptPlaceId?: string): Promise<void>;
// is_primary = 0, nouveau rev, sur les lieux actifs principaux de l'utilisateur (sauf exceptPlaceId)
export async function insertGymPlace(trx: DbExecutor, deps: AppDeps, user: SessionUser,
  o: { gymId: string; isPrimary: boolean; visibleAtGym?: boolean }): Promise<string>;
// 409 place_exists si un lieu actif renvoie déjà à cette salle ; visibleAtGym par défaut : majeur true, mineur false ;
// aucun lieu actif → principal d'office ; isPrimary → demotePrimaries avant l'insertion
// apps/server/src/places/gyms.ts
export async function deleteGymAsAdmin(trx: DbExecutor, deps: AppDeps, actor: { actorId: string; ip: string | null }, gymId: string): Promise<void>;
// apps/server/src/places/gym-routes.ts
export function gymRoutes(deps: AppDeps): Hono<AppEnv>;
```
- Routes : `GET /api/gyms?q=` → `GymSummary[]` ; `GET /api/gyms/similar?name=&city=` → `GymSummary[]` ; `POST /api/gyms` → 201 `CreateGymResponse`, 409 `{error:'gym_duplicate', gymId}` ; `GET /api/gyms/:id` → `GymDetail` ; `PATCH /api/gyms/:id` → 204 ; `PUT|DELETE /api/gyms/:id/equipment/:code` → 204 ; `DELETE /api/admin/gyms/:id` → 204, 409 `gym_in_use`.

**Spec:** 02 R-SAL-1 à R-SAL-7, R-CHG-1, R-CHG-3, R-VIS-1 à R-VIS-5, R-EQ-3, 03 P-MIN-6, 01 R-SYN-3 et R-SYN-21 (gym et gym_equipment en C0, rev serveur), 02 §15 n°15, 16, 17.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/places/gyms.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultLoadSettings } from '@appsport/contracts';
import { createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';

let ctx: TestContext;
beforeEach(async () => { ctx = await createTestContext(); });
afterEach(() => ctx.close());
type U = { id: string; cookie: string; password: string };
const createGym = (u: U, body: Record<string, unknown> = {}) => ctx.request('/api/gyms', { method: 'POST', cookie: u.cookie,
  json: { name: 'Basic-Fit Part-Dieu', city: 'Lyon', equipment: ['barbell', 'squat_rack'], isPrimary: true, ...body } });
const gymId = async (u: U, body?: Record<string, unknown>) => (await (await createGym(u, body)).json()).gymId as string;
const detail = async (u: U, id: string) => (await ctx.request(`/api/gyms/${id}`, { cookie: u.cookie })).json();
const put = (u: U, id: string, code: string) => ctx.request(`/api/gyms/${id}/equipment/${code}`, { method: 'PUT', json: {}, cookie: u.cookie });
const del = (u: U, id: string, code: string) => ctx.request(`/api/gyms/${id}/equipment/${code}`, { method: 'DELETE', cookie: u.cookie });
const db = () => ctx.deps.db;

describe('création (R-SAL-2, R-SAL-3, R-CHG-1)', () => {
  it('normalise, pose les réglages par défaut, le matériel, l’historique et le lieu du créateur', async () => {
    const a = await createUserAndLogin(ctx);
    const res = await createGym(a);
    expect(res.status).toBe(201);
    const { gymId: id, placeId } = await res.json();
    const gym = await db().selectFrom('gym').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(gym).toMatchObject({ name: 'Basic-Fit Part-Dieu', nameKey: 'basic fit part dieu', city: 'Lyon', cityKey: 'lyon', createdBy: a.id, deletedAt: null });
    expect(JSON.parse(gym.loadSettings)).toEqual(defaultLoadSettings('gym'));
    const eq = await db().selectFrom('gymEquipment').selectAll().where('gymId', '=', id).orderBy('id').execute();
    expect(eq.map((e) => [e.id, e.equipmentCode, e.addedBy, e.deletedAt])).toEqual([[`${id}:barbell`, 'barbell', a.id, null], [`${id}:squat_rack`, 'squat_rack', a.id, null]]);
    const place = await db().selectFrom('place').selectAll().where('id', '=', placeId).executeTakeFirstOrThrow();
    expect(place).toMatchObject({ ownerId: a.id, kind: 'gym', gymId: id, isPrimary: 1, visibleAtGym: 1, loadSettings: null, name: null });
    const hist = await db().selectFrom('gymHistory').selectAll().where('gymId', '=', id).execute();
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ action: 'create', authorId: a.id });
  });
  it('doublon exact après normalisation → 409 gym_duplicate {gymId}', async () => {
    const a = await createUserAndLogin(ctx);
    const id = await gymId(a);
    const res = await createGym(a, { name: 'BASIC FIT  part-dieu', city: ' lyon ' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'gym_duplicate', gymId: id });
  });
  it('codes household refusés pour une salle (R-EQ-3)', async () => {
    const a = await createUserAndLogin(ctx);
    expect((await createGym(a, { equipment: ['chair'] })).status).toBe(400);
    const id = await gymId(a);
    expect((await put(a, id, 'table')).status).toBe(400);
    expect((await put(a, id, 'cardio')).status).toBe(400);
  });
  it('nom ou ville hors de 2..60 caractères → 400', async () => {
    const a = await createUserAndLogin(ctx);
    expect((await createGym(a, { name: 'X' })).status).toBe(400);
    expect((await createGym(a, { city: 'y'.repeat(61) })).status).toBe(400);
  });
  it('mineur : lieu créé invisible par défaut, visible s’il le demande (P-MIN-6)', async () => {
    const m = await createUserAndLogin(ctx, { birthDate: '2009-10-07' });
    const { placeId } = await (await createGym(m)).json();
    expect((await db().selectFrom('place').select('visibleAtGym').where('id', '=', placeId).executeTakeFirstOrThrow()).visibleAtGym).toBe(0);
    const { placeId: p2 } = await (await createGym(m, { name: 'Keep Cool', visibleAtGym: true })).json();
    expect((await db().selectFrom('place').select('visibleAtGym').where('id', '=', p2).executeTakeFirstOrThrow()).visibleAtGym).toBe(1);
  });
});

describe('recherche (R-SAL-1, R-SAL-3)', () => {
  it('GET /api/gyms?q= et /similar par inclusion après normalisation', async () => {
    const a = await createUserAndLogin(ctx);
    const id = await gymId(a);
    const ids = async (path: string) => ((await (await ctx.request(path, { cookie: a.cookie })).json()) as { id: string }[]).map((g) => g.id);
    expect(await ids('/api/gyms')).toEqual([id]);
    expect(await ids('/api/gyms?q=PART')).toEqual([id]);
    expect(await ids('/api/gyms?q=marseille')).toEqual([]);
    expect(await ids('/api/gyms/similar?name=basic%20fit&city=Villeurbanne')).toEqual([id]);
    expect(await ids('/api/gyms/similar?name=Fitness%20Park&city=LYON')).toEqual([id]);
    expect(await ids('/api/gyms/similar?name=Keep%20Cool&city=Paris')).toEqual([]);
  });
});

describe('droits (R-SAL-4, 02 §15 n°15)', () => {
  it('membre sans la salle parmi ses lieux actifs → 403 ; admin → OK ; salle inconnue → 404', async () => {
    const a = await createUserAndLogin(ctx);
    const b = await createUserAndLogin(ctx);
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const id = await gymId(a);
    const r = await ctx.request(`/api/gyms/${id}`, { method: 'PATCH', json: { city: 'Lyon 3e' }, cookie: b.cookie });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('forbidden');
    expect((await put(b, id, 'dumbbells')).status).toBe(403);
    expect((await ctx.request(`/api/gyms/${id}`, { method: 'PATCH', json: { city: 'Lyon 3e' }, cookie: admin.cookie })).status).toBe(204);
    expect((await detail(b, id)).canEdit).toBe(false);
    expect((await detail(a, id)).canEdit).toBe(true);
    expect((await ctx.request('/api/gyms/0190a000-0000-7000-8000-000000000000', { cookie: a.cookie })).status).toBe(404);
  });
});

describe('matériel (R-SAL-5)', () => {
  it('ajout idempotent, retrait = tombstone, ré-ajout = upsert ; historique', async () => {
    const a = await createUserAndLogin(ctx);
    const id = await gymId(a);
    const eqRow = () => db().selectFrom('gymEquipment').selectAll().where('id', '=', `${id}:dumbbells`).executeTakeFirstOrThrow();
    expect((await put(a, id, 'dumbbells')).status).toBe(204);
    const r1 = await eqRow();
    expect((await put(a, id, 'dumbbells')).status).toBe(204);
    expect((await eqRow()).rev).toBe(r1.rev);
    expect((await del(a, id, 'dumbbells')).status).toBe(204);
    const r2 = await eqRow();
    expect(r2.deletedAt).not.toBeNull();
    expect(r2.rev).toBeGreaterThan(r1.rev);
    expect((await del(a, id, 'dumbbells')).status).toBe(204);
    expect((await eqRow()).rev).toBe(r2.rev);
    expect((await put(a, id, 'dumbbells')).status).toBe(204);
    expect((await eqRow()).deletedAt).toBeNull();
    expect((await detail(a, id)).equipment).toEqual(['dumbbells', 'squat_rack', 'barbell']);   // ordre de EQUIPMENT
    const actions = (await db().selectFrom('gymHistory').select('action').where('gymId', '=', id).orderBy('at').orderBy('id').execute()).map((h) => h.action);
    expect(actions).toEqual(['create', 'add_equipment', 'remove_equipment', 'add_equipment']);
  });
  it('deux ajouts simultanés donnent l’union', async () => {
    const a = await createUserAndLogin(ctx);
    const id = await gymId(a, { equipment: [] });
    const [r1, r2] = await Promise.all([put(a, id, 'leg_press'), put(a, id, 'lat_pulldown')]);
    expect([r1.status, r2.status]).toEqual([204, 204]);
    expect((await detail(a, id)).equipment).toEqual(['lat_pulldown', 'leg_press']);
  });
});

describe('modification et historique (R-SAL-5, R-SAL-6, R-CHG-3)', () => {
  it('nom, ville et réglages : dernière écriture gagnante, clés recalculées, bornes, doublon', async () => {
    const a = await createUserAndLogin(ctx);
    const id = await gymId(a);
    await gymId(a, { name: 'Keep Cool', city: 'Lyon' });
    const patch = (json: unknown) => ctx.request(`/api/gyms/${id}`, { method: 'PATCH', json, cookie: a.cookie });
    expect((await patch({ name: 'Basic Fit Gerland' })).status).toBe(204);
    expect((await db().selectFrom('gym').select('nameKey').where('id', '=', id).executeTakeFirstOrThrow()).nameKey).toBe('basic fit gerland');
    expect((await patch({ name: 'KEEP-COOL' })).status).toBe(409);
    expect((await patch({ loadSettings: { ...defaultLoadSettings('gym'), barG: 30000 } })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ loadSettings: { ...defaultLoadSettings('gym'), barG: 15000 } })).status).toBe(204);
    expect((await detail(a, id)).loadSettings.barG).toBe(15000);
  });
  it('les 10 dernières lignes, auteur « ancien membre » (null) après suppression du compte', async () => {
    const a = await createUserAndLogin(ctx);
    const b = await createUserAndLogin(ctx);
    const id = await gymId(b);
    for (let i = 0; i < 12; i++) {
      ctx.clock.advance(1000);
      await ctx.request(`/api/gyms/${id}`, { method: 'PATCH', json: { city: `Lyon ${i}` }, cookie: i % 2 ? a.cookie : b.cookie });
    }
    expect((await ctx.request('/api/me/delete', { method: 'POST', json: { password: b.password }, cookie: b.cookie })).status).toBe(204);
    const h = (await detail(a, id)).history;
    expect(h).toHaveLength(10);
    expect(h[0]).toMatchObject({ action: 'update_info', detail: { city: { from: 'Lyon 10', to: 'Lyon 11' } } });
    expect(h[0].authorUsername).toBe((await ctx.request('/api/me', { cookie: a.cookie }).then((r) => r.json())).username);
    expect(h[1].authorUsername).toBeNull();
  });
});

describe('qui va à cette salle (R-VIS-1 à R-VIS-5, 02 §15 n°17)', () => {
  it('ni invisible, ni désactivé, ni supprimé ne sont listés ou comptés', async () => {
    const visible = await createUserAndLogin(ctx, { username: 'lea' });
    const id = await gymId(visible);
    const minor = await createUserAndLogin(ctx, { birthDate: '2009-10-07' });
    const hidden = await createUserAndLogin(ctx);
    const disabled = await createUserAndLogin(ctx);
    const deleted = await createUserAndLogin(ctx);
    const join = (u: U, body = {}) => ctx.request('/api/places', { method: 'POST', cookie: u.cookie, json: { kind: 'gym', gymId: id, isPrimary: true, ...body } });
    // T18 n'existe pas encore : insertion directe du lieu par insertGymPlace via une salle créée en doublon impossible → on passe par la base
    for (const [u, vis] of [[minor, 0], [hidden, 0], [disabled, 1], [deleted, 1]] as const)
      await ctx.deps.db.insertInto('place').values({ id: crypto.randomUUID(), ownerId: u.id, kind: 'gym', gymId: id, name: null, isPrimary: 1,
        visibleAtGym: vis, loadSettings: null, rev: 1, createdAt: '2026-10-06T10:00:00.000Z', updatedAt: '2026-10-06T10:00:00.000Z', updatedBy: u.id, deletedAt: null }).execute();
    void join;
    await ctx.deps.db.updateTable('user').set({ status: 'disabled' }).where('id', '=', disabled.id).execute();
    await ctx.request('/api/me/delete', { method: 'POST', json: { password: deleted.password }, cookie: deleted.cookie });
    expect((await detail(visible, id)).visibleMembers).toEqual(['lea']);
    const list = await (await ctx.request('/api/gyms', { cookie: visible.cookie })).json();
    expect(list[0].visibleMemberCount).toBe(1);
  });
});

describe('suppression par l’admin (R-SAL-7)', () => {
  it('409 gym_in_use si un lieu actif y renvoie, sinon tombstone + security_event gym_deleted', async () => {
    const a = await createUserAndLogin(ctx);
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const { gymId: id, placeId } = await (await createGym(a)).json();
    const delGym = (u: U) => ctx.request(`/api/admin/gyms/${id}`, { method: 'DELETE', cookie: u.cookie });
    expect((await delGym(a)).status).toBe(403);
    const busy = await delGym(admin);
    expect(busy.status).toBe(409);
    expect((await busy.json()).error).toBe('gym_in_use');
    await db().updateTable('place').set({ deletedAt: '2026-10-06T10:00:00.000Z' }).where('id', '=', placeId).execute();
    const before = (await db().selectFrom('gym').select('rev').where('id', '=', id).executeTakeFirstOrThrow()).rev;
    expect((await delGym(admin)).status).toBe(204);
    const g = await db().selectFrom('gym').select(['deletedAt', 'rev']).where('id', '=', id).executeTakeFirstOrThrow();
    expect(g.deletedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(g.rev).toBeGreaterThan(before);
    const ev = await db().selectFrom('securityEvent').selectAll().where('type', '=', 'gym_deleted').executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ actorId: admin.id, targetId: id, outcome: 'success' });
    expect(await (await ctx.request('/api/gyms', { cookie: a.cookie })).json()).toEqual([]);
    expect((await detail(a, id)).deletedAt).toBe('2026-10-06T10:00:00.000Z');
    expect((await ctx.request(`/api/gyms/${id}`, { method: 'PATCH', json: { city: 'Lyon' }, cookie: admin.cookie })).status).toBe(404);
    expect((await delGym(admin)).status).toBe(404);
  });
});
```
(Dans le test « qui va à cette salle », supprimer la variable `join` et sa ligne `void join;` si biome la signale : l'insertion directe suffit, T18 n'existant pas encore.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/server test -- gyms`
Expected: FAIL, `POST /api/gyms` renvoie 404 (routeur absent).

- [ ] **Step 3: Implement**

`api/places.ts` : schémas ci-dessus ; `GymEquipmentCode = EquipmentCodeSchema.refine(c => !EQUIPMENT_CATEGORIES.household.includes(c))`. Les paramètres `:code` des routes sont validés avec `GymEquipmentCode.safeParse` → `httpError('validation')`.

`gyms.ts` (toutes les écritures dans `deps.db.transaction()`, chaque ligne écrite reçoit son propre `writeStamp(trx, deps, actorId)`) :
- Recherche : salles `deleted_at IS NULL`, tri par `name_key`. `q` normalisé : inclus dans `name_key` ou `city_key` (`q` vide ou absent → toutes). `/similar` : `n = normalize(name)`, `v = normalize(city)` ; un critère dont la valeur normalisée fait moins de 2 caractères est ignoré ; une salle correspond si `name_key` contient `n` ou `n` contient `name_key`, ou si `city_key` contient `v` ou `v` contient `city_key`.
- `visibleMemberCount` et `visibleMembers` : lieux `deleted_at IS NULL AND kind = 'gym' AND visible_at_gym = 1` joints à `user.status = 'active'` ; pseudos triés.
- Création : contrôle du doublon `(name_key, city_key)` avant l'insertion, y compris contre une salle supprimée (la contrainte `UNIQUE` est globale) → `httpError('gym_duplicate', { gymId })`. Puis insertion de la salle (`loadSettings = JSON.stringify(defaultLoadSettings('gym'))`, `createdBy = updatedBy = user.id`), une ligne `gym_equipment` par code dédoublonné (`id = gymId + ':' + code`, `addedBy = user.id`), `gym_history` `create` avec `detail { name, city, equipment }`, puis `insertGymPlace`. Réponse 201.
- Droit d'édition : salle absente ou supprimée → 404 ; `user.role === 'admin'` ou un `place` actif de l'utilisateur avec ce `gym_id` → OK ; sinon `httpError('forbidden')`.
- PATCH : écrire seulement ce qui change ; `name`/`city` → clés recalculées, doublon avec une autre salle → 409 `gym_duplicate` ; un `gym_history` `update_info` avec `detail { name?: {from,to}, city?: {from,to} }` ; `loadSettings` → `update_load_settings` avec `detail { from, to }`.
- PUT matériel : ligne active → aucune écriture ; absente → insertion ; supprimée → `deleted_at = NULL`, `added_by = user.id`, nouveau rev ; history `add_equipment` `{ code }` seulement s'il y a écriture. DELETE : ligne active → `deleted_at = now`, nouveau rev, history `remove_equipment` ; sinon aucune écriture.
- GET détail : salle absente → 404 (une salle supprimée est renvoyée avec `deletedAt`) ; `equipment` actif dans l'ordre de `EQUIPMENT` ; `history` : 10 dernières lignes `ORDER BY at DESC, id DESC`, `LEFT JOIN user` sur `author_id` → `authorUsername` (null si l'auteur n'existe plus), `detail` = JSON parsé.
- `deleteGymAsAdmin` : absente ou déjà supprimée → 404 ; un `place` actif (tous utilisateurs) avec ce `gym_id` → `httpError('gym_in_use')` ; sinon `deleted_at = now` + `writeStamp`, puis `logSecurityEvent(trx, deps, { type: 'gym_deleted', actorId, targetId: gymId, ip, outcome: 'success' })`.

`place-rows.ts` : `insertGymPlace` insère `{ id: deps.ids.uuidv7(), ownerId: user.id, kind: 'gym', gymId, name: null, loadSettings: null, isPrimary, visibleAtGym: 0|1 }` ; l'âge vient de `ageBandOn(user.birthDate, parisDate(deps.clock.now()))`.

`gymRoutes(deps)` : `requireUser` sur chaque route ; `/similar` déclaré avant `/:id`. Dans `admin/routes.ts`, ajouter `r.delete('/gyms/:id', requireAdmin, …)` qui appelle `deleteGymAsAdmin` dans une transaction avec `{ actorId: c.get('user')!.id, ip: clientIp(c) }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/server test -- gyms` puis `pnpm typecheck` et `pnpm lint`
Expected: PASS, tous les tests verts.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/places.ts packages/contracts/src/index.ts apps/server/src/places/place-rows.ts apps/server/src/places/gyms.ts apps/server/src/places/gym-routes.ts apps/server/src/admin/routes.ts apps/server/src/routes.ts apps/server/test/places/gyms.test.ts
git commit -m "feat(salles): salles partagées, matériel, historique et visibilité"
```

---

### Task 18: Lieux de l'utilisateur (salle et maison, lieu principal, suppression)

**Files:**
- Modify: `packages/contracts/src/api/places.ts` (partie lieux)
- Create: `apps/server/src/places/places.ts`
- Create: `apps/server/src/places/place-routes.ts`
- Modify: `apps/server/src/routes.ts` (une ligne : `app.route('/api/places', placeRoutes(deps))`)
- Test: `apps/server/test/places/places.test.ts`

**Interfaces:**
- Consumes : tout ce que consomme T17, plus `insertGymPlace`, `demotePrimaries` (place-rows.ts T17), `completeOnboarding` (support T16), `verifyUserPassword` non requis.
- Produces :
```ts
// packages/contracts/src/api/places.ts [T18]
export const CreatePlaceRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('gym'), gymId: z.string(), isPrimary: z.boolean(), visibleAtGym: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('home'), name: z.string().trim().min(1).max(30).optional(), equipment: z.array(EquipmentCodeSchema), isPrimary: z.boolean() }) ]);
export const CreatePlaceResponse = z.object({ id: z.string() });
export const UpdatePlaceRequest = z.strictObject({ name: z.string().trim().min(1).max(30).optional(), isPrimary: z.literal(true).optional(),
  visibleAtGym: z.boolean().optional(), loadSettings: LoadSettings.optional() }).refine((v) => Object.keys(v).length > 0);
export const DeletePlaceRequest = z.strictObject({ newPrimaryId: z.string().optional() });
export const HOME_PLACE_DEFAULT_NAME = 'Maison';
// apps/server/src/places/place-routes.ts
export function placeRoutes(deps: AppDeps): Hono<AppEnv>;
```
- Routes : `POST /api/places` → 201 `CreatePlaceResponse`, 409 `place_exists` ; `PATCH /api/places/:id` → 204 ; `DELETE /api/places/:id` (corps `DeletePlaceRequest`, `{}` par défaut côté client) → 204, 409 `last_place` ou `primary_required` ; `PUT|DELETE /api/places/:id/equipment/:code` → 204. Lieu d'un autre utilisateur ou supprimé → 404, même pour un admin.

**Spec:** 02 R-LIEU-1 à R-LIEU-5, R-VIS-3, R-CHG-1, R-CHG-3, R-EQ-3, R-EQ-4, 02 §8 E3/E4 (nom « Maison »), 03 P-ADM-2, 02 §15 n°14 et n°16.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/places/places.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultLoadSettings } from '@appsport/contracts';
import { completeOnboarding, createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';

let ctx: TestContext;
beforeEach(async () => { ctx = await createTestContext(); });
afterEach(() => ctx.close());
type U = { id: string; cookie: string };
const post = (u: U, json: unknown) => ctx.request('/api/places', { method: 'POST', json, cookie: u.cookie });
const home = async (u: U, body: Record<string, unknown> = {}) =>
  (await (await post(u, { kind: 'home', equipment: ['chair', 'table'], isPrimary: false, ...body })).json()).id as string;
const placeRow = (id: string) => ctx.deps.db.selectFrom('place').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
const primaries = async (ownerId: string) => (await ctx.deps.db.selectFrom('place').select('id')
  .where('ownerId', '=', ownerId).where('isPrimary', '=', 1).where('deletedAt', 'is', null).execute()).map((p) => p.id);
const newGym = async (u: U, name = 'Keep Cool') => (await (await ctx.request('/api/gyms', { method: 'POST', cookie: u.cookie,
  json: { name, city: 'Lyon', equipment: [], isPrimary: false } })).json()) as { gymId: string; placeId: string };

describe('lieu maison (R-LIEU-3, R-CHG-1)', () => {
  it('nom « Maison » par défaut, matériel home_equipment, réglages maison par défaut', async () => {
    const u = await createUserAndLogin(ctx);
    const res = await post(u, { kind: 'home', equipment: ['chair', 'table', 'dumbbells', 'dumbbells'], isPrimary: true });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const p = await placeRow(id);
    expect(p).toMatchObject({ ownerId: u.id, kind: 'home', name: 'Maison', gymId: null, isPrimary: 1, deletedAt: null });
    expect(JSON.parse(p.loadSettings!)).toEqual(defaultLoadSettings('home'));
    const eq = await ctx.deps.db.selectFrom('homeEquipment').selectAll().where('placeId', '=', id).orderBy('id').execute();
    expect(eq.map((e) => [e.id, e.ownerId, e.deletedAt])).toEqual([[`${id}:chair`, u.id, null], [`${id}:dumbbells`, u.id, null], [`${id}:table`, u.id, null]]);
  });
  it('nom de plus de 30 caractères → 400 ; plusieurs maisons possibles', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await post(u, { kind: 'home', name: 'x'.repeat(31), equipment: [], isPrimary: true })).status).toBe(400);
    await home(u, { name: 'Appartement' });
    await home(u, { name: 'Chalet' });
    expect((await ctx.deps.db.selectFrom('place').select('id').where('ownerId', '=', u.id).execute())).toHaveLength(2);
  });
  it('matériel maison : ajout et retrait idempotents ; interdit sur un lieu salle', async () => {
    const u = await createUserAndLogin(ctx);
    const id = await home(u);
    const put = (pid: string, code: string) => ctx.request(`/api/places/${pid}/equipment/${code}`, { method: 'PUT', json: {}, cookie: u.cookie });
    const del = (pid: string, code: string) => ctx.request(`/api/places/${pid}/equipment/${code}`, { method: 'DELETE', cookie: u.cookie });
    expect((await put(id, 'kettlebell')).status).toBe(204);
    expect((await put(id, 'kettlebell')).status).toBe(204);
    expect((await del(id, 'chair')).status).toBe(204);
    expect((await del(id, 'chair')).status).toBe(204);
    const rows = await ctx.deps.db.selectFrom('homeEquipment').select(['equipmentCode', 'deletedAt']).where('placeId', '=', id).execute();
    expect(rows.filter((r) => r.deletedAt === null).map((r) => r.equipmentCode).sort()).toEqual(['kettlebell', 'table']);
    const { placeId } = await newGym(u);
    expect((await put(placeId, 'dumbbells')).status).toBe(400);
  });
});

describe('lieu salle (R-LIEU-2, R-VIS-3)', () => {
  it('un seul lieu actif par salle → 409 place_exists ; salle inconnue → 404', async () => {
    const a = await createUserAndLogin(ctx);
    const b = await createUserAndLogin(ctx);
    const { gymId } = await newGym(a);
    expect((await post(b, { kind: 'gym', gymId, isPrimary: false })).status).toBe(201);
    const dup = await post(b, { kind: 'gym', gymId, isPrimary: false });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('place_exists');
    expect((await post(b, { kind: 'gym', gymId: '0190a000-0000-7000-8000-000000000000', isPrimary: false })).status).toBe(404);
  });
  it('visibilité par défaut selon l’âge, modifiable ; interdite sur une maison', async () => {
    const a = await createUserAndLogin(ctx);
    const m = await createUserAndLogin(ctx, { birthDate: '2009-10-07' });
    const { gymId } = await newGym(a);
    const { id } = await (await post(m, { kind: 'gym', gymId, isPrimary: true })).json();
    expect((await placeRow(id)).visibleAtGym).toBe(0);
    expect((await ctx.request(`/api/places/${id}`, { method: 'PATCH', json: { visibleAtGym: true }, cookie: m.cookie })).status).toBe(204);
    expect((await placeRow(id)).visibleAtGym).toBe(1);
    const h = await home(m);
    expect((await ctx.request(`/api/places/${h}`, { method: 'PATCH', json: { visibleAtGym: true }, cookie: m.cookie })).status).toBe(400);
  });
  it('réglages de charge et nom refusés sur un lieu salle (R-CHG-3), acceptés sur une maison', async () => {
    const u = await createUserAndLogin(ctx);
    const { placeId } = await newGym(u);
    const patch = (id: string, json: unknown) => ctx.request(`/api/places/${id}`, { method: 'PATCH', json, cookie: u.cookie });
    expect((await patch(placeId, { loadSettings: defaultLoadSettings('home') })).status).toBe(400);
    expect((await patch(placeId, { name: 'Ma salle' })).status).toBe(400);
    const h = await home(u);
    expect((await patch(h, { loadSettings: { ...defaultLoadSettings('home'), dumbbellsG: [2000, 4000] } })).status).toBe(204);
    expect((await patch(h, { loadSettings: { ...defaultLoadSettings('home'), barG: 4999 } })).status).toBe(400);
    expect((await patch(h, { name: 'Appart' })).status).toBe(204);
    expect((await placeRow(h)).name).toBe('Appart');
  });
});

describe('lieu principal (R-LIEU-4)', () => {
  it('premier lieu principal d’office ; isPrimary déplace le principal dans la même transaction', async () => {
    const u = await createUserAndLogin(ctx);
    const h1 = await home(u, { isPrimary: false });
    expect(await primaries(u.id)).toEqual([h1]);
    const h2 = await home(u, { name: 'Chalet', isPrimary: true });
    expect(await primaries(u.id)).toEqual([h2]);
    expect((await ctx.request(`/api/places/${h1}`, { method: 'PATCH', json: { isPrimary: true }, cookie: u.cookie })).status).toBe(204);
    expect(await primaries(u.id)).toEqual([h1]);
    expect((await ctx.request(`/api/places/${h1}`, { method: 'PATCH', json: { isPrimary: false }, cookie: u.cookie })).status).toBe(400);
  });
});

describe('suppression (R-LIEU-1, R-LIEU-4, R-LIEU-5)', () => {
  const remove = (u: U, id: string, json: unknown = {}) => ctx.request(`/api/places/${id}`, { method: 'DELETE', json, cookie: u.cookie });
  it('dernier lieu actif après l’onboarding → 409 last_place', async () => {
    const u = await createUserAndLogin(ctx);
    const { placeId } = await completeOnboarding(ctx, u);
    const res = await remove(u, placeId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('last_place');
  });
  it('principal sans newPrimaryId → 409 primary_required ; avec → tombstone et nouveau principal', async () => {
    const u = await createUserAndLogin(ctx);
    const { placeId } = await completeOnboarding(ctx, u);
    const h2 = await home(u, { name: 'Chalet' });
    const res = await remove(u, placeId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('primary_required');
    expect((await remove(u, placeId, { newPrimaryId: placeId })).status).toBe(400);
    const before = (await placeRow(placeId)).rev;
    expect((await remove(u, placeId, { newPrimaryId: h2 })).status).toBe(204);
    const p = await placeRow(placeId);
    expect(p.deletedAt).toBe('2026-10-06T10:00:00.000Z');
    expect(p.isPrimary).toBe(0);
    expect(p.rev).toBeGreaterThan(before);
    expect(await primaries(u.id)).toEqual([h2]);
    expect((await remove(u, placeId)).status).toBe(404);
  });
  it('avant la fin de l’onboarding, le seul lieu peut être supprimé (retour sur E3/E4)', async () => {
    const u = await createUserAndLogin(ctx);
    const h = await home(u);
    expect((await remove(u, h)).status).toBe(204);
  });
  it('un lieu salle supprimé libère la salle (nouveau lieu possible)', async () => {
    const u = await createUserAndLogin(ctx);
    await home(u, { isPrimary: true });
    const { gymId, placeId } = await newGym(u);
    expect((await remove(u, placeId)).status).toBe(204);
    expect((await post(u, { kind: 'gym', gymId, isPrimary: false })).status).toBe(201);
  });
});

describe('lieu d’un autre utilisateur → 404, même pour un admin (P-ADM-2)', () => {
  it('PATCH, DELETE et matériel', async () => {
    const owner = await createUserAndLogin(ctx);
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    const id = await home(owner);
    for (const [method, path, json] of [['PATCH', `/api/places/${id}`, { name: 'X' }], ['DELETE', `/api/places/${id}`, {}],
      ['PUT', `/api/places/${id}/equipment/box`, {}], ['DELETE', `/api/places/${id}/equipment/chair`, undefined]] as const) {
      const res = await ctx.request(path, { method, json, cookie: admin.cookie });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe('not_found');
    }
    expect((await placeRow(id)).name).toBe('Maison');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/server test -- places`
Expected: FAIL, `POST /api/places` renvoie 404 (routeur absent).

- [ ] **Step 3: Implement**

`places.ts` (toutes les écritures en transaction, un `writeStamp` par ligne écrite) :
- Chargement d'un lieu : `id`, `owner_id = user.id`, `deleted_at IS NULL`, sinon `httpError('not_found')` (aucune exception admin).
- POST gym : salle absente ou supprimée → 404, puis `insertGymPlace`. POST home : `demotePrimaries` si `isPrimary`, ou principal d'office si aucun lieu actif ; insertion `{ kind: 'home', gymId: null, name: name ?? HOME_PLACE_DEFAULT_NAME, visibleAtGym: 0, loadSettings: JSON.stringify(defaultLoadSettings('home')) }` ; une ligne `home_equipment` par code dédoublonné (`id = placeId + ':' + code`, `+SYNC` avec `ownerId = user.id`). Les codes household sont admis (R-EQ-3, R-EQ-4).
- PATCH : `name` ou `loadSettings` sur un lieu `gym` → 400 `validation` ; `visibleAtGym` sur un lieu `home` → 400 ; `isPrimary: true` → `demotePrimaries(trx, deps, user.id, id)` puis `is_primary = 1` ; écrire seulement ce qui change.
- DELETE : `parseJson(c, DeletePlaceRequest)` ; `others` = autres lieux actifs du propriétaire. `others` vide et `user.onboarding_completed_at` non NULL → `httpError('last_place')`. Lieu principal et `others` non vide : `newPrimaryId` absent → `httpError('primary_required')` ; `newPrimaryId` hors de `others` → `httpError('validation', { field: 'newPrimaryId' })` ; sinon nouveau principal posé. Le lieu supprimé reçoit `deleted_at = now`, `is_primary = 0` et un nouveau rev. Son matériel n'est pas touché.
- Matériel maison : lieu `gym` → 400 ; code validé par `EquipmentCodeSchema` ; mêmes règles d'idempotence que `gym_equipment` en T17 (ligne active → aucune écriture ; supprimée → `deleted_at = NULL` + rev ; DELETE d'une ligne active → tombstone).

`placeRoutes(deps)` : `requireUser` sur chaque route.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/server test -- places` puis `pnpm --filter @appsport/server test -- gyms` (non-régression) et `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/places.ts apps/server/src/places/places.ts apps/server/src/places/place-routes.ts apps/server/src/routes.ts apps/server/test/places/places.test.ts
git commit -m "feat(salles): lieux salle et maison, lieu principal"
```

---

### Task 19: Consentement santé, questionnaire d'alerte, limitations et retrait

**Files:**
- Create: `packages/contracts/src/api/consent.ts`
- Modify: `packages/contracts/src/index.ts` (ajouter `export * from './api/consent'`)
- Create: `apps/server/src/privacy/consent.ts`
- Create: `apps/server/src/privacy/health-routes.ts`
- Modify: `apps/server/src/routes.ts` (une ligne : `app.route('/api/me', consentRoutes(deps))`)
- Test: `apps/server/test/privacy/consent.test.ts`, `apps/server/test/privacy/withdraw.test.ts`

**Interfaces:**
- Consumes : `AppDeps`, `AppEnv`, `httpError`, `parseJson`, `clientIp` (T6), `writeStamp`, `DbExecutor`, `Database`, `Migration` (T4), `SYNC_COLUMNS`, `entityRules`, `EntityRulesMap` (T5), `requireUser`, `logSecurityEvent` (T9 ; types `consent_granted`, `consent_revoked`), `ConsentType`, `getConsentState`, `isHealthConsentActive` (T10), `buildMe`, `verifyUserPassword` (T10), `HEALTH_CONSENT_TEXT`, `HEALTH_QUESTIONNAIRE` (T14), `createLogger` (logger.ts T6), `createTestContext`, `createUserAndLogin` (support).
- Produces :
```ts
// packages/contracts/src/api/consent.ts
export const BODY_AREAS = ['shoulder','elbow','wrist_hand','neck','upper_back','lower_back','hip','knee','ankle_foot','other'] as const;
export const BodyArea = z.enum(BODY_AREAS); export const BODY_AREA_LABELS: Record<BodyArea, string>;
export const LIMITATION_SIDES = ['left','right','both','not_applicable'] as const; export const LimitationSide = z.enum(LIMITATION_SIDES);
export const LIMITATION_SEVERITIES = ['mild','severe'] as const; export const LimitationSeverity = z.enum(LIMITATION_SEVERITIES);
export const LIMITATION_SIDE_LABELS: Record<LimitationSide, string>; export const LIMITATION_SEVERITY_LABELS: Record<LimitationSeverity, string>;
export const LIMITATION_NOTE_MAX = 200;
export const GrantConsentRequest = z.strictObject({ type: z.literal('health'), textVersion: z.string() });
export const WithdrawConsentRequest = z.strictObject({ type: z.literal('health'), password: z.string().min(1).max(128) });
export const HealthScreeningRequest = z.strictObject({ answers: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]), questionnaireVersion: z.string() });
export const HealthScreeningResponse = z.object({ caution: z.boolean() });
export const LimitationInput = z.strictObject({ bodyArea: BodyArea, side: LimitationSide, severity: LimitationSeverity,
  note: z.string().trim().max(200).nullable().optional(), active: z.boolean().optional() });
export const LimitationPatch = LimitationInput.partial().refine((v) => Object.keys(v).length > 0);
export const CreateLimitationResponse = z.object({ id: z.string() });
// apps/server/src/privacy/consent.ts
export async function grantConsent(trx: DbExecutor, deps: AppDeps, userId: string, type: ConsentType, textVersion: string, ip: string | null): Promise<void>;
export async function withdrawHealthConsent(trx: Transaction<Database>, deps: AppDeps, userId: string, actor: { actorId: string | null; ip: string | null }): Promise<void>;
// apps/server/src/privacy/health-routes.ts
export function consentRoutes(deps: AppDeps): Hono<AppEnv>;   // monté sur /api/me
```
- Routes : `POST /api/me/consents` → 200 `MeResponse` ; `POST /api/me/consents/withdraw` → 200 `MeResponse`, 401 `invalid_credentials` si le mot de passe est faux ; `PUT /api/me/health-screening` → 200 `HealthScreeningResponse` ; `POST /api/me/limitations` → 201 `CreateLimitationResponse` ; `PATCH|DELETE /api/me/limitations/:id` → 204. Sans consentement actif, les quatre dernières routes renvoient 403 `health_consent_required`.

**Spec:** 02 R-CST-1 à R-CST-8 (R-CST-6 : `majorOf` côté client ; R-CST-8 : brique 3), 03 P-CST-1 à P-CST-4, 02 §12 E7, 01 R-SYN-9 (côté retrait), 09 §8 « Retrait du consentement santé », 03 P-LOG-1, P-LOG-2, 03 §17 n°3, 4, 7, 02 §15 n°13, Review Focus 3 (valeur témoin C2 absente après retrait).

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/privacy/consent.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE } from '@appsport/contracts';
import { createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';

let ctx: TestContext;
beforeEach(async () => { ctx = await createTestContext(); });
afterEach(() => ctx.close());
type U = { id: string; cookie: string };
const grant = (u: U, textVersion = HEALTH_CONSENT_TEXT.version) => ctx.request('/api/me/consents', { method: 'POST', json: { type: 'health', textVersion }, cookie: u.cookie });
const screening = (u: U, answers: boolean[]) => ctx.request('/api/me/health-screening', { method: 'PUT', cookie: u.cookie,
  json: { answers, questionnaireVersion: HEALTH_QUESTIONNAIRE.version } });
const limitation = { bodyArea: 'knee', side: 'left', severity: 'mild', note: 'gêne en descente' };

describe('consentement santé (R-CST-1, P-CST-1)', () => {
  it('grant : consent_event + security_event consent_granted, MeResponse à jour', async () => {
    const u = await createUserAndLogin(ctx);
    const res = await grant(u);
    expect(res.status).toBe(200);
    expect((await res.json()).consents.health).toEqual({ active: true, textVersion: '1.0', at: '2026-10-06T10:00:00.000Z' });
    const ev = await ctx.deps.db.selectFrom('consentEvent').selectAll().where('ownerId', '=', u.id).execute();
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'health', action: 'grant', textVersion: '1.0', createdAt: '2026-10-06T10:00:00.000Z', updatedBy: u.id });
    const se = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'consent_granted').executeTakeFirstOrThrow();
    expect(se).toMatchObject({ actorId: u.id, targetId: u.id, outcome: 'success' });
    expect(JSON.parse(se.details!)).toEqual({ consentType: 'health' });
  });
  it('version de texte différente ou type ai_coach → 400 ; re-grant identique sans nouvel événement', async () => {
    const u = await createUserAndLogin(ctx);
    expect((await grant(u, '0.9')).status).toBe(400);
    expect((await ctx.request('/api/me/consents', { method: 'POST', json: { type: 'ai_coach', textVersion: '1.0' }, cookie: u.cookie })).status).toBe(400);
    await grant(u);
    await grant(u);
    expect(await ctx.deps.db.selectFrom('consentEvent').select('id').where('ownerId', '=', u.id).execute()).toHaveLength(1);
  });
});

describe('sans consentement actif → 403 health_consent_required (R-CST-4, P-CST-2)', () => {
  it('health-screening et limitations', async () => {
    const u = await createUserAndLogin(ctx);
    for (const res of [
      await screening(u, [false, false, false, false]),
      await ctx.request('/api/me/limitations', { method: 'POST', json: limitation, cookie: u.cookie }),
      await ctx.request('/api/me/limitations/0190a000-0000-7000-8000-000000000000', { method: 'PATCH', json: { severity: 'severe' }, cookie: u.cookie }),
      await ctx.request('/api/me/limitations/0190a000-0000-7000-8000-000000000000', { method: 'DELETE', cookie: u.cookie }),
    ]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'health_consent_required' });
    }
    expect(await ctx.deps.db.selectFrom('healthScreening').select('id').execute()).toEqual([]);
  });
});

describe('questionnaire d’alerte (E7)', () => {
  it('n’enregistre que caution, la version et la date ; caution vrai si au moins un oui', async () => {
    const u = await createUserAndLogin(ctx);
    await grant(u);
    let res = await screening(u, [false, false, false, false]);
    expect(await res.json()).toEqual({ caution: false });
    res = await screening(u, [false, false, true, false]);
    expect(await res.json()).toEqual({ caution: true });
    const row = await ctx.deps.db.selectFrom('healthScreening').selectAll().where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(Object.keys(row).sort()).toEqual(['answeredAt', 'caution', 'createdAt', 'deletedAt', 'id', 'ownerId', 'questionnaireVersion', 'rev', 'updatedAt', 'updatedBy']);
    expect(row).toMatchObject({ id: u.id, ownerId: u.id, caution: 1, questionnaireVersion: '1.0', answeredAt: '2026-10-06T10:00:00.000Z', deletedAt: null });
    expect((await (await ctx.request('/api/me', { cookie: u.cookie })).json()).cautious).toBe(true);
  });
  it('version de questionnaire inconnue ou 3 réponses → 400', async () => {
    const u = await createUserAndLogin(ctx);
    await grant(u);
    expect((await ctx.request('/api/me/health-screening', { method: 'PUT', cookie: u.cookie, json: { answers: [false, false, false, false], questionnaireVersion: '0.1' } })).status).toBe(400);
    expect((await screening(u, [false, false, false])).status).toBe(400);
  });
});

describe('limitations', () => {
  it('création, modification, suppression = tombstone sans contenu ; 404 pour un autre, admin compris', async () => {
    const u = await createUserAndLogin(ctx);
    const admin = await createUserAndLogin(ctx, { role: 'admin' });
    await grant(u);
    await grant(admin);
    const res = await ctx.request('/api/me/limitations', { method: 'POST', json: limitation, cookie: u.cookie });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const row = () => ctx.deps.db.selectFrom('limitation').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(await row()).toMatchObject({ ownerId: u.id, bodyArea: 'knee', side: 'left', severity: 'mild', note: 'gêne en descente', active: 1, deletedAt: null });
    expect((await ctx.request(`/api/me/limitations/${id}`, { method: 'PATCH', json: { severity: 'severe', active: false }, cookie: u.cookie })).status).toBe(204);
    expect(await row()).toMatchObject({ severity: 'severe', active: 0, bodyArea: 'knee' });
    expect((await ctx.request(`/api/me/limitations/${id}`, { method: 'PATCH', json: { note: 'x'.repeat(201) }, cookie: u.cookie })).status).toBe(400);
    expect((await ctx.request('/api/me/limitations', { method: 'POST', json: { ...limitation, bodyArea: 'tail' }, cookie: u.cookie })).status).toBe(400);
    const r1 = await ctx.request(`/api/me/limitations/${id}`, { method: 'PATCH', json: { severity: 'mild' }, cookie: admin.cookie });
    expect(r1.status).toBe(404);
    expect((await ctx.request(`/api/me/limitations/${id}`, { method: 'DELETE', cookie: admin.cookie })).status).toBe(404);
    expect((await ctx.request(`/api/me/limitations/${id}`, { method: 'DELETE', cookie: u.cookie })).status).toBe(204);
    expect(await row()).toMatchObject({ bodyArea: null, side: null, severity: null, note: null, active: null, deletedAt: '2026-10-06T10:00:00.000Z' });
    expect((await ctx.request(`/api/me/limitations/${id}`, { method: 'PATCH', json: { severity: 'mild' }, cookie: u.cookie })).status).toBe(404);
  });
});
```

```ts
// apps/server/test/privacy/withdraw.test.ts
import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import { entityRules, SYNC_COLUMNS, HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, type EntityRulesMap } from '@appsport/contracts';
import { createTestContext, createUserAndLogin, type TestContext } from '@appsport/server/testing';
import type { Migration } from '../../src/db/migrations';
import { createLogger } from '../../src/logger';

const WITNESS = 'TEMOIN-C2-5a1f';
const SYNC_DDL = `owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, rev INTEGER NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT, deleted_at TEXT`;
const FIXTURES: Migration = { id: '9019_withdraw_fixtures', breaking: false, async up(db) {
  await sql.raw(`CREATE TABLE t19_note (id TEXT PRIMARY KEY, ${SYNC_DDL}, label TEXT NOT NULL, pain_note TEXT) STRICT`).execute(db);
  await sql.raw(`CREATE TABLE t19_c2_log (id TEXT PRIMARY KEY, ${SYNC_DDL}, value TEXT,
    CHECK (deleted_at IS NOT NULL OR value IS NOT NULL)) STRICT`).execute(db);
} };
const base = { syncClass: 'J', ownerColumn: 'owner_id', secretColumns: [], exported: true, onUserDelete: 'cascade' } as const;
const RULES: EntityRulesMap = { ...entityRules,
  t19_note: { ...base, category: 'C1', columns: ['id', ...SYNC_COLUMNS, 'label', 'pain_note'], clientWritable: ['label', 'pain_note'], c2Columns: ['pain_note'] },
  t19_c2_log: { ...base, category: 'C2', columns: ['id', ...SYNC_COLUMNS, 'value'], clientWritable: ['value'], c2Columns: [] } };

let ctx: TestContext; const lines: string[] = [];
afterEach(() => { ctx.close(); lines.length = 0; });
async function setup() {
  ctx = await createTestContext({ extraMigrations: [FIXTURES], entityRules: RULES, deps: { logger: createLogger((l) => lines.push(l)) } });
  const u = await createUserAndLogin(ctx);
  const other = await createUserAndLogin(ctx);
  for (const x of [u, other]) {
    await ctx.request('/api/me/consents', { method: 'POST', json: { type: 'health', textVersion: HEALTH_CONSENT_TEXT.version }, cookie: x.cookie });
    await ctx.request('/api/me/training-profile', { method: 'PATCH', json: { cautiousMode: true }, cookie: x.cookie });
    await ctx.request('/api/me/health-screening', { method: 'PUT', json: { answers: [true, false, false, false], questionnaireVersion: HEALTH_QUESTIONNAIRE.version }, cookie: x.cookie });
    const lim = { bodyArea: 'knee', side: 'left', severity: 'mild', note: WITNESS };
    await ctx.request('/api/me/limitations', { method: 'POST', json: lim, cookie: x.cookie });
    await ctx.request('/api/me/limitations', { method: 'POST', json: { ...lim, bodyArea: 'neck' }, cookie: x.cookie });
    const now = '2026-10-06T10:00:00.000Z';
    await sql`INSERT INTO t19_note VALUES (${`n-${x.id}`}, ${x.id}, 1, ${now}, ${now}, ${x.id}, NULL, 'séance', ${WITNESS})`.execute(ctx.deps.db);
    await sql`INSERT INTO t19_c2_log VALUES (${`l-${x.id}`}, ${x.id}, 1, ${now}, ${now}, ${x.id}, NULL, ${WITNESS})`.execute(ctx.deps.db);
  }
  return { u, other };
}
const withdraw = (cookie: string, password: string) => ctx.request('/api/me/consents/withdraw', { method: 'POST', json: { type: 'health', password }, cookie });
const allRows = async () => { const out: Record<string, unknown[]> = {};
  for (const { name } of ctx.deps.sqlite.prepare(`SELECT name FROM sqlite_schema WHERE type = 'table'`).all() as { name: string }[])
    out[name] = ctx.deps.sqlite.prepare(`SELECT * FROM "${name}"`).all();
  return out; };

describe('retrait du consentement santé (R-CST-5, P-CST-3, 02 §15 n°13)', () => {
  it('mot de passe exigé : faux → 401 invalid_credentials, rien ne change', async () => {
    const { u } = await setup();
    const res = await withdraw(u.cookie, 'mauvais mot de passe');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_credentials');
    expect((await (await ctx.request('/api/me', { cookie: u.cookie })).json()).consents.health.active).toBe(true);
  });
  it('vide les tables C2 (tombstones sans contenu), met à NULL les c2Columns, garde cautious_mode, journalise', async () => {
    const { u, other } = await setup();
    // une limitation déjà supprimée normalement doit aussi rester sans contenu
    const lims = await ctx.deps.db.selectFrom('limitation').select(['id', 'rev']).where('ownerId', '=', u.id).execute();
    const otherBefore = await ctx.deps.db.selectFrom('limitation').select(['id', 'rev']).where('ownerId', '=', other.id).execute();
    ctx.clock.advance(1000);
    const res = await withdraw(u.cookie, u.password);
    expect(res.status).toBe(200);
    const me = await res.json();
    expect(me.consents.health.active).toBe(false);
    expect(me.cautious).toBe(true);                                       // cautious_mode toujours actif
    const hs = await ctx.deps.db.selectFrom('healthScreening').selectAll().where('id', '=', u.id).executeTakeFirstOrThrow();
    expect(hs).toMatchObject({ caution: null, questionnaireVersion: null, answeredAt: null, deletedAt: '2026-10-06T10:00:01.000Z' });
    for (const l of lims) {
      const r = await ctx.deps.db.selectFrom('limitation').selectAll().where('id', '=', l.id).executeTakeFirstOrThrow();
      expect(r).toMatchObject({ bodyArea: null, side: null, severity: null, note: null, active: null });
      expect(r.deletedAt).not.toBeNull();
      expect(r.rev).toBeGreaterThan(l.rev);
    }
    const note = ctx.deps.sqlite.prepare('SELECT * FROM t19_note WHERE owner_id = ?').get(u.id) as Record<string, unknown>;
    expect(note).toMatchObject({ label: 'séance', pain_note: null, deleted_at: null });
    expect(note.rev as number).toBeGreaterThan(1);
    expect(ctx.deps.sqlite.prepare('SELECT value, deleted_at FROM t19_c2_log WHERE owner_id = ?').get(u.id)).toEqual({ value: null, deleted_at: '2026-10-06T10:00:01.000Z' });
    expect((await ctx.deps.db.selectFrom('trainingProfile').select('cautiousMode').where('id', '=', u.id).executeTakeFirstOrThrow()).cautiousMode).toBe(1);
    const last = await ctx.deps.db.selectFrom('consentEvent').selectAll().where('ownerId', '=', u.id).orderBy('rev', 'desc').executeTakeFirstOrThrow();
    expect(last).toMatchObject({ type: 'health', action: 'withdraw', textVersion: '1.0' });
    const se = await ctx.deps.db.selectFrom('securityEvent').selectAll().where('type', '=', 'consent_revoked').execute();
    expect(se).toHaveLength(1);
    expect(se[0]).toMatchObject({ actorId: u.id, targetId: u.id });
    expect(JSON.parse(se[0]!.details!)).toEqual({ consentType: 'health' });
    // l'autre utilisateur n'est pas touché
    expect(await ctx.deps.db.selectFrom('limitation').select(['id', 'rev']).where('ownerId', '=', other.id).execute()).toEqual(otherBefore);
  });
  it('idempotent : un second retrait n’écrit rien', async () => {
    const { u } = await setup();
    await withdraw(u.cookie, u.password);
    const counts = async () => [(await ctx.deps.db.selectFrom('consentEvent').select('id').execute()).length,
      (await ctx.deps.db.selectFrom('securityEvent').select('id').where('type', '=', 'consent_revoked').execute()).length];
    const before = await counts();
    expect((await withdraw(u.cookie, u.password)).status).toBe(200);
    expect(await counts()).toEqual(before);
  });
  it('cautious recalculé : caution ne compte plus sans consentement', async () => {
    const { u } = await setup();
    await ctx.request('/api/me/training-profile', { method: 'PATCH', json: { cautiousMode: false }, cookie: u.cookie });
    expect((await (await ctx.request('/api/me', { cookie: u.cookie })).json()).cautious).toBe(true);   // caution = 1
    expect((await (await withdraw(u.cookie, u.password)).json()).cautious).toBe(false);
  });
  it('Review Focus 3 : la valeur témoin C2 de l’utilisateur ne subsiste dans aucune table ni dans les journaux', async () => {
    const { u, other } = await setup();
    await withdraw(u.cookie, u.password);
    await withdraw(other.cookie, other.password);
    expect(JSON.stringify(await allRows())).not.toContain(WITNESS);
    expect(lines.join('\n')).not.toContain(WITNESS);
  });
  it('après retrait puis nouveau consentement, le questionnaire se réenregistre sur la même ligne', async () => {
    const { u } = await setup();
    await withdraw(u.cookie, u.password);
    await ctx.request('/api/me/consents', { method: 'POST', json: { type: 'health', textVersion: '1.0' }, cookie: u.cookie });
    const res = await ctx.request('/api/me/health-screening', { method: 'PUT', json: { answers: [false, false, false, false], questionnaireVersion: '1.0' }, cookie: u.cookie });
    expect(await res.json()).toEqual({ caution: false });
    expect((await ctx.deps.db.selectFrom('healthScreening').selectAll().where('id', '=', u.id).executeTakeFirstOrThrow()).deletedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @appsport/server test -- consent withdraw`
Expected: FAIL, `POST /api/me/consents` renvoie 404 (routeur absent).

- [ ] **Step 3: Implement**

`api/consent.ts` : libellés FR. `BODY_AREA_LABELS` : shoulder « Épaule », elbow « Coude », wrist_hand « Poignet ou main », neck « Cou », upper_back « Haut du dos », lower_back « Bas du dos », hip « Hanche », knee « Genou », ankle_foot « Cheville ou pied », other « Autre ». `LIMITATION_SIDE_LABELS` : left « Gauche », right « Droite », both « Les deux », not_applicable « Sans objet ». `LIMITATION_SEVERITY_LABELS` : mild « Légère », severe « Forte : m'empêche certains mouvements ».

`grantConsent` : insère `consent_event { id: deps.ids.uuidv7(), ownerId: userId, type, action: 'grant', textVersion, createdAt: now }` avec `writeStamp(trx, deps, userId)`, puis `logSecurityEvent({ type: 'consent_granted', actorId: userId, targetId: userId, ip, outcome: 'success', details: { consentType: type } })`. La route refuse une `textVersion` ≠ `HEALTH_CONSENT_TEXT.version` (`httpError('validation')`) et n'appelle pas `grantConsent` si `getConsentState` montre déjà `health` actif avec la même `textVersion`.

`withdrawHealthConsent` : si `!(await isHealthConsentActive(trx, userId))`, retour immédiat. Sinon, pour chaque `[table, rule]` de `deps.entityRules` avec `rule.ownerColumn` ∈ {`owner_id`, `user_id`} :
- `rule.category === 'C2'` : `content = rule.columns` sans `'id'` ni `SYNC_COLUMNS` ; toutes les lignes du propriétaire dont `deleted_at IS NULL` ou une colonne de `content` n'est pas NULL reçoivent `content = NULL`, `deleted_at = COALESCE(deleted_at, now)`, et un nouveau `rev`/`updated_at`/`updated_by` (un `writeStamp` par ligne, `actorId` = `actor.actorId`) ;
- sinon, si `rule.c2Columns.length > 0` : les lignes du propriétaire dont l'une de ces colonnes n'est pas NULL reçoivent ces colonnes à NULL et un nouveau stamp.

Le SQL dynamique passe par `sql` de Kysely avec `sql.table(table)` et `sql.id(column)` sur les noms snake_case du registre (le `CamelCasePlugin` ne les modifie pas). Ensuite : `consent_event { action: 'withdraw', type: 'health', textVersion: <textVersion du dernier grant> }` avec stamp, puis `logSecurityEvent({ type: 'consent_revoked', actorId: actor.actorId, targetId: userId, ip: actor.ip, outcome: 'success', details: { consentType: 'health' } })`. Aucune valeur de contenu n'est journalisée.

`consentRoutes(deps)` (`requireUser` sur chaque route ; écritures en transaction) :
- withdraw : `verifyUserPassword` faux → `httpError('invalid_credentials')` ; sinon `withdrawHealthConsent(trx, deps, user.id, { actorId: user.id, ip: clientIp(c) })`, réponse `buildMe`.
- Garde C2 (health-screening, limitations) : `isHealthConsentActive` faux → `httpError('health_consent_required')`, vérifiée avant toute lecture de la ressource.
- health-screening : version ≠ `HEALTH_QUESTIONNAIRE.version` → 400 ; `caution = answers.some(Boolean)` ; upsert sur `id = owner_id` (une ligne supprimée est réactivée avec `deleted_at = NULL`) ; les réponses ne sont ni stockées ni journalisées.
- limitations : POST insère `{ id: deps.ids.uuidv7(), active: active ?? true, note: note ?? null }` → 201 `{ id }`. PATCH et DELETE : ligne du propriétaire non supprimée, sinon 404. **[décision plan]** DELETE pose une tombstone sans contenu (colonnes de contenu à NULL), comme le retrait, pour ne garder aucune donnée C2 dans une ligne supprimée.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @appsport/server test -- consent withdraw` puis `pnpm --filter @appsport/server test` (non-régression) et `pnpm typecheck`
Expected: PASS, tous les tests verts, dont « Review Focus 3 ».

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/consent.ts packages/contracts/src/index.ts apps/server/src/privacy/consent.ts apps/server/src/privacy/health-routes.ts apps/server/src/routes.ts apps/server/test/privacy/consent.test.ts apps/server/test/privacy/withdraw.test.ts
git commit -m "feat(privacy): consentement santé, questionnaire, limitations et retrait"
```

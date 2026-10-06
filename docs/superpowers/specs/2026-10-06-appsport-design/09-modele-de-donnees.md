## Modèle de données consolidé

# Modèle de données consolidé (v1)

## 0. Conventions

1. Tables et colonnes en anglais `snake_case`, types TS en `camelCase`. Toutes les tables sont `STRICT`. Il n'y a pas de type DATE ni BOOLEAN :
   - date : `TEXT` `YYYY-MM-DD` ;
   - date-heure : `TEXT` ISO 8601 UTC ;
   - booléen : `INTEGER CHECK (x IN (0,1))` ;
   - JSON : `TEXT CHECK (json_valid(x))` ;
   - charges et poids : `INTEGER` en grammes ;
   - énumérations : `TEXT CHECK (x IN (...))`, avec des valeurs en anglais.
2. Identifiants : UUIDv7 en `TEXT`.
   - Le client les génère pour les tables de classe J. L'API les génère dans les autres cas.
   - Exceptions :
     - tables 1-1 : `id = owner_id` ;
     - tables de matériel, `slot_state` et `engine_decision` (`id = performed_exercise_id`) : clé déterministe (voir ces tables) ;
     - catalogue : slug anglais en kebab-case, immuable.
3. **Colonnes de synchro**, notées `+SYNC`, présentes sur chaque table synchronisée :
   - `owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE` ;
   - `rev INTEGER NOT NULL` : valeur de `server_meta.sync_counter`, fixée par le serveur ;
   - `created_at`, `updated_at` : heure du serveur ;
   - `updated_by TEXT REFERENCES user(id) ON DELETE SET NULL` ;
   - `deleted_at TEXT NULL` : tombstone, purgée après `TOMBSTONE_TTL` = 90 j.
   
   Index obligatoires : `(rev)` et `(owner_id, rev)`.
   
   Les tables qui ne sont pas synchronisées utilisent `user_id` au lieu de `owner_id`.
4. **Catégories** :
   - C0 : interne, visible par le cercle ou par l'admin par conception ;
   - C1 : personnelle ;
   - C2 : santé ;
   - C3 : sensible (conversations, signalements).
   
   Une colonne C2 placée dans une table C1 est listée dans `c2Columns`. Les **secrets** (`*_hash`) sont listés dans `secretColumns` : ils ne sont jamais exportés, synchronisés ni journalisés.
5. **Registre unique** `entityRules[table]` dans `packages/contracts` :
   - champs : `{category, syncClass, clientWritable[], c2Columns[], secretColumns[], exported, onUserDelete}` ;
   - il fusionne les registres `entityRules`, `DATA_CATEGORIES` et le registre des tables du socle ;
   - un test sur le schéma vérifie que chaque table et chaque colonne y figurent.
6. **Classes de synchro et règles de conflit** (section Architecture) :
   - **J — Journal** : écrit hors ligne via l'outbox.
     - La création est idempotente (`ON CONFLICT(id) DO NOTHING`). Après un changement d'epoch, le client fait un `restore_upsert` des 60 derniers jours.
     - Les patchs suivent la règle « dernière écriture gagnante » champ par champ, dans l'ordre d'arrivée au serveur. Le client rebase ses patchs en attente.
     - Une suppression est une tombstone.
     - Une colonne C2 envoyée sans consentement santé est mise à NULL par le serveur, avec le statut `applied_partial`. L'opération n'est jamais rejetée pour cette raison.
     - Une opération qui crée ou modifie une ligne d'une table C2 (par exemple une création `weigh_in`) envoyée sans consentement santé est écartée sans écriture, avec le statut `applied_partial`. Elle n'est jamais versée dans `sync_rejection` (Vie privée P-CST-2 et P-CST-4, Architecture R-SYN-9).
   - **D — Calculé par le serveur** : jamais poussé, le serveur fait foi.
     - Le téléphone peut calculer une valeur provisoire avec `packages/domain`. Le pull suivant l'écrase.
   - **E — Édité en ligne** : écrit par l'API en ligne et lu par pull. Hors ligne, en lecture seule.
     - Règle « dernière écriture gagnante » champ par champ.
     - Matériel : ajout et retrait idempotents sur une clé déterministe.
     - `instance_change` : contrôle de `base_revision`.
     - `consent_event` : ajout seulement, donc sans conflit.
   - **C — Catalogue** : lecture seule, servi en bloc par ETag. `server_meta.catalog_version` sert de version. Le client le remplace en entier.
   - **H — Hors synchro** : reste sur le serveur, lu par l'API à la demande. N'est jamais stocké dans Dexie.
7. Ordre des briques : 1 socle, 2 exercices, 3 programmes et séances, 4 coach, 5 nutrition. Une table est créée par la migration de sa brique.

---

## 1. Socle (brique 1)

### 1.1 Tables techniques

**server_meta** — C0, H. Une seule ligne.
- `id INTEGER PK CHECK (id = 1)`
- `server_epoch TEXT NOT NULL` : régénéré à `init` et à chaque `restore`
- `epoch_base_rev INTEGER NOT NULL`, `sync_counter INTEGER NOT NULL`
- `catalog_version TEXT`, `catalog_updated_at TEXT` : remplacent `catalog_meta`

**schema_migrations** — C0, H.
- `id TEXT PK`, `breaking INTEGER 0/1`, `applied_at TEXT`

**applied_op** — C0, H. Purge à 12 mois.
- `op_id TEXT PK`
- `user_id TEXT REFERENCES user ON DELETE CASCADE`
- `entity TEXT`, `row_id TEXT`
- `status TEXT CHECK (applied|applied_partial|duplicate|rejected)`
- `assigned_rev INTEGER NULL`, `applied_at TEXT`
- Index : `(user_id, applied_at)`

**sync_rejection** — C1, J (le serveur crée la ligne, le pull l'apporte au propriétaire). Seule `dismissed_at` est modifiable par le client.
- `id TEXT PK`, `+SYNC`
- `op_id TEXT`, `entity TEXT`, `row_id TEXT`
- `code TEXT CHECK (validation|forbidden|parent_rejected|stale_revision|unknown_entity|protocol)`
- `detail_json TEXT` : aucune valeur C2
- `dismissed_at TEXT NULL`
- Contenu masqué à l'admin.

### 1.2 Comptes

**user** — C0 admin, E (le propriétaire ne reçoit que sa propre ligne). `password_hash` est un secret.
- `id TEXT PK`
- `username TEXT NOT NULL`, `username_key TEXT NOT NULL UNIQUE` (NFKC puis minuscules)
- `password_hash TEXT NOT NULL` : Argon2id au format PHC
- `role TEXT CHECK (admin|member)`, `status TEXT CHECK (active|disabled)`
- `birth_date TEXT NOT NULL` : date complète, recopiée depuis l'invitation, en lecture seule pour l'utilisateur
- `terms_version TEXT`, `terms_accepted_at TEXT`
- `last_login_at TEXT`, `password_changed_at TEXT`
- `onboarding_step TEXT`, `onboarding_completed_at TEXT NULL`
- `invitation_id TEXT REFERENCES invitation ON DELETE SET NULL`
- `rev`, `created_at`, `updated_at`, `updated_by`
- Valeurs calculées, jamais stockées :
  - `age` : à l'heure de Paris ;
  - `age_band` : `minor` ou `adult` ;
  - `cautious` = `age_band = minor` OU `training_profile.cautious_mode` OU (consentement santé actif ET `health_screening.caution`).

**invitation** — C0 admin, H. Visible par l'admin seulement. `code_hash` est un secret.
- `id TEXT PK`
- `code_hash TEXT UNIQUE` : SHA-256 d'un code Crockford de 80 bits. Le lien et le code saisi à la main portent le même code.
- `note TEXT CHECK (length <= 60)`
- `birth_date TEXT NULL` : obligatoire à la création, avec contrôle âge ≥ `MIN_AGE` (16). Effacée à l'usage, à la révocation ou à l'expiration (purge quotidienne).
- `is_admin_bootstrap INTEGER 0/1`
- `created_by TEXT NULL REFERENCES user ON DELETE SET NULL`, `created_at`, `expires_at`
- `used_at NULL`, `used_by TEXT NULL REFERENCES user ON DELETE SET NULL`, `revoked_at NULL`
- État calculé : `pending|used|revoked|expired`.

**password_reset** — C0 admin, H. Admin seulement. `code_hash` est un secret.
- `id TEXT PK`
- `user_id TEXT REFERENCES user ON DELETE CASCADE`
- `code_hash TEXT UNIQUE`
- `created_by TEXT NULL` : NULL si créé par une commande serveur
- `created_at`, `expires_at` (+24 h), `used_at NULL`, `cancelled_at NULL`

**session** — C1, H. `token_hash` est un secret.
- `id TEXT PK`, `token_hash TEXT UNIQUE`
- `user_id TEXT NULL REFERENCES user ON DELETE SET NULL` : mis à NULL à la suppression du compte, ce qui produit une réponse `410 account_deleted`
- `created_at`, `last_seen_at`, `expires_at` (+365 j) ; la session expire aussi après 90 j d'inactivité
- `revoked_at NULL`
- `revoked_reason TEXT NULL CHECK (logout|logout_all|password_change|password_reset|admin|account_deleted)`

**consent_event** — C1, E. **Seule table de consentements**, en ajout seulement.
- `id TEXT PK`, `owner_id`, `rev`, `created_at` (= instant de l'événement), `updated_at`, `updated_by`
- Pas de `deleted_at` : les lignes ne disparaissent qu'avec le compte.
- `type TEXT CHECK (health|ai_coach)`, `action TEXT CHECK (grant|withdraw)`, `text_version TEXT`
- Index : `(owner_id, type, created_at)`
- État courant : dernier événement par `type`.
- Aucun type parental. L'état actif ou non est visible par l'admin.

**security_event** — C0 admin, H. Admin seulement, conservé 12 mois.
- `id TEXT PK`, `at TEXT`
- `type TEXT` : inclut `account_deleted` et `consent_revoked`, utilisés par la procédure de réapplication des suppressions après restauration
- `actor_id TEXT NULL`, `target_id TEXT NULL` : sans clé étrangère, conservés après la suppression d'un compte
- `tailnet_ip TEXT`, `outcome TEXT`
- `details TEXT JSON` : aucun secret ni donnée C2 ou C3
- Index : `(at)`

### 1.3 Profil et santé

**training_profile** — C1, E. Relation 1-1, `id = owner_id`.
- `+SYNC`
- `goal TEXT CHECK (muscle|strength|fat_loss|fitness|sport_support)`
- `experience TEXT CHECK (none|lt_6_months|6_to_24_months|gt_24_months)` : `level` en est déduit ; les deux premières valeurs donnent `beginner`, les deux autres `intermediate`
- `days_per_week INTEGER CHECK (2..4)`
- `session_minutes INTEGER CHECK (IN (30,45,60,75,90))`
- `sport_code TEXT NULL`, `sport_other_label TEXT NULL CHECK (length <= 40)`
- `cautious_mode INTEGER 0/1` : manuel, non sanitaire, ouvert à tous

**health_screening** — C2, E. Relation 1-1, `id = owner_id`. N'existe qu'avec le consentement santé.
- `+SYNC`
- `caution INTEGER 0/1`, `questionnaire_version TEXT`, `answered_at TEXT`

**limitation** — C2, E.
- `id`, `+SYNC`
- `body_area TEXT CHECK (10 valeurs)`
- `side TEXT CHECK (left|right|both|not_applicable)`
- `severity TEXT CHECK (mild|severe)`
- `note TEXT CHECK (length <= 200)`, `active INTEGER 0/1`

### 1.4 Lieux et salles

**gym** — C0, E. Partagée : tous les membres la reçoivent, `owner_id` vaut NULL.
- `id`, `name`, `name_key`, `city`, `city_key`
- `name` et `city` : `CHECK (length BETWEEN 2 AND 60)`
- `load_settings TEXT JSON`
- `created_by NULL`, `updated_by NULL` (ON DELETE SET NULL)
- `rev`, `created_at`, `updated_at`, `deleted_at` : suppression réservée à l'admin, pour une salle inutilisée
- Contrainte : `UNIQUE (name_key, city_key)`
- Règle « dernière écriture gagnante », sans contrôle optimiste.

**gym_equipment** — C0, E.
- `id TEXT PK = gym_id || ':' || equipment_code`
- `gym_id TEXT REFERENCES gym ON DELETE CASCADE`
- `equipment_code TEXT` : code de `EQUIPMENT`, vérifié par Zod
- `added_by TEXT NULL`, `rev`, `created_at`, `updated_at`, `deleted_at`
- Un ajout est un upsert qui remet `deleted_at` à NULL. Un retrait pose une tombstone.

**gym_history** — C0, H. En ajout seulement, lu par l'API.
- `id`, `gym_id TEXT REFERENCES gym ON DELETE CASCADE`
- `author_id TEXT NULL`, `at TEXT`
- `action TEXT CHECK (create|update_info|add_equipment|remove_equipment|update_load_settings)`
- `detail TEXT JSON`

**place** — C1, E.
- `id`, `+SYNC`
- `kind TEXT CHECK (gym|home)`
- `gym_id TEXT NULL REFERENCES gym`, `name TEXT NULL CHECK (length <= 30)` : sans valeur si `kind = 'gym'`
- `is_primary INTEGER 0/1`, `visible_at_gym INTEGER 0/1`
- `load_settings TEXT JSON NULL` : renseigné seulement si `kind = 'home'`
- Contraintes :
  - `CHECK (kind='home' OR load_settings IS NULL)` ;
  - `CHECK ((kind='gym') = (gym_id IS NOT NULL))` ;
  - unique partiel `(owner_id, gym_id) WHERE deleted_at IS NULL` ;
  - unique partiel `(owner_id) WHERE is_primary=1 AND deleted_at IS NULL`.
- La liste « qui fréquente cette salle » (pseudos, `visible_at_gym = 1`) est servie par l'API et n'est pas synchronisée.

**home_equipment** — C1, E.
- `id TEXT PK = place_id || ':' || equipment_code`
- `place_id TEXT REFERENCES place ON DELETE CASCADE`
- `equipment_code TEXT`, `+SYNC`
- Ajout et retrait idempotents, comme pour `gym_equipment`.

**JSON `load_settings`** (Zod, en grammes) :

| Champ | Défaut |
|---|---|
| `barG` | 20000 |
| `smallestPlateG` | 1250 |
| `dumbbellsG[]` | salle : de 2000 à 40000 par pas de 2000 ; maison : `[]` |
| `machineStepG` | 5000 |

---

## 2. Exercices (brique 2)

**exercise** — C0, C. Les colonnes éditoriales sont réservées à l'admin et absentes du bloc envoyé au client.
- `id TEXT PK` : slug anglais en kebab-case, immuable
- `schema_version INTEGER`, `revision INTEGER >= 1`
- `status TEXT CHECK (draft|reviewed|published|retired)`
- `name TEXT (<= 60)` : en français, affiché
- `aliases TEXT JSON` : 0 à 6 entrées
- `movement_pattern TEXT` : valeur de `MOVEMENT_PATTERNS`, 20 au total
- `mechanics TEXT CHECK (compound|isolation)`
- `unilateral INTEGER 0/1`
- `measure TEXT CHECK (reps|duration)`
- `load_mode TEXT CHECK (barbell|dumbbell|machine|weighted|bodyweight|band)`
- `level INTEGER CHECK (1..3)`, `not_for_minors INTEGER 0/1`
- `primary_muscles TEXT JSON` : 1 à 3
- `secondary_muscles TEXT JSON` : 0 à 4
- `equipment_options TEXT JSON` : `EquipmentCode[][]`, où `[[]]` signifie sans matériel
- `stressed_joints TEXT JSON` : 0 à 3
- `content TEXT JSON` : `{instructions, key_points, mistakes[{mistake, fix}], safety, breathing, setup?, easier_tip?, harder_tip?}`
- `chain_id TEXT NULL`
- `easier_id TEXT NULL`, `harder_id TEXT NULL` : `REFERENCES exercise`, réciproques ; `chain_rank` est calculé
- `illustrations TEXT JSON` : `[{illustration_id, role: start|mid|end}]`, 0 à 3 éléments
- Colonnes éditoriales :
  - `review_notes TEXT` ;
  - `drafting TEXT JSON` : `{origin: ai|human, model, prompt_version, generated_at}` ;
  - `reviewed_by TEXT NULL REFERENCES user ON DELETE SET NULL` ;
  - `reviewed_at`, `published_at`, `retired_at`, `updated_at` ;
  - `exported_revision INTEGER`.
- Index : `status`, `movement_pattern`, `chain_id`.

**illustration** — C0, C. La source de vérité est `data/illustrations/manifest.json`, chargé en base.
- `id TEXT PK`
- `file TEXT` : `<id>.<hash8>.<ext>`
- `sha256 TEXT`, `bytes INTEGER`, `media_type TEXT`
- `source TEXT CHECK (everkinetic|workout_guide)`
- `source_url TEXT` : figée à un commit
- `creators TEXT JSON`
- `license TEXT CHECK (CC-BY-SA-4.0|CC-BY-4.0|CC0-1.0)`, `license_url TEXT`
- `modifications TEXT`
- `replace_before_public INTEGER 0/1`

Les modèles de programme ne sont **pas une table** : ce sont des fichiers `data/programs/<id>.json`, en C0. Ils sont validés par Zod, servis dans le bloc catalogue (classe C) et versionnés par `catalog_version`.

---

## 3. Programmes et séances (brique 3)

**program_instance** — C1, E.
- `id`, `+SYNC`
- `template_id TEXT`, `template_version INTEGER`
- `snapshot TEXT JSON` : copie figée du modèle
- `days_per_week INTEGER CHECK (2..4)`
- `status TEXT CHECK (active|ended)`
- `revision INTEGER NOT NULL DEFAULT 0` : version du contenu du programme, distincte de `rev`
- `started_at TEXT`, `ended_at TEXT NULL`
- Contrainte : unique partiel `(owner_id) WHERE status='active' AND deleted_at IS NULL`.

**instance_change** — C1, E. Colonne C2 : `reason`. C'est la **seule entité de proposition ou de modification** du programme.
- `id`, `+SYNC`
- `instance_id TEXT REFERENCES program_instance`
- `base_revision INTEGER`
- `author TEXT CHECK (user|coach|engine)`
- `operations TEXT JSON` : 1 à 5 opérations parmi (noms de Programmes §15) :
  - `replace_exercise`, `change_sets`, `set_rep_range`, `set_target_rir`, `set_rest` ;
  - `lighten_exercise` : sans paramètre, −`LIGHTEN_PCT` = 10 %, arrondi par le code ;
  - `start_deload`, `suspend_slot`, `remove_slot`, `add_slot`, `set_days_per_week`, `switch_template` ;
  - `resume_slot` : réservé à `author = user`.
- `reason_code TEXT`, `reason TEXT NULL`
- `status TEXT CHECK (proposed|accepted|rejected|expired)`
- `expires_at TEXT NULL` : création + 7 j si `proposed`
- `decided_at TEXT NULL`
- `ai_generated INTEGER 0/1`, `ai_model TEXT NULL`, `prompt_version TEXT NULL`
- `coach_thread_id TEXT NULL REFERENCES coach_thread ON DELETE SET NULL`
- Index : `(instance_id, created_at)`, `(owner_id, status)`
- Règle : l'acceptation exige `base_revision = program_instance.revision` ; elle passe alors `revision` à +1. Sinon, le statut devient `expired` (code `stale_revision`). Après création, seuls `status` et `decided_at` peuvent changer, sauf au retrait du consentement santé : `reason` passe alors à NULL et un `reason_code` `PAIN_*` est réécrit en `USER_*` (Programmes §13.9).

**slot_state** — C1, D. Colonne C2 : `pain_streak`. C'est un cache qu'on peut recalculer.
- `id TEXT PK = instance_id:slot_id:exercise_id`, `+SYNC`
- `instance_id TEXT REFERENCES program_instance ON DELETE CASCADE`
- `slot_id TEXT`, `exercise_id TEXT`
- `mode TEXT CHECK (linear|double|sum|chain|duration)`
- `load_g`, `target_reps`, `variant_rank`, `duration_s`, `machine_step_g_override` : `INTEGER NULL`
- `machine_step_g_override` est écrit par l'API en ligne (correction du pas de machine par l'utilisateur), comme `nutrition_checkin.response`, et conservé lors d'un rejeu.
- `calibration_left`, `no_progress_count`, `stall_rank` : `INTEGER`
- `pain_streak INTEGER NULL`
- `suspended INTEGER 0/1`
- `last_session_id TEXT NULL`, `rules_version TEXT`

**engine_decision** — C1, D. Relation 1-1 avec `performed_exercise` ; remplace les colonnes de décision qui étaient dans `performed_exercise`.
- `id TEXT PK = performed_exercise_id`, `+SYNC`
- `instance_id NULL`, `slot_id NULL`, `exercise_id`
- `result TEXT CHECK (PROGRESS|HOLD|FAIL|IGNORED|DELOAD|ADJUSTED_HOLD|ADJUSTED_LIGHTEN|CALIBRATION|STALL)`
- `reason_code TEXT` : les codes `PAIN_*` sont réécrits en `USER_*` au retrait du consentement santé
- `next_target TEXT JSON`
- `profile TEXT CHECK (adult|cautious)`
- `rules_version TEXT`

**workout_session** — C1, J.
- `id`, `+SYNC`
- `instance_id TEXT NULL REFERENCES program_instance` : NULL pour une séance libre
- `workout_id TEXT NULL`
- `place_id TEXT REFERENCES place`
- `device_id TEXT`
- `started_at`, `ended_at NULL`
- `status TEXT CHECK (in_progress|completed|abandoned)`
- `week_type TEXT CHECK (normal|deload)`
- `template_version INTEGER NULL`, `rules_version TEXT`, `app_version TEXT`
- `note TEXT NULL`
- Index : `(owner_id, started_at)`

**performed_exercise** — C1, J. Colonnes C2 : `pain_level`, et `swap_reason` quand sa valeur est `pain`.
- `id`, `+SYNC`
- `session_id TEXT REFERENCES workout_session`
- `slot_id NULL`, `planned_exercise_id NULL`, `exercise_id`
- `swap_reason TEXT NULL CHECK (equipment|busy|pain|preference)`
- `position INTEGER`
- `pain_level TEXT NULL CHECK (none|discomfort|pain)`
- `next_adjustment TEXT NULL CHECK (hold|lighten)` : non sanitaire
- `note NULL`
- Index : `(session_id)`
- Sans consentement santé, le serveur met `pain_level` à NULL et remplace `swap_reason = pain` par NULL. Sans consentement, le bouton douleur écrit seulement `next_adjustment` (neutre, C1) ; aucune trace de douleur n'est stockée.

**performed_set** — C1, J.
- `id`, `+SYNC`
- `performed_exercise_id TEXT REFERENCES performed_exercise`
- `position INTEGER`
- `kind TEXT CHECK (warmup|work)`
- `load_mode TEXT`
- `load_g`, `reps`, `duration_s` : `INTEGER NULL`, avec `CHECK (reps IS NULL OR duration_s IS NULL)`
- `side TEXT NULL CHECK (left|right)`
- `effort TEXT NULL CHECK (easy|ok|hard|failed)`
- Cibles copiées au démarrage de la séance : `target_reps_min`, `target_reps_max`, `target_duration_s`, `target_load_g`, `target_rir` (`INTEGER NULL`), `target_variant TEXT NULL`
- `logged_at TEXT` : heure du client
- Index : `(performed_exercise_id)`

---

## 4. Coach IA (brique 4)

**coach_thread** — C3, H. Purgé 90 j après `last_message_at`.
- `id`
- `user_id TEXT REFERENCES user ON DELETE CASCADE`
- `day TEXT` : date à Paris
- `audience TEXT CHECK (adult|minor)`
- `model`, `effort`, `prompt_version`, `tools_version`
- `brief TEXT JSON NULL` : ne contient du C2 que si les consentements santé et coach sont tous deux actifs. Au retrait du consentement santé, les fils ouverts sont fermés et `brief` est mis à NULL sur tous les fils (Coach §5) ; au retrait du consentement coach, les fils sont supprimés (Coach §15)
- `brief_schema TEXT` : `coach-brief/1`
- `is_open INTEGER 0/1`, `user_message_count INTEGER`
- `created_at`, `last_message_at`
- Contrainte : `UNIQUE (user_id, day)`

**coach_message** — C3, H. En ajout seulement.
- `id`
- `thread_id TEXT REFERENCES coach_thread ON DELETE CASCADE`
- `seq INTEGER`
- `role TEXT CHECK (user|assistant|system)`
- `blocks TEXT JSON` : blocs de l'API, sans modification
- `display_text NULL`
- `ai_generated INTEGER 0/1`
- `effective_model NULL`, `stop_reason NULL`
- `truncated INTEGER 0/1`
- `created_at`
- Contrainte : `UNIQUE (thread_id, seq)`

**coach_call** — C1, H. Journal d'usage sans contenu, gardé 12 mois.
- `id`
- `user_id TEXT REFERENCES user ON DELETE CASCADE`
- `thread_id TEXT NULL` : sans clé étrangère, car le fil est purgé plus tôt
- `created_at`
- `requested_model`, `effective_model`, `fallback_used INTEGER 0/1`
- `input_tokens`, `cache_write_tokens`, `cache_read_tokens`, `output_tokens` : `INTEGER`
- `cost_usd_micros INTEGER`
- `first_text_latency_ms`, `duration_ms`
- `stop_reason`, `refusal_category NULL`
- `tool_rounds`, `filter_blocks`
- `error_code NULL`
- Index : `(user_id, created_at)`

**coach_report** — C3, H. Seule donnée C3 lisible par l'admin.
- `id`
- `user_id TEXT REFERENCES user ON DELETE CASCADE`
- `thread_id TEXT NULL`, `message_seq INTEGER`
- `category TEXT CHECK (inaccurate|unsafe|inappropriate|other)`
- `comment TEXT NULL`
- `exchange_text TEXT` : copie de la réponse du coach signalée et du message de l'utilisateur qui la précède
- `created_at`
- La ligne est supprimée au classement par l'admin, et au plus tard à J+90, au retrait du consentement coach ou avec le compte.

**coach_safety_counter** — C0, H. Anonyme.
- `month TEXT`
- `kind TEXT CHECK (help_emergency|help_pain|help_eating_disorder|help_doping|help_pregnancy|help_distress|filter_block|refusal)`
- `count INTEGER`
- Clé primaire : `PK (month, kind)`

**coach_state** — C0, H. Une seule ligne.
- `id INTEGER PK CHECK (id = 1)`
- `enabled INTEGER 0/1`, `suspended_until TEXT NULL`

---

## 5. Nutrition (brique 5)

**nutrition_profile** — C2, E. Relation 1-1, `id = owner_id`. Colonnes C1 : `mode`, `mode_reason` (la valeur `safety` relève du C2 : c'est la seule effacée au retrait du consentement santé ; `choice`, posé justement quand ce consentement est refusé, reste).
- `+SYNC`
- `mode TEXT CHECK (full|qualitative|disabled) DEFAULT 'disabled'`
- `mode_reason TEXT NULL CHECK (choice|safety)`
- `safety_screen_version INTEGER NULL`, `safety_screen_at TEXT NULL`
- `safety_pause INTEGER 0/1` : posé par `refer_to_help('eating_disorder')` à travers un service du domaine
- `sex_for_calc TEXT NULL CHECK (male|female|unspecified)`
- `height_cm INTEGER NULL CHECK (120..220)` : saisi à l'activation du module
- `activity_level INTEGER NULL CHECK (1..4)`
- `goal TEXT NULL CHECK (lose|maintain|gain)`
- `cumulative_adjustment_kcal INTEGER CHECK (% 100 = 0) DEFAULT 0`
- Le mode effectif est donné par `effectiveNutritionMode(profile, age, healthConsentActive, currentScreenVersion)` et n'est jamais stocké. Pour un mineur, il ne vaut jamais `full` (`qualitative` si le module est activé, `disabled` sinon).

**weigh_in** — C2, J. Remplace `body_weight` et `mesure_corporelle`. Le premier poids est saisi à l'activation du module.
- `id` (généré par le client), `+SYNC`
- `date TEXT` : date locale à Paris
- `weight_g INTEGER CHECK (30000..250000 AND % 100 = 0)`
- Contrainte : unique partiel `(owner_id, date) WHERE deleted_at IS NULL`
- Conflit sur la même date : la dernière pesée arrivée gagne, l'autre devient une tombstone.
- Pesée reçue alors que le mode nutrition effectif n'est pas `full` : rejetée avec le code `forbidden` dans `sync_rejection` (le motif est le mode, pas le consentement). Pesée reçue sans consentement santé : non créée, statut `applied_partial`, sans `sync_rejection`.

**nutrition_target** — C2, D. Immuable ; la cible en vigueur est la plus récente.
- `id`, `+SYNC`
- `valid_from TEXT`
- `algo_version TEXT`
- `reason TEXT CHECK (initial|checkin|weight_recalibration|profile_change|low_bmi_safety|new_algo_version)`
- `inputs TEXT JSON`
- `effective_goal TEXT CHECK (lose|maintain|gain)`
- `bmr_kcal REAL`, `tdee_kcal REAL`
- `kcal_target`, `kcal_min`, `kcal_max`, `protein_g_min`, `protein_g_max`, `fat_g_min`, `carbs_g`, `fiber_g`, `water_ml` : `INTEGER`
- `applied_rules TEXT JSON`
- Index : `(owner_id, valid_from)`

**nutrition_checkin** — C2, D. La colonne `response` s'écrit par l'API en ligne.
- `id`, `+SYNC`
- `week_start TEXT` : un lundi
- `weigh_in_count INTEGER`, `mean_weight_g INTEGER NULL`, `change_pct REAL NULL`
- `representative INTEGER 0/1`
- `decision TEXT CHECK (insufficient_data|non_representative_week|in_band|out_of_band_pending|proposal|rapid_loss|limit_reached|safety_pause)`
- `position TEXT NULL CHECK (above|in|below)`
- `proposed_delta_kcal INTEGER NULL CHECK (IN (-100,100))`
- `response TEXT NULL CHECK (accepted|declined)`, `responded_at NULL`
- `created_target_id`, `recalibration_target_id` : `TEXT NULL REFERENCES nutrition_target`
- Contrainte : `UNIQUE (owner_id, week_start)`

**advice_sheet** — C0, C.
- `id TEXT PK` : slug anglais, comme pour `exercise`
- `title`, `body_md`
- `audience TEXT CHECK (adults|minors|all)`
- `visible_modes TEXT JSON` : sous-ensemble de {full, qualitative}
- `tags TEXT JSON`
- `sources TEXT JSON` : `[{title, url, accessed_on}]`
- `status TEXT CHECK (draft|reviewed|published|retired)`, `version INTEGER`
- `draft_origin TEXT CHECK (ai|human)`
- `reviewed_by TEXT NULL REFERENCES user ON DELETE SET NULL`
- `reviewed_at`, `published_at`, `retired_at`, `updated_at`
- Invariant testé : une fiche destinée aux mineurs ou visible en mode qualitatif ne contient ni nombre avec une unité (kcal, g, kg, %) ni terme interdit.

---

## 6. Constantes du code partagé (ce ne sont pas des tables, toutes C0)

- `packages/contracts/src/taxonomy.ts`, tenu par la section Exercices :
  - `EQUIPMENT` : 23 codes ;
  - `EQUIPMENT_CATEGORIES` ;
  - `EQUIPMENT_IMPLIES` ;
  - `REFERENCE_PROFILES` (`home_bodyweight`, `home_small_equipment`, `gym_reference`) : remplace `REFERENCE_GYM_EQUIPMENT` et `HOME_BASE_EQUIPMENT` :
    - `home_bodyweight` = `chair`, `table` ; remplace `HOME_BASE_EQUIPMENT` ;
    - `gym_reference` (14 codes) = `dumbbells`, `barbell`, `squat_rack`, `flat_bench`, `adjustable_bench`, `dip_station`, `pull_up_bar`, `cable_station`, `lat_pulldown`, `seated_row`, `leg_press`, `leg_extension`, `leg_curl`, `upper_body_machines` ; remplace `REFERENCE_GYM_EQUIPMENT` de Programmes ;
  - `MOVEMENT_PATTERNS` (20) ;
  - `PATTERN_GROUPS` : les groupes de couverture ;
  - `MUSCLES` (18), `JOINTS` (8), `LOAD_MODES` (6), `EXERCISE_LEVELS` ;
  - `maxExerciseLevel` : `beginner` donne 1, `intermediate` donne 2.
- `packages/contracts` :
  - `HELP_RESOURCES` : liste unique `{id, label, phone, hours, source_url, verified_on}`, à laquelle `coachConfig.helpResources` fait référence ; la ligne TCA est le 09 69 325 900 ;
  - `MIN_AGE = 16` ;
  - textes versionnés : charte, consentements, questionnaire ;
  - schéma `coach-brief/1` ;
  - `entityRules`.
- `packages/domain` :
  - `LIGHTEN_PCT = 10`, `RULES_VERSION` ;
  - `packages/domain/src/catalog/`, règles réglables de `substitutes` : `SUBSTITUTE_LIMIT = 5` et les poids du score (3 par muscle principal commun, 1 par muscle secondaire commun, −2 par niveau d'écart, +1 si même `unilateral`, +1 si même `load_mode`) ;
  - correspondance entre effort et RIR ;
  - `coachConfig` : fichier versionné. `limits` ne contient pas `messagesPerThread`, puisque la limite par fil est égale à la limite du jour (30).

## 7. Stockage local (Dexie, téléphone)

- **outbox** : `opId PK`, `userId`, `entity`, `id`, `kind (create|patch|delete|restore_upsert)`, `fields`, `clientTs`, `protocol`, `attempts`. `restore_upsert` ne concerne pas `sync_rejection`, que le serveur crée (Architecture R-SYN-26).
- **deadletter** : `opId PK`, `userId`, `entity`, `id`, `code`, `detail`, `receivedAt`.
- **meta** :
  - `deviceId`, `userId` ;
  - `watermark` : `epoch:rev`, opaque ;
  - `serverEpoch`, `protocol`, `catalogVersion` (remplace `catalogMeta`) ;
  - `activeSessionId` ;
  - `lastPullOkAt`, `persistGranted`.
- **Miroirs** : un store par table J, D ou E, avec `serverRevSeen` par ligne et `deleted_at`. Seules les lignes du périmètre du pull y figurent : les siennes, plus `gym` et `gym_equipment`.
- **Catalogue** :
  - `exercises` : fiches `published` et `retired`, sans colonnes éditoriales ;
  - `illustrations` : le manifeste ;
  - `programTemplates`, `adviceSheets`.
  
  Les SVG sont dans le cache du service worker.
- Les tables H ne sont jamais stockées dans Dexie.

## 8. Matrice récapitulative

| Table | Brique | Cat. | Synchro | Règle de conflit |
|---|---|---|---|---|
| server_meta | 1 | C0 | H | — |
| schema_migrations | 1 | C0 | H | — |
| applied_op | 1 | C0 | H | — |
| sync_rejection | 1 | C1 | J | Créée par le serveur ; seule `dismissed_at` se modifie, dernière écriture gagnante |
| user | 1 | C0 admin (+ secret) | E (sa propre ligne) | Dernière écriture gagnante ; `birth_date`, `role` et `status` réservés à l'admin |
| invitation | 1 | C0 admin (+ secret) | H | — |
| password_reset | 1 | C0 admin (+ secret) | H | — |
| session | 1 | C1 (+ secret) | H | — |
| consent_event | 1 | C1 | E | Ajout seulement, pas de conflit |
| security_event | 1 | C0 admin | H | — |
| training_profile | 1 | C1 | E | Dernière écriture gagnante, champ par champ |
| health_screening | 1 | C2 | E | Dernière écriture gagnante |
| limitation | 1 | C2 | E | Dernière écriture gagnante ; suppression par tombstone |
| gym | 1 | C0 | E (partagée) | Dernière écriture gagnante, historisée dans `gym_history` |
| gym_equipment | 1 | C0 | E (partagée) | Ajout et retrait idempotents sur une clé déterministe |
| gym_history | 1 | C0 | H | — |
| place | 1 | C1 | E | Dernière écriture gagnante ; contraintes d'unicité côté serveur |
| home_equipment | 1 | C1 | E | Ajout et retrait idempotents |
| exercise | 2 | C0 | C | Remplacement en bloc par `catalog_version` |
| illustration | 2 | C0 | C | idem |
| program_instance | 3 | C1 | E | Dernière écriture gagnante ; une seule instance active |
| instance_change | 3 | C1 (`reason` en C2) | E | `base_revision`, sinon `expired` |
| slot_state | 3 | C1 (`pain_streak` en C2) | D | Le serveur fait foi ; `machine_step_g_override` par l'API en ligne |
| engine_decision | 3 | C1 | D | Le serveur fait foi |
| workout_session | 3 | C1 | J | Création idempotente ; dernière écriture gagnante champ par champ ; tombstone |
| performed_exercise | 3 | C1 (`pain_level` en C2) | J | idem ; C2 sans consentement mis à NULL (`applied_partial`) |
| performed_set | 3 | C1 | J | idem |
| coach_thread | 4 | C3 | H | — |
| coach_message | 4 | C3 | H | — |
| coach_call | 4 | C1 | H | — |
| coach_report | 4 | C3 | H | — |
| coach_safety_counter | 4 | C0 | H | — |
| coach_state | 4 | C0 | H | — |
| nutrition_profile | 5 | C2 (`mode` et `mode_reason` en C1) | E | Dernière écriture gagnante |
| weigh_in | 5 | C2 | J | Même date : la dernière arrivée gagne, l'autre devient une tombstone |
| nutrition_target | 5 | C2 | D | Immuable, le serveur fait foi |
| nutrition_checkin | 5 | C2 | D | Le serveur fait foi ; `response` par l'API en ligne |
| advice_sheet | 5 | C0 | C | Remplacement en bloc |

**Suppression du compte** :
- les tables qui portent `owner_id` ou `user_id` sont supprimées en CASCADE ;
- `session.user_id` est mis à NULL, avec `revoked_reason = account_deleted` ;
- `security_event` et `coach_safety_counter` sont conservées.

**Retrait du consentement santé** :
- les lignes des tables C2 sont vidées immédiatement (Vie privée P-CST-3) : `health_screening`, `limitation`, `weigh_in`, `nutrition_target`, `nutrition_checkin`. Il ne reste de chaque ligne qu'une tombstone sans contenu (`id`, `owner_id`, `rev`, `deleted_at`), propagée par pull puis purgée après `TOMBSTONE_TTL` ; le client purge ses copies ;
- exception explicite à P-CST-3 : la ligne `nutrition_profile` n'est pas réduite à une tombstone mais neutralisée, car `mode` et `mode_reason` sont C1. Ses colonnes C2 sont vidées, `mode_reason = safety` est effacé et le mode passe à `disabled` (Nutrition §5.4) ;
- les colonnes listées dans `c2Columns` sont mises à NULL ; `performed_exercise.swap_reason` n'est mis à NULL que lorsqu'il vaut `pain` ;
- les codes `PAIN_*` de `instance_change.reason_code` et `engine_decision.reason_code` sont réécrits en `USER_*` ;
- `slot_state` n'est pas recalculé rétroactivement.

### Incohérences résolues lors de la consolidation

- Consentements : trois formes coexistaient (consent_event du socle, consent avec granted_at et withdrawn_at côté Coach, consent avec une ligne par octroi et revoked_at côté Vie privée ; colonne type ou kind). Résolution : une seule table consent_event en ajout seulement, avec type health|ai_coach, action grant|withdraw, text_version et created_at. L'état courant est le dernier événement par type. Aucun type parental. Classe E, sans conflit.
- Pesées : weigh_in (Architecture), body_weight (Nutrition, Vie privée) et mesure_corporelle (ancien socle). Résolution : une seule table weigh_in, créée par la brique 5, de classe J, unique par (owner_id, date) non supprimée. mesure_corporelle est supprimée. La taille va dans nutrition_profile.height_cm et n'est saisie qu'à l'activation du module.
- Lieu : place (socle) contre location (Exercices, Programmes) ; workout_session.location_id. Résolution : table place, et workout_session.place_id.
- Réglages de charge : en grammes au socle (barG…), en kilogrammes dans Programmes (bar_kg…). Résolution : grammes partout (load_settings {barG, smallestPlateG, dumbbellsG[], machineStepG}), conformément à la règle « charges en grammes entiers » de Programmes.
- Décision du moteur : en colonnes dans performed_exercise (Programmes), en table engine_decision de classe D (Architecture). Résolution : table engine_decision 1-1 avec performed_exercise, calculée par le serveur. Les colonnes decision_* sont retirées de performed_exercise : une ligne de classe J ne doit pas porter de valeurs de classe D.
- InstanceChange : les listes d'auteurs et de statuts divergeaient (Coach ajoutait admin, cancelled, preview et resulting_revision ; thread_id ou coach_thread_id). Résolution : author user|coach|engine (l'admin n'a pas accès aux programmes des autres) ; status proposed|accepted|rejected|expired ; preview est recalculé par le domaine et n'est pas stocké ; resulting_revision est retiré (il vaut base_revision + 1) ; coach_thread_id prend ON DELETE SET NULL. Les opérations sont celles de Programmes, sans reduce_load, avec lighten_exercise sans paramètre (−10 % fixés par le code) et resume_slot réservé à l'utilisateur, l'IA ne pouvant pas lever une suspension.
- Mode prudent : Programmes associait « mode prudent (manuel) » à caution. Résolution : cautious_mode est le choix manuel non sanitaire (training_profile, C1) ; caution est l'indicateur C2 du questionnaire (health_screening) ; cautious est le profil calculé, vrai si mineur, si cautious_mode est actif, ou si le consentement santé est actif et caution vaut vrai. Le moteur reçoit age_band et cautious et ne lit jamais birth_date.
- Type de mouvement et fiche : Programmes attendait movement_type, laterality, chain {id, rang} et notForMinors ; Coach employait not_recommended_for_minors. Résolution : les noms de la fiche Exercices font foi (movement_pattern, unilateral, chain_id avec chain_rank calculé, not_for_minors). Les slots utilisent movementPattern.
- Profils de référence en double : REFERENCE_GYM_EQUIPMENT et HOME_BASE_EQUIPMENT (Programmes) contre REFERENCE_PROFILES (Exercices) ; « groupes de couverture » contre PATTERN_GROUPS. Résolution : seules REFERENCE_PROFILES et PATTERN_GROUPS sont gardées, dans packages/contracts/src/taxonomy.ts.
- Version du catalogue : catalog_meta (Exercices) contre server_meta.catalog_version (Architecture), et catalogMeta contre meta.catalogVersion côté Dexie. Résolution : server_meta porte catalog_version et catalog_updated_at, et catalog_meta est supprimée. Côté téléphone, meta.catalogVersion est la seule copie.
- Slugs : les fiches d'exercices avaient un slug français, les modèles de programme un slug anglais, et advice_sheet avait à la fois un id et un slug. Résolution, selon la convention « identifiants en anglais » : tous les slugs de contenu sont en anglais, en kebab-case et immuables ; advice_sheet.id est le slug. Les noms affichés restent en français.
- Modèles de programme : table program_template dans la classe C (Architecture) contre « fichier, pas une table » (Programmes). Résolution : ce sont des fichiers data/programs/*.json, servis dans le bloc catalogue de classe C, sans table.
- Illustrations : authors, modified et replace_before_publication (Vie privée) contre creators, modifications et replace_before_public (Exercices) ; illustration_manifest (Architecture). Résolution : la table illustration et les noms d'Exercices.
- Traçabilité de la rédaction : exercise.origin ai_reviewed|human (Vie privée) contre drafting.origin ai|human (Exercices) ; advice_sheet.draft_origin ai|manual. Résolution : ai|human partout, dans exercise.drafting et advice_sheet.draft_origin.
- Registres en double : entityRules (Architecture), DATA_CATEGORIES (Vie privée) et le registre des tables du socle. Résolution : un seul entityRules, avec category, syncClass, clientWritable, c2Columns, secretColumns, exported et onUserDelete, vérifié par un test sur le schéma.
- Catégorie des tables d'authentification : C3 pour les hachés côté socle, C0 ou C1 côté Vie privée. Résolution, selon Vie privée (propriétaire des catégories) : user (colonnes de compte), invitation, password_reset et security_event sont en C0 admin, car les règles C1 (propriétaire seul, export, suppression avec le compte) ne s'y appliquent pas ; session et consent_event restent en C1 ; les colonnes *_hash sont marquées secretColumns (jamais exportées, synchronisées ni journalisées). C3 reste réservé aux fils du coach et aux signalements.
- Colonnes de user : last_login_at contre last_seen_at, terms_version contre terms_version_accepted. Les colonnes du socle font foi. invitation.code_hash, avec le même code pour le lien et la saisie manuelle, remplace token_hash. birth_date est une date complète, contrôlée à 16 ans ou plus dès la création de l'invitation.
- Session : expires_at contre absolute_expires_at, closed_at contre revoked_at. Résolution : expires_at, revoked_at et revoked_reason ; user_id est nullable avec ON DELETE SET NULL pour la réponse 410 account_deleted. device_label est retiré, la liste des sessions visible par l'utilisateur étant reportée.
- security_event : actor_id et target_id (socle) contre actor_user_id et subject_user_id (Vie privée) ; C1 contre C0. Résolution : actor_id et target_id sans clé étrangère, outcome gardé, catégorie C0 admin, lecture réservée à l'admin, conservation 12 mois.
- coach_report : la relecture YAGNI le supprimait, mais la décision « coach ouvert aux 16-17 ans avec bouton Signaler » prime, donc la table est gardée. Les versions Coach et Vie privée sont fusionnées : exchange_text copie la réponse du coach signalée et le message de l'utilisateur qui la précède. La ligne est supprimée au classement par l'admin, au plus tard à 90 jours, au retrait du consentement coach ou avec le compte ; status et closed_at sont donc inutiles.
- Ressources d'aide : coachConfig.helpResources contre la constante HELP_RESOURCES de Nutrition. Résolution : une seule constante HELP_RESOURCES dans packages/contracts, à laquelle coachConfig fait référence.
- coach_call.cost_usd était décrit comme « décimal », type absent de STRICT. Résolution : cost_usd_micros INTEGER.
- La table settings (classe E) d'Architecture n'avait aucun contenu déclaré. Résolution : elle est supprimée ; les préférences existantes sont dans training_profile et place.
- slot_state : classe D (Architecture) alors que le moteur tourne sur le téléphone (Programmes). Résolution : le serveur fait foi et le pull écrase les valeurs ; le téléphone peut afficher une valeur provisoire calculée par packages/domain. La clé composite devient un id déterministe instance_id:slot_id:exercise_id.
- Clés composites en synchro : gym_equipment(gym_id, equipment_code) et home_equipment(place_id, equipment_code) n'avaient pas d'id, alors que la synchro en exige un. Résolution : un id déterministe (concaténation des clés) ; un ajout est un upsert qui remet deleted_at à NULL, un retrait pose une tombstone. Opérations idempotentes, sans conflit.
- Tables 1-1 (training_profile, health_screening, nutrition_profile) : user_id ou owner_id comme clé primaire, alors que la synchro exige un id. Résolution : id = owner_id.
- swap_reason = pain révèle une donnée de santé. Résolution : sans consentement santé, le serveur le remplace par NULL (applied_partial), comme pour pain_level et pain_streak. Vie privée exige qu'aucune opération ne soit rejetée faute de consentement : sync_rejection n'a donc pas de code consent_missing.
- nutrition_checkin : classée dans le journal par la synthèse, alors que Nutrition la fait écrire par le serveur. Résolution : classe D, et la réponse accepted|declined passe par l'API en ligne.
- Durée de vie des tombstones : 180 jours dans la synthèse, 90 jours dans Architecture. La valeur d'Architecture fait foi : TOMBSTONE_TTL = 90 jours, toujours supérieur à EPOCH_RESEND_DAYS = 60.

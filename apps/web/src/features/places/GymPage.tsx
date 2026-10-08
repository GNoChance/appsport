import {
  EQUIPMENT_LABELS,
  type EquipmentCode,
  EquipmentCodeSchema,
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  type GymDetail,
  type GymHistoryAction,
  type UpdateGymRequest,
} from '@appsport/contracts';
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { z } from 'zod';
import { useRepos } from '../../repos';
import { Banner, Button, errorMessage, Field, formatDateTime, Page, useAction } from '../../ui';
import { EquipmentChecklist, EquipmentList } from './EquipmentChecklist';
import styles from './places.module.css';

/** Entrées d'historique affichées (R-SAL-6). */
export const GYM_HISTORY_LIMIT = 10;

export const OFFLINE_GYM_TEXT = 'Hors ligne : dernière version connue.';
export const GYM_RIGHTS_TEXT = 'Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier.';

const ACTION_LABELS: Record<GymHistoryAction, string> = {
  create: 'Création de la salle',
  update_info: 'Nom ou ville modifiés',
  add_equipment: 'Matériel ajouté',
  remove_equipment: 'Matériel retiré',
  update_load_settings: 'Réglages de charge modifiés',
};

const EquipmentDetail = z.object({ code: EquipmentCodeSchema });

type HistoryEntry = GymDetail['history'][number];

function actionText(h: HistoryEntry): string {
  const label = ACTION_LABELS[h.action];
  if (h.action !== 'add_equipment' && h.action !== 'remove_equipment') return label;
  const detail = EquipmentDetail.safeParse(h.detail);
  return detail.success ? `${label} : ${EQUIPMENT_LABELS[detail.data.code]}` : label;
}

/**
 * « 06/10/2026 à 14:05 — Matériel ajouté : Kettlebell — modifié par lea ». Sans pseudo (compte
 * supprimé, ou auteur invisible à cette salle : le serveur ne le dit pas, R-VIS-4) : « un membre ».
 */
export function historyLine(h: HistoryEntry): string {
  return `${formatDateTime(h.at)} — ${actionText(h)} — modifié par ${h.authorUsername ?? 'un membre'}`;
}

const lengthError = (value: string, min: number, max: number) =>
  value.length < min || value.length > max ? `${min} à ${max} caractères.` : null;

type Loaded = { detail: GymDetail; offline: boolean };

/**
 * Fiche d'une salle (02 §10.4, §10.6) : nom, ville, matériel, « Qui va à cette salle » (pour tout
 * membre connecté, R-VIS-2) et les dernières modifications. Les membres qui l'ont parmi leurs lieux
 * (et les admins) la modifient en ligne (R-SAL-4) ; hors ligne, dernière version connue des miroirs,
 * en lecture seule (§1 principe 4).
 */
export function GymPage(p: { params: { id: string } }) {
  const repos = useRepos();
  const id = p.params.id;
  const [state, setState] = useState<{ loaded: Loaded | null; error: string | null }>({
    loaded: null,
    error: null,
  });
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const refresh = () => setReload((n) => n + 1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` relit la fiche
  useEffect(() => {
    let current = true;
    repos.gyms.detail(id).then(
      (loaded) => {
        if (current) setState({ loaded, error: null });
      },
      (error: unknown) => {
        if (current)
          setState((s) => ({ ...s, error: errorMessage(error, { not_found: 'Salle introuvable.' }) }));
      },
    );
    return () => {
      current = false;
    };
  }, [repos, id, reload]);

  const failure = state.error ? (
    <>
      <Banner tone="error">{state.error}</Banner>
      <Button variant="secondary" onClick={refresh}>
        Réessayer
      </Button>
    </>
  ) : null;

  if (!state.loaded) {
    return failure ? (
      <Page title="Salle" back="/profile/places">
        {failure}
      </Page>
    ) : null;
  }

  const { detail, offline } = state.loaded;
  const editable = detail.canEdit && !offline;

  return (
    <Page title={detail.name} back="/profile/places">
      {offline ? <Banner tone="info">{OFFLINE_GYM_TEXT}</Banner> : null}
      {failure}
      {editing && editable ? (
        <GymInfoForm
          detail={detail}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <p className={styles.meta}>{detail.city}</p>
      )}
      {editable && !editing ? (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        </div>
      ) : null}
      {offline || detail.canEdit ? null : <p className={styles.hint}>{GYM_RIGHTS_TEXT}</p>}
      <GymSection title="Matériel">
        {editable ? (
          <GymEquipment detail={detail} onSaved={refresh} />
        ) : (
          <EquipmentList value={detail.equipment} />
        )}
      </GymSection>
      <GymSection title="Qui va à cette salle">
        {offline ? (
          <p>Liste disponible en ligne</p>
        ) : detail.visibleMembers.length === 0 ? (
          <p>Personne n'est visible pour l'instant.</p>
        ) : (
          <ul className={styles.members}>
            {detail.visibleMembers.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </GymSection>
      <GymSection title="Dernières modifications">
        {offline ? (
          <p>Historique disponible en ligne</p>
        ) : detail.history.length === 0 ? (
          <p>Aucune modification.</p>
        ) : (
          <ol className={styles.history}>
            {detail.history.slice(0, GYM_HISTORY_LIMIT).map((h, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: entrées sans identifiant, liste en lecture seule remplacée d'un bloc
              <li key={i}>{historyLine(h)}</li>
            ))}
          </ol>
        )}
      </GymSection>
    </Page>
  );
}

function GymSection(p: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id}>{p.title}</h2>
      {p.children}
    </section>
  );
}

/** Nom et ville (R-SAL-2 : 2 à 60 caractères) ; seuls les champs changés partent (R-SAL-5). */
function GymInfoForm(p: { detail: GymDetail; onCancel(): void; onSaved(): void }) {
  const repos = useRepos();
  const [name, setName] = useState(p.detail.name);
  const [city, setCity] = useState(p.detail.city);
  const [errors, setErrors] = useState<{ name: string | null; city: string | null }>({
    name: null,
    city: null,
  });
  const save = useAction(async (r: UpdateGymRequest) => {
    await repos.gyms.update(p.detail.id, r);
    p.onSaved();
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = city.trim();
    const next = {
      name: lengthError(n, GYM_NAME_MIN, GYM_NAME_MAX),
      city: lengthError(c, GYM_CITY_MIN, GYM_CITY_MAX),
    };
    setErrors(next);
    if (next.name || next.city) return;
    const patch = {
      ...(n !== p.detail.name ? { name: n } : {}),
      ...(c !== p.detail.city ? { city: c } : {}),
    };
    if (Object.keys(patch).length === 0) p.onCancel();
    else void save.run(patch);
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <Field label="Nom de la salle" error={errors.name}>
        <input type="text" maxLength={GYM_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Ville" error={errors.city}>
        <input type="text" maxLength={GYM_CITY_MAX} value={city} onChange={(e) => setCity(e.target.value)} />
      </Field>
      {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={save.pending}>
          Enregistrer
        </Button>
        <Button variant="secondary" onClick={p.onCancel} disabled={save.pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/**
 * Matériel modifiable : « ajouter X » (PUT) et « retirer X » (DELETE), idempotents (R-SAL-5). La
 * case suit le choix jusqu'à la fiche relue ; un échec la remet.
 */
function GymEquipment(p: { detail: GymDetail; onSaved(): void }) {
  const repos = useRepos();
  const [draft, setDraft] = useState<EquipmentCode[] | null>(null);
  const toggle = useAction(async (code: EquipmentCode, present: boolean) => {
    await repos.gyms.setEquipment(p.detail.id, code, present);
    return true;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque fiche relue efface le brouillon
  useEffect(() => setDraft(null), [p.detail]);

  async function change(next: EquipmentCode[]) {
    const current = draft ?? p.detail.equipment;
    const added = next.find((c) => !current.includes(c));
    const code = added ?? current.find((c) => !next.includes(c));
    if (code === undefined) return;
    setDraft(next);
    if (await toggle.run(code, added !== undefined)) p.onSaved();
    else setDraft(null);
  }

  return (
    <>
      {toggle.error ? <Banner tone="error">{toggle.error}</Banner> : null}
      <EquipmentChecklist
        kind="gym"
        value={draft ?? p.detail.equipment}
        onChange={(next) => void change(next)}
        disabled={toggle.pending}
      />
    </>
  );
}

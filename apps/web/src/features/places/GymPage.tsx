import {
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  type GymDetail,
  type UpdateGymRequest,
} from '@rune/contracts';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { useLive, useMe } from '../../app-services';
import { type PlaceView, useRepos } from '../../repos';
import { Banner, Button, Dialog, errorMessage, Field, Page, plural, Switch, useAction } from '../../ui';
import { EquipmentChips } from './EquipmentChips';
import { EquipmentEditor } from './EquipmentEditor';
import { GymHistory } from './GymHistory';
import { MemberAvatars, membersOrder, membersText } from './GymMembers';
import { MINOR_VISIBILITY_HINT } from './GymPicker';
import { PencilIcon, PeopleIcon, PinIcon } from './icons';
import { PLACE_ERRORS, PlaceActions } from './PlaceActions';
import styles from './places.module.css';
import { useSubScreen } from './SubScreen';

/** Entrées d'historique affichées (R-SAL-6). */
export const GYM_HISTORY_LIMIT = 10;

export const OFFLINE_GYM_TEXT = 'Hors ligne : dernière version connue.';
export const GYM_RIGHTS_TEXT = 'Seuls les membres qui ont cette salle parmi leurs lieux peuvent la modifier.';
export const GYM_DELETED_TEXT = 'Cette salle a été supprimée.';

const lengthError = (value: string, min: number, max: number) =>
  value.length < min || value.length > max ? `${min} à ${max} caractères.` : null;

type Loaded = { detail: GymDetail; offline: boolean };
/** Échec du chargement ; « Réessayer » sauf pour une salle inconnue, qui ne viendra pas. */
type Failure = { message: string; retry: boolean };

/**
 * Fiche d'une salle (maquette D02, 02 §10.4, §10.6) : nom, ville, « Qui va à cette salle » (pour tout membre
 * connecté, R-VIS-2) avec l'interrupteur de visibilité de l'utilisateur s'il l'a parmi ses lieux, le matériel
 * par catégorie, l'historique en frise, puis les actions de son lieu (spec refonte §10.3). Les membres qui
 * l'ont parmi leurs lieux (et les admins) la modifient en ligne (R-SAL-4) : nom et ville dans une feuille,
 * matériel dans l'écran Matériel, en brouillon. Hors ligne, dernière version connue des miroirs, en lecture
 * seule (§1 principe 4). Salle supprimée (R-SAL-7) : signalée, en lecture seule, sans liste des membres.
 */
export function GymPage(p: { params: { id: string } }) {
  const repos = useRepos();
  const me = useMe();
  const id = p.params.id;
  const places = useLive(() => repos.places.list(), [repos]);
  const [state, setState] = useState<{ loaded: Loaded | null; error: Failure | null }>({
    loaded: null,
    error: null,
  });
  const [editingInfo, setEditingInfo] = useState(false);
  const sub = useSubScreen<'equipment'>();
  const editInfoId = useId();
  const editEquipmentId = useId();
  const whoId = useId();
  const materialId = useId();
  const historyId = useId();
  /** Lecture en cours : une réponse arrivée après une lecture plus récente (ou le départ) est ignorée. */
  const reads = useRef(0);

  const load = useCallback(async () => {
    const read = ++reads.current;
    try {
      const loaded = await repos.gyms.detail(id);
      if (read === reads.current) setState({ loaded, error: null });
    } catch (error) {
      if (read !== reads.current) return;
      const message = errorMessage(error, { not_found: 'Salle introuvable.' });
      const retry = !(error instanceof ApiError && error.code === 'not_found');
      setState((s) => ({ ...s, error: { message, retry } }));
    }
  }, [repos, id]);

  useEffect(() => {
    void load();
    return () => {
      reads.current += 1;
    };
  }, [load]);

  const failure = state.error ? (
    <>
      <Banner tone="error">{state.error.message}</Banner>
      {state.error.retry ? (
        <Button variant="secondary" onClick={() => void load()}>
          Réessayer
        </Button>
      ) : null}
    </>
  ) : null;

  if (!state.loaded) {
    return failure ? (
      <Page title="Salle" back="/places">
        {failure}
      </Page>
    ) : null;
  }

  const { detail, offline } = state.loaded;
  const editable = detail.canEdit && !offline;
  const deleted = detail.deletedAt !== null;
  const myPlace = places?.find((pl) => pl.kind === 'gym' && pl.gymId === id) ?? null;
  const count = detail.equipment.length;

  if (sub.mode === 'equipment') {
    return (
      <EquipmentEditor
        kind="gym"
        placeName={detail.name}
        initial={detail.equipment}
        send={(code, present) => repos.gyms.setEquipment(id, code, present)}
        reread={load}
        onSaved={sub.close}
        onBack={sub.close}
      />
    );
  }

  return (
    <div className={[styles.fiche, sub.back ? styles.screenBack : null].filter(Boolean).join(' ')}>
      <Page title={detail.name} back="/places">
        {editable ? (
          <button
            id={editInfoId}
            type="button"
            aria-label="Modifier le nom ou la ville"
            className={styles.headAction}
            onClick={() => setEditingInfo(true)}
          >
            <PencilIcon />
          </button>
        ) : null}
        <ul className={styles.tags}>
          <li className={styles.tag}>
            <PinIcon />
            {`Salle · ${detail.city}`}
          </li>
          <li className={styles.tag} data-tone="accent">
            <PeopleIcon />
            Partagée avec le cercle
          </li>
        </ul>
        {offline ? <Banner tone="info">{OFFLINE_GYM_TEXT}</Banner> : null}
        {failure}
        {deleted ? <Banner tone="warning">{GYM_DELETED_TEXT}</Banner> : null}
        {offline || deleted || detail.canEdit ? null : <p className={styles.hint}>{GYM_RIGHTS_TEXT}</p>}
        <div className={`stagger ${styles.stack}`}>
          {deleted ? null : (
            <section aria-labelledby={whoId} className={styles.whoCard}>
              <div className={styles.whoText}>
                <h2 id={whoId} className={styles.whoTitle}>
                  Qui va à cette salle
                </h2>
                {offline ? (
                  <p className={styles.whoLine}>Liste disponible en ligne</p>
                ) : detail.visibleMembers.length === 0 ? (
                  <p className={styles.whoLine}>Personne n'est visible pour l'instant.</p>
                ) : (
                  <p className={styles.whoLine}>
                    <MemberAvatars names={membersOrder(detail.visibleMembers, me?.username ?? null)} />
                    <span>{membersText(detail.visibleMembers, me?.username ?? null)}</span>
                  </p>
                )}
              </div>
              {myPlace ? (
                <VisibilitySwitch place={myPlace} minor={me?.ageBand === 'minor'} onSaved={load} />
              ) : null}
            </section>
          )}
          <section aria-labelledby={materialId} className={styles.card}>
            <div className={styles.cardHead}>
              <h2 id={materialId} className={styles.cardTitle}>
                Matériel
              </h2>
              <span className={styles.countBadge}>
                {count}
                <span className={styles.srOnly}> {plural(count, 'équipement', 'équipements')}</span>
              </span>
              {editable ? (
                <button
                  id={editEquipmentId}
                  type="button"
                  className={styles.smallButton}
                  onClick={() => sub.open('equipment', editEquipmentId)}
                >
                  <PencilIcon size={16} />
                  Modifier<span className={styles.srOnly}> le matériel</span>
                </button>
              ) : null}
            </div>
            <EquipmentChips kind="gym" value={detail.equipment} />
          </section>
          <section aria-labelledby={historyId} className={styles.card}>
            <h2 id={historyId} className={styles.cardTitle}>
              Dernières modifications
            </h2>
            {offline ? (
              <p className={styles.hint}>Historique disponible en ligne</p>
            ) : detail.history.length === 0 ? (
              <p className={styles.hint}>Aucune modification.</p>
            ) : (
              <GymHistory entries={detail.history.slice(0, GYM_HISTORY_LIMIT)} />
            )}
          </section>
          {myPlace && places ? <PlaceActions place={myPlace} places={places} /> : null}
        </div>
      </Page>
      {editingInfo && editable ? (
        <GymInfoSheet detail={detail} onClose={() => setEditingInfo(false)} onSaved={load} />
      ) : null}
    </div>
  );
}

/**
 * Interrupteur « Visible » de « Qui va à cette salle » (R-VIS-3 ; désactivé par défaut pour un mineur,
 * P-MIN-6, qui garde le choix) : le choix s'affiche jusqu'à la relecture du miroir, un échec le remet ; la
 * liste des membres est relue après l'envoi. Son nom dit ce qui devient visible, même lu hors de la section
 * (maquette D02 : « Visible dans « Qui va à cette salle » », la suite pour les lecteurs d'écran).
 */
function VisibilitySwitch(p: { place: PlaceView; minor: boolean; onSaved(): Promise<void> }) {
  const repos = useRepos();
  const id = useId();
  const [draft, setDraft] = useState<boolean | null>(null);
  const update = useAction(async (visibleAtGym: boolean) => {
    await repos.places.update(p.place.id, { visibleAtGym });
    return true;
  }, PLACE_ERRORS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du lieu efface le choix affiché
  useEffect(() => setDraft(null), [p.place]);

  async function change(visibleAtGym: boolean) {
    setDraft(visibleAtGym);
    if (await update.run(visibleAtGym)) await p.onSaved();
    else setDraft(null);
  }

  return (
    <>
      <div className={styles.whoSwitch}>
        <Switch
          id={id}
          label="Visible"
          labelSuffix="dans « Qui va à cette salle »"
          checked={draft ?? p.place.visibleAtGym === true}
          disabled={update.pending}
          help={p.minor ? MINOR_VISIBILITY_HINT : undefined}
          onChange={(v) => void change(v)}
        />
      </div>
      {update.error ? (
        <div className={styles.whoError}>
          <Banner tone="error">{update.error}</Banner>
        </div>
      ) : null}
    </>
  );
}

/**
 * Nom et ville dans une feuille du bas (R-SAL-2 : 2 à 60 caractères), focus au nom ; seuls les champs changés
 * depuis l'ouverture partent (R-SAL-5). Enregistré : la fiche est relue, puis la feuille se ferme et rend le
 * focus au bouton qui l'a ouverte.
 */
function GymInfoSheet(p: { detail: GymDetail; onClose(): void; onSaved(): Promise<void> }) {
  const repos = useRepos();
  const formId = useId();
  const [initial] = useState(() => ({ name: p.detail.name, city: p.detail.city }));
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState(initial.city);
  const focusOnMount = useCallback((el: HTMLInputElement | null) => el?.focus(), []);
  const [errors, setErrors] = useState<{ name: string | null; city: string | null }>({
    name: null,
    city: null,
  });
  const save = useAction(async (r: UpdateGymRequest) => {
    await repos.gyms.update(p.detail.id, r);
    await p.onSaved();
    p.onClose();
  });
  const pending = useRef(false);
  pending.current = save.pending;
  const { onClose } = p;
  const close = useCallback(() => {
    if (!pending.current) onClose();
  }, [onClose]);

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
      ...(n !== initial.name ? { name: n } : {}),
      ...(c !== initial.city ? { city: c } : {}),
    };
    if (Object.keys(patch).length === 0) onClose();
    else void save.run(patch);
  }

  return (
    <Dialog
      open
      title="Modifier la salle"
      onClose={close}
      actions={
        <>
          <Button type="submit" form={formId} disabled={save.pending}>
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Annuler
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={submit}>
        <Field label="Nom de la salle" error={errors.name}>
          <input
            ref={focusOnMount}
            type="text"
            maxLength={GYM_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Ville" error={errors.city}>
          <input
            type="text"
            maxLength={GYM_CITY_MAX}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>
        {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      </form>
    </Dialog>
  );
}

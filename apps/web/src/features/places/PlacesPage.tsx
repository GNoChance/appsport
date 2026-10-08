import {
  type ApiErrorCode,
  type EquipmentCode,
  HOME_DEFAULT_PRESET,
  HOME_PLACE_DEFAULT_NAME,
  PLACE_NAME_MAX,
  PRESET_IDS,
  PRESETS,
  type PresetId,
  type UpdatePlaceRequest,
} from '@appsport/contracts';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useLive, useMe } from '../../app-services';
import { type PlaceView, useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Dialog, Field, Page, useAction } from '../../ui';
import { EquipmentChecklist, sortEquipment } from './EquipmentChecklist';
import { GymPicker, MINOR_VISIBILITY_HINT } from './GymPicker';
import styles from './places.module.css';

export const KEEP_ONE_PLACE = 'Tu dois garder au moins un lieu.';
export const CHOOSE_PRIMARY_FIRST = "Choisis d'abord un nouveau lieu principal.";
const NAME_REQUIRED = 'Donne un nom à ce lieu.';
export const VISIBLE_HINT = 'Coché : ton pseudo apparaît dans « Qui va à cette salle ».';
const HOME_PRESETS = PRESET_IDS.filter((id) => PRESETS[id].kind === 'home');

/** Refus du serveur sur les lieux, avec les mots de cet écran (R-LIEU-1, R-LIEU-4). */
const PLACE_ERRORS: Partial<Record<ApiErrorCode, string>> = {
  last_place: KEEP_ONE_PLACE,
  primary_required: CHOOSE_PRIMARY_FIRST,
};

/** Ref de rappel : l'élément prend le focus dès qu'il apparaît (formulaire ouvert par un bouton). */
const focusOnMount = (el: HTMLElement | null) => el?.focus();

/**
 * Profil › Lieux (02 §11) : le principal d'abord ; choisir le principal, renommer une maison, régler
 * la visibilité d'une salle, supprimer (jamais le dernier lieu, le principal seulement avec un
 * successeur), ajouter une salle ou une maison. Chaque écriture demande le réseau (§1 principe 4).
 * Focus : un formulaire ouvert le prend (titre ou champ) et le rend au bouton qui l'a ouvert ; après
 * une suppression, il va au lieu suivant.
 */
export function PlacesPage() {
  const repos = useRepos();
  const me = useMe();
  const places = useLive(() => repos.places.list(), [repos]);
  const [adding, setAdding] = useState<'gym' | 'home' | null>(null);
  const addId = useId();
  const addGymId = useId();
  const addHomeId = useId();
  const returnTo = useRef<'gym' | 'home' | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (adding !== null || returnTo.current === null) return;
    document.getElementById(returnTo.current === 'gym' ? addGymId : addHomeId)?.focus();
    returnTo.current = null;
  }, [adding, addGymId, addHomeId]);

  if (!me || places === undefined) return null;
  const minor = me.ageBand === 'minor';

  function closeAdd() {
    returnTo.current = adding;
    setAdding(null);
  }

  /** Lieu supprimé : le focus va au lien du lieu suivant (du précédent pour le dernier). */
  function removed(id: string) {
    const list = places ?? [];
    const i = list.findIndex((o) => o.id === id);
    const next = list[i + 1] ?? list[i - 1];
    const links = listRef.current?.querySelectorAll<HTMLElement>('[data-place]') ?? [];
    Array.from(links)
      .find((a) => a.dataset.place === next?.id)
      ?.focus();
  }

  return (
    <Page title="Lieux" back="/profile">
      {places.length > 0 ? (
        <ul ref={listRef} className={styles.places}>
          {places.map((place) => (
            <PlaceItem
              key={place.id}
              place={place}
              others={places.filter((o) => o.id !== place.id)}
              minor={minor}
              onRemoved={() => removed(place.id)}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Aucun lieu.</p>
      )}
      {adding === 'gym' ? (
        <section aria-labelledby={addId} className={styles.section}>
          <h2 id={addId} ref={focusOnMount} tabIndex={-1}>
            Ajouter une salle
          </h2>
          <GymPicker isPrimary={false} defaultVisible={!minor} onDone={closeAdd} />
          <Button variant="secondary" onClick={closeAdd}>
            Annuler
          </Button>
        </section>
      ) : null}
      {adding === 'home' ? <HomeCreate onDone={closeAdd} /> : null}
      {adding === null ? (
        <div className={styles.actions}>
          <Button id={addGymId} variant="secondary" onClick={() => setAdding('gym')}>
            Ajouter une salle
          </Button>
          <Button id={addHomeId} variant="secondary" onClick={() => setAdding('home')}>
            Ajouter une maison
          </Button>
        </div>
      ) : null}
    </Page>
  );
}

/**
 * Un lieu de la liste ; ses boutons et sa case sont décrits par son nom (plusieurs « Supprimer » à
 * l'écran). Renommage ou boîte de suppression fermés : le focus revient au bouton qui les a ouverts.
 */
function PlaceItem(p: { place: PlaceView; others: PlaceView[]; minor: boolean; onRemoved(): void }) {
  const repos = useRepos();
  const { place } = p;
  const nameId = useId();
  const reasonId = useId();
  const visibleHintId = useId();
  const minorHintId = useId();
  const renameId = useId();
  const removeId = useId();
  const returnTo = useRef<'rename' | 'remove' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(place.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [visibleDraft, setVisibleDraft] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const update = useAction(async (r: UpdatePlaceRequest) => {
    await repos.places.update(place.id, r);
    return true;
  }, PLACE_ERRORS);
  const last = p.others.length === 0;

  // Visibilité : le choix s'affiche jusqu'à la relecture du miroir (pull après l'envoi).
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du lieu efface le brouillon
  useEffect(() => setVisibleDraft(null), [place]);

  useEffect(() => {
    if (renaming || deleting || returnTo.current === null) return;
    document.getElementById(returnTo.current === 'rename' ? renameId : removeId)?.focus();
    returnTo.current = null;
  }, [renaming, deleting, renameId, removeId]);

  // Stable : la boîte de dialogue reprend le focus à chaque nouveau `onClose`.
  const closeDelete = useCallback(() => {
    returnTo.current = 'remove';
    setDeleting(false);
  }, []);

  function closeRename() {
    returnTo.current = 'rename';
    setRenaming(false);
  }

  async function changeVisible(visibleAtGym: boolean) {
    setVisibleDraft(visibleAtGym);
    if (!(await update.run({ visibleAtGym }))) setVisibleDraft(null);
  }

  function startRename() {
    update.reset();
    setName(place.name);
    setNameError(null);
    setRenaming(true);
  }

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (next === '') {
      setNameError(NAME_REQUIRED);
      return;
    }
    setNameError(null);
    if (next === place.name || (await update.run({ name: next }))) closeRename();
  }

  return (
    <li className={styles.place}>
      <div className={styles.placeHead}>
        <Link
          id={nameId}
          data-place={place.id}
          href={`/profile/places/${place.id}`}
          className={styles.placeName}
        >
          {place.name}
        </Link>
        {place.isPrimary ? <span className={styles.badge}>Principal</span> : null}
      </div>
      <p className={styles.meta}>
        {place.kind === 'gym' ? (place.city ? `Salle · ${place.city}` : 'Salle') : 'Maison'}
      </p>
      {place.kind === 'gym' ? (
        <div className={styles.visibility}>
          <label className={styles.item}>
            <input
              type="checkbox"
              checked={visibleDraft ?? place.visibleAtGym === true}
              disabled={update.pending}
              aria-describedby={[nameId, visibleHintId, p.minor ? minorHintId : null]
                .filter(Boolean)
                .join(' ')}
              onChange={(e) => void changeVisible(e.target.checked)}
            />
            Visible à la salle
          </label>
          <span id={visibleHintId} className={styles.hint}>
            {VISIBLE_HINT}
          </span>
          {p.minor ? (
            <span id={minorHintId} className={styles.hint}>
              {MINOR_VISIBILITY_HINT}
            </span>
          ) : null}
        </div>
      ) : null}
      {renaming ? (
        <form className={styles.form} noValidate onSubmit={(e) => void submitRename(e)}>
          <Field label="Nom du lieu" error={nameError}>
            <input
              ref={focusOnMount}
              type="text"
              maxLength={PLACE_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className={styles.actions}>
            <Button type="submit" aria-describedby={nameId} disabled={update.pending}>
              Enregistrer
            </Button>
            <Button
              variant="secondary"
              aria-describedby={nameId}
              onClick={closeRename}
              disabled={update.pending}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}
      {update.error ? <Banner tone="error">{update.error}</Banner> : null}
      <div className={styles.actions}>
        {place.isPrimary ? null : (
          <Button
            variant="secondary"
            aria-describedby={nameId}
            disabled={update.pending}
            onClick={() => void update.run({ isPrimary: true })}
          >
            Définir comme principal
          </Button>
        )}
        {place.kind === 'home' && !renaming ? (
          <Button id={renameId} variant="secondary" aria-describedby={nameId} onClick={startRename}>
            Renommer
          </Button>
        ) : null}
        <Button
          id={removeId}
          variant="danger"
          aria-describedby={last ? `${nameId} ${reasonId}` : nameId}
          disabled={last}
          onClick={() => setDeleting(true)}
        >
          Supprimer
        </Button>
      </div>
      {last ? (
        <p id={reasonId} className={styles.hint}>
          {KEEP_ONE_PLACE}
        </p>
      ) : null}
      {deleting ? (
        <DeletePlaceDialog
          place={place}
          others={p.others}
          onClose={closeDelete}
          onDeleted={() => {
            setDeleting(false);
            p.onRemoved();
          }}
        />
      ) : null}
    </li>
  );
}

/**
 * Suppression d'un lieu (R-LIEU-4, R-LIEU-5) : le principal exige d'en désigner un autre ; le lieu
 * est marqué supprimé, les séances passées y restent rattachées. `onClose` donné à la boîte reste
 * le même pendant l'envoi (la boîte reprendrait sinon le focus) : l'envoi en cours est lu dans une ref.
 */
function DeletePlaceDialog(p: { place: PlaceView; others: PlaceView[]; onClose(): void; onDeleted(): void }) {
  const repos = useRepos();
  const choiceName = useId();
  const [newPrimary, setNewPrimary] = useState<string | null>(null);
  const remove = useAction(async () => {
    await repos.places.remove(
      p.place.id,
      p.place.isPrimary && newPrimary !== null ? { newPrimaryId: newPrimary } : {},
    );
    p.onDeleted();
  }, PLACE_ERRORS);
  const blocked = p.place.isPrimary && newPrimary === null;
  const pending = useRef(false);
  pending.current = remove.pending;
  const { onClose } = p;
  const close = useCallback(() => {
    if (!pending.current) onClose();
  }, [onClose]);

  return (
    <Dialog
      open
      title={`Supprimer ${p.place.name} ?`}
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={p.onClose} disabled={remove.pending}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => void remove.run()} disabled={blocked || remove.pending}>
            Supprimer
          </Button>
        </>
      }
    >
      <div className={styles.section}>
        <p>Le lieu sera retiré de ta liste. Les séances passées y restent rattachées.</p>
        {p.place.isPrimary ? (
          <ChoiceList<string>
            name={choiceName}
            legend="Nouveau lieu principal"
            value={newPrimary}
            onChange={setNewPrimary}
            options={p.others.map((o) => ({ value: o.id, label: o.name }))}
          />
        ) : null}
        {remove.error ? <Banner tone="error">{remove.error}</Banner> : null}
      </div>
    </Dialog>
  );
}

/** Ajout d'une maison (R-LIEU-3) : nom (« Maison » par défaut), préréglage, puis la liste pré-cochée. */
function HomeCreate(p: { onDone(): void }) {
  const repos = useRepos();
  const titleId = useId();
  const [name, setName] = useState(HOME_PLACE_DEFAULT_NAME);
  const [nameError, setNameError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetId>(HOME_DEFAULT_PRESET);
  const [equipment, setEquipment] = useState<EquipmentCode[]>(() =>
    sortEquipment(PRESETS[HOME_DEFAULT_PRESET].equipment),
  );
  const create = useAction(async () => {
    await repos.places.create({ kind: 'home', name: name.trim(), equipment, isPrimary: false });
    p.onDone();
  });

  function choosePreset(id: PresetId) {
    setPreset(id);
    setEquipment(sortEquipment(PRESETS[id].equipment));
  }

  function submit() {
    if (name.trim() === '') {
      setNameError(NAME_REQUIRED);
      return;
    }
    setNameError(null);
    void create.run();
  }

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h2 id={titleId} ref={focusOnMount} tabIndex={-1}>
        Ajouter une maison
      </h2>
      <Field label="Nom du lieu" error={nameError}>
        <input
          type="text"
          maxLength={PLACE_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <ChoiceList<PresetId>
        name="home-preset"
        legend="Ton matériel"
        value={preset}
        onChange={choosePreset}
        options={HOME_PRESETS.map((id) => ({ value: id, label: PRESETS[id].label }))}
      />
      <EquipmentChecklist kind="home" value={equipment} onChange={setEquipment} />
      {create.error ? <Banner tone="error">{create.error}</Banner> : null}
      <div className={styles.actions}>
        <Button onClick={submit} disabled={create.pending}>
          Ajouter la maison
        </Button>
        <Button variant="secondary" onClick={p.onDone} disabled={create.pending}>
          Annuler
        </Button>
      </div>
    </section>
  );
}

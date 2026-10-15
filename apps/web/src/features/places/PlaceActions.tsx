import { type ApiErrorCode, PLACE_NAME_MAX, type UpdatePlaceRequest } from '@rune/contracts';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { type PlaceView, useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Dialog, Field, ListRow, Switch, useAction } from '../../ui';
import { PencilIcon, StarIcon, TrashIcon } from './icons';
import styles from './places.module.css';

export const KEEP_ONE_PLACE = 'Tu dois garder au moins un lieu.';
export const CHOOSE_PRIMARY_FIRST = "Choisis d'abord un nouveau lieu principal.";
export const NAME_REQUIRED = 'Donne un nom à ce lieu.';
export const PRIMARY_NOTE = "Ton lieu principal : là où tu t'entraînes le plus souvent.";
const PRIMARY_LOCKED = 'Pour en changer, active-le sur un autre lieu.';
const REMOVE_TEXT = 'Le lieu sera retiré de ta liste. Les séances passées y restent rattachées.';

/** Refus du serveur sur les lieux, avec les mots de ces écrans (R-LIEU-1, R-LIEU-4). */
export const PLACE_ERRORS: Partial<Record<ApiErrorCode, string>> = {
  last_place: KEEP_ONE_PLACE,
  primary_required: CHOOSE_PRIMARY_FIRST,
};

/** Ref de rappel : l'élément prend le focus dès qu'il apparaît (champ d'une feuille ouverte). */
const focusOnMount = (el: HTMLElement | null) => el?.focus();

/**
 * Actions d'un lieu, en bas de sa fiche (spec refonte §10.3, maquette D05) : le nom d'une maison, l'interrupteur
 * « Lieu principal », puis la zone sensible et sa suppression. L'interrupteur est verrouillé, coché, sur le
 * lieu principal actuel : l'API ne sait pas l'enlever, on en change en l'activant sur un autre lieu. Chaque
 * écriture demande le réseau ; supprimer ramène à la liste.
 */
export function PlaceActions(p: { place: PlaceView; places: readonly PlaceView[] }) {
  const { place } = p;
  const [renaming, setRenaming] = useState(false);
  const others = p.places.filter((o) => o.id !== place.id);
  const primary = p.places.find((o) => o.isPrimary);
  return (
    <>
      <div className={styles.actionsBlock}>
        <ul className={styles.actionsCard}>
          {place.kind === 'home' ? (
            <ListRow
              icon={<PencilIcon />}
              label="Nom du lieu"
              value={place.name}
              onClick={() => setRenaming(true)}
            />
          ) : null}
          <PrimarySwitch place={place} primaryName={primary?.name ?? null} />
        </ul>
        <p className={styles.hint}>{PRIMARY_NOTE}</p>
        {renaming ? <RenameDialog place={place} onClose={() => setRenaming(false)} /> : null}
      </div>
      <DangerZone place={place} others={others} />
    </>
  );
}

/** Renommer une maison (R-LIEU-3 : 30 caractères au plus) dans une feuille du bas, focus au champ. */
function RenameDialog(p: { place: PlaceView; onClose(): void }) {
  const repos = useRepos();
  const formId = useId();
  const [name, setName] = useState(p.place.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const update = useAction(async (r: UpdatePlaceRequest) => {
    await repos.places.update(p.place.id, r);
    return true;
  }, PLACE_ERRORS);
  const pending = useRef(false);
  pending.current = update.pending;
  const { onClose } = p;
  const close = useCallback(() => {
    if (!pending.current) onClose();
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (next === '') {
      setNameError(NAME_REQUIRED);
      return;
    }
    setNameError(null);
    if (next === p.place.name || (await update.run({ name: next }))) onClose();
  }

  return (
    <Dialog
      open
      title="Renommer le lieu"
      onClose={close}
      actions={
        <>
          <Button type="submit" form={formId} disabled={update.pending}>
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={update.pending}>
            Annuler
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
        <Field label="Nom du lieu" error={nameError}>
          <input
            ref={focusOnMount}
            type="text"
            maxLength={PLACE_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {update.error ? <Banner tone="error">{update.error}</Banner> : null}
      </form>
    </Dialog>
  );
}

/**
 * « Lieu principal » : activé, il envoie { isPrimary: true } et suit le choix jusqu'à la relecture du
 * miroir ; un échec le remet. Sur le lieu principal, coché et verrouillé.
 */
function PrimarySwitch(p: { place: PlaceView; primaryName: string | null }) {
  const repos = useRepos();
  const id = useId();
  const [chosen, setChosen] = useState(false);
  const update = useAction(async () => {
    await repos.places.update(p.place.id, { isPrimary: true });
    return true;
  }, PLACE_ERRORS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque lecture du lieu efface le choix affiché
  useEffect(() => setChosen(false), [p.place]);

  async function choose(on: boolean) {
    if (!on || p.place.isPrimary) return;
    setChosen(true);
    if (!(await update.run())) setChosen(false);
  }

  const help = p.place.isPrimary ? PRIMARY_LOCKED : p.primaryName ? `Actuel : ${p.primaryName}` : undefined;
  return (
    <li className={styles.switchItem}>
      <div className={styles.switchLine}>
        <span className={styles.rowIcon} aria-hidden="true">
          <StarIcon size={18} />
        </span>
        <div className={styles.switchGrow}>
          <Switch
            id={id}
            label="Lieu principal"
            checked={p.place.isPrimary || chosen}
            disabled={p.place.isPrimary || update.pending}
            help={help}
            onChange={(on) => void choose(on)}
          />
        </div>
      </div>
      {update.error ? <Banner tone="error">{update.error}</Banner> : null}
    </li>
  );
}

/** Zone sensible (maquette D05) : la suppression, seule, en bas ; impossible sur le dernier lieu (R-LIEU-1). */
function DangerZone(p: { place: PlaceView; others: readonly PlaceView[] }) {
  const titleId = useId();
  const reasonId = useId();
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const last = p.others.length === 0;
  const close = useCallback(() => setDeleting(false), []);
  return (
    <section aria-labelledby={titleId} className={styles.danger}>
      <h2 id={titleId} className={styles.dangerTitle}>
        <TrashIcon />
        Zone sensible
      </h2>
      <p className={styles.dangerText}>{REMOVE_TEXT}</p>
      <Button
        variant="danger"
        block
        disabled={last}
        aria-describedby={last ? reasonId : undefined}
        onClick={() => setDeleting(true)}
      >
        Supprimer ce lieu
      </Button>
      {last ? (
        <p id={reasonId} className={styles.hint}>
          {KEEP_ONE_PLACE}
        </p>
      ) : null}
      {deleting ? (
        <DeletePlaceDialog
          place={p.place}
          others={p.others}
          onClose={close}
          onDeleted={() => navigate('/places')}
        />
      ) : null}
    </section>
  );
}

/**
 * Suppression d'un lieu (R-LIEU-4, R-LIEU-5) : le principal exige d'en désigner un autre ; le lieu est marqué
 * supprimé, les séances passées y restent rattachées. Pendant l'envoi, Échap ne ferme pas la feuille.
 */
function DeletePlaceDialog(p: {
  place: PlaceView;
  others: readonly PlaceView[];
  onClose(): void;
  onDeleted(): void;
}) {
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
          <Button variant="secondary" onClick={onClose} disabled={remove.pending}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => void remove.run()} disabled={blocked || remove.pending}>
            Supprimer
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <p>{REMOVE_TEXT}</p>
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

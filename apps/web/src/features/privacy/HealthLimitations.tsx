import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, ListGroup, ListRow, useAction } from '../../ui';
import { useLimitationDraft } from '../onboarding/HealthStep';
import { LimitationEditForm, LimitationFields, limitationLabel } from '../onboarding/LimitationFields';
import { PencilIcon, PlusIcon, TrashIcon } from '../profile/icons';
import styles from './privacy.module.css';

/** Ligne qui ouvre l'ajout, et nom du formulaire qu'elle ouvre. */
const ADD_LABEL = 'Ajouter une limitation';

/** Mention des limitations (E7.3), la même que dans l'onboarding. */
const LIMITATIONS_NOTE =
  "Facultatif : une zone sensible ou une gêne à ménager ; aucun diagnostic n'est nécessaire.";

/**
 * Profil › Santé › Limitations (E7.3, P-DRT-2, spec refonte §10.4, maquette C04) : une carte liste les
 * limitations, chacune avec « Modifier » et « Supprimer » (boutons de 44 × 44 décrits par la limitation), et se
 * termine par la ligne « Ajouter une limitation » : aucun champ n'est affiché avant qu'elle ne l'ouvre.
 * - la ligne laisse sa place au formulaire d'ajout ; « Annuler » ou l'ajout fait le referment ;
 * - « Modifier » remplace la limitation par son formulaire, un seul à la fois : tant qu'il est ouvert (envoi
 *   compris), les autres « Modifier » attendent ; la limitation disparue (supprimée ailleurs), ils se libèrent ;
 * - un formulaire refermé rend le focus au bouton ou à la ligne qui l'a ouvert.
 */
export function HealthLimitations() {
  const repos = useRepos();
  const id = useId();
  const titleId = `${id}-title`;
  const limitations = useLive(() => repos.consent.limitations(), [repos]);
  const remove = useAction((limitationId: string) => repos.consent.removeLimitation(limitationId));
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const editReturn = useRef<string | null>(null);
  const addReturn = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Limitation en cours de modification disparue de la liste : plus de formulaire ouvert.
  useEffect(() => {
    if (editing !== null && limitations !== undefined && !limitations.some((l) => l.id === editing)) {
      setEditing(null);
    }
  }, [editing, limitations]);

  useEffect(() => {
    if (editing !== null || editReturn.current === null) return;
    cardRef.current
      ?.querySelector<HTMLButtonElement>(`[data-edit="${CSS.escape(editReturn.current)}"]`)
      ?.focus();
    editReturn.current = null;
  }, [editing]);

  useEffect(() => {
    if (adding || !addReturn.current) return;
    cardRef.current?.querySelector<HTMLButtonElement>(`button[aria-label="${ADD_LABEL}"]`)?.focus();
    addReturn.current = false;
  }, [adding]);

  function closeEditor() {
    editReturn.current = editing;
    setEditing(null);
  }

  function closeAdd() {
    addReturn.current = true;
    setAdding(false);
  }

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id={titleId} className={styles.sectionTitle}>
          Limitations
        </h2>
        <p className={styles.note}>{LIMITATIONS_NOTE}</p>
      </div>
      <div ref={cardRef}>
        <ListGroup>
          {limitations?.length === 0 ? (
            <li className={styles.limitation}>
              <span className={styles.muted}>Aucune</span>
            </li>
          ) : null}
          {limitations?.map((l) =>
            editing === l.id ? (
              <li key={l.id} className={styles.limitationForm}>
                <LimitationEditForm limitation={l} onDone={closeEditor} />
              </li>
            ) : (
              <li key={l.id} className={styles.limitation}>
                <span className={styles.limitationText}>
                  <span id={`${id}-${l.id}`} className={styles.strong}>
                    {limitationLabel(l)}
                  </span>
                  {l.note ? <span className={styles.limitationNote}>{l.note}</span> : null}
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Modifier"
                  aria-describedby={`${id}-${l.id}`}
                  data-edit={l.id}
                  disabled={editing !== null}
                  onClick={() => setEditing(l.id)}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Supprimer"
                  aria-describedby={`${id}-${l.id}`}
                  disabled={remove.pending}
                  onClick={() => void remove.run(l.id)}
                >
                  <TrashIcon />
                </button>
              </li>
            ),
          )}
          {adding ? (
            <li className={styles.limitationForm}>
              <LimitationAddForm onDone={closeAdd} />
            </li>
          ) : (
            <ListRow
              icon={<PlusIcon />}
              label={ADD_LABEL}
              name={ADD_LABEL}
              tone="accent"
              onClick={() => setAdding(true)}
            />
          )}
        </ListGroup>
      </div>
      {remove.error ? <Banner tone="error">{remove.error}</Banner> : null}
    </section>
  );
}

/**
 * Ajout d'une limitation (E7.3) : zone (qui prend le focus à l'ouverture), côté, gêne et note ; « Ajouter »
 * l'envoie (POST) puis referme ; « Annuler » referme sans rien envoyer. Le refus du serveur ou le réseau
 * s'affichent dans le formulaire, qui reste ouvert avec la saisie. Boutons empilés en pleine largeur.
 */
function LimitationAddForm(p: { onDone(): void }) {
  const draft = useLimitationDraft();
  const add = useAction(() => draft.persist().then(() => true));
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('select')?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (add.pending || !draft.complete) return;
    if (await add.run()) p.onDone();
  }

  return (
    <form
      ref={formRef}
      aria-label={ADD_LABEL}
      className={styles.limitationFields}
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <LimitationFields state={draft} />
      {add.error ? <Banner tone="error">{add.error}</Banner> : null}
      <div className={styles.formActions}>
        <Button type="submit" block disabled={!draft.complete || add.pending}>
          Ajouter
        </Button>
        <Button variant="secondary" block disabled={add.pending} onClick={p.onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

import {
  BODY_AREA_LABELS,
  BODY_AREAS,
  type BodyArea,
  LIMITATION_NOTE_MAX,
  LIMITATION_SEVERITIES,
  LIMITATION_SEVERITY_LABELS,
  LIMITATION_SIDE_LABELS,
  LIMITATION_SIDES,
  type LimitationPatch,
  type LimitationSeverity,
  type LimitationSide,
} from '@appsport/contracts';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { type LimitationView, useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Field, useAction } from '../../ui';
import styles from './onboarding.module.css';

/** Valeurs d'une limitation en cours de saisie et leurs setters (ajout ou modification). */
export interface LimitationFieldState {
  bodyArea: BodyArea | '';
  setBodyArea(v: BodyArea | ''): void;
  side: LimitationSide | '';
  setSide(v: LimitationSide | ''): void;
  severity: LimitationSeverity | null;
  setSeverity(v: LimitationSeverity): void;
  note: string;
  setNote(v: string): void;
}

/** « Genou · Gauche · Légère » : libellés des contrats. */
export function limitationLabel(l: Pick<LimitationView, 'bodyArea' | 'side' | 'severity'>): string {
  return `${BODY_AREA_LABELS[l.bodyArea]} · ${LIMITATION_SIDE_LABELS[l.side]} · ${LIMITATION_SEVERITY_LABELS[l.severity]}`;
}

/** Zone, côté, gêne et note de 200 caractères au plus (E7.3). */
export function LimitationFields(p: { state: LimitationFieldState }) {
  const id = useId();
  const s = p.state;
  return (
    <>
      <Field label="Zone">
        <select value={s.bodyArea} onChange={(e) => s.setBodyArea(e.target.value as BodyArea | '')}>
          <option value="">Choisir</option>
          {BODY_AREAS.map((a) => (
            <option key={a} value={a}>
              {BODY_AREA_LABELS[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Côté">
        <select value={s.side} onChange={(e) => s.setSide(e.target.value as LimitationSide | '')}>
          <option value="">Choisir</option>
          {LIMITATION_SIDES.map((side) => (
            <option key={side} value={side}>
              {LIMITATION_SIDE_LABELS[side]}
            </option>
          ))}
        </select>
      </Field>
      <ChoiceList<LimitationSeverity>
        name={`${id}-severity`}
        legend="Gêne"
        value={s.severity}
        onChange={s.setSeverity}
        options={LIMITATION_SEVERITIES.map((v) => ({ value: v, label: LIMITATION_SEVERITY_LABELS[v] }))}
      />
      <Field label="Note" hint={`${LIMITATION_NOTE_MAX} caractères au plus.`}>
        <input
          type="text"
          maxLength={LIMITATION_NOTE_MAX}
          value={s.note}
          onChange={(e) => s.setNote(e.target.value)}
        />
      </Field>
    </>
  );
}

/** Champs changés depuis l'ouverture ; note vide ou faite d'espaces → null. */
function changedFields(
  initial: LimitationView,
  v: { bodyArea: BodyArea; side: LimitationSide; severity: LimitationSeverity; note: string },
): LimitationPatch | null {
  const trimmed = v.note.trim();
  const note = trimmed === '' ? null : trimmed;
  const patch: LimitationPatch = {};
  if (v.bodyArea !== initial.bodyArea) patch.bodyArea = v.bodyArea;
  if (v.side !== initial.side) patch.side = v.side;
  if (v.severity !== initial.severity) patch.severity = v.severity;
  if (note !== initial.note) patch.note = note;
  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * Modification d'une limitation (P-DRT-2) : formulaire nommé « Modifier : <libellé> », valeurs de
 * l'ouverture ; « Enregistrer » envoie les seuls champs changés depuis l'ouverture (PATCH), même si
 * la limitation est relue entre-temps, et rien s'il n'y en a pas. L'erreur (accord retiré, réseau)
 * reste dans le formulaire, qui reste ouvert.
 */
export function LimitationEditForm(p: { limitation: LimitationView; onDone(): void }) {
  const repos = useRepos();
  const [l] = useState(p.limitation);
  const [bodyArea, setBodyArea] = useState<BodyArea | ''>(l.bodyArea);
  const [side, setSide] = useState<LimitationSide | ''>(l.side);
  const [severity, setSeverity] = useState<LimitationSeverity | null>(l.severity);
  const [note, setNote] = useState(l.note ?? '');
  const formRef = useRef<HTMLFormElement>(null);
  const save = useAction((patch: LimitationPatch) =>
    repos.consent.updateLimitation(l.id, patch).then(() => true),
  );
  const complete = bodyArea !== '' && side !== '' && severity !== null;

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('select')?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (save.pending || bodyArea === '' || side === '' || severity === null) return;
    const patch = changedFields(l, { bodyArea, side, severity, note });
    if (patch === null || (await save.run(patch))) p.onDone();
  }

  return (
    <form
      ref={formRef}
      aria-label={`Modifier : ${limitationLabel(l)}`}
      className={styles.panel}
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <LimitationFields
        state={{ bodyArea, setBodyArea, side, setSide, severity, setSeverity, note, setNote }}
      />
      {save.error ? <Banner tone="error">{save.error}</Banner> : null}
      <div className={styles.actions}>
        <Button variant="secondary" disabled={save.pending} onClick={p.onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" disabled={!complete || save.pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

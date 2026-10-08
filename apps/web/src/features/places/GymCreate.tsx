import {
  type EquipmentCode,
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  type GymSummary,
  PRESET_IDS,
  PRESETS,
  type PresetId,
} from '@appsport/contracts';
import { type ReactNode, useId, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, ERROR_MESSAGES, Field, plural, useAction } from '../../ui';
import { EquipmentChecklist, sortEquipment } from './EquipmentChecklist';
import styles from './places.module.css';

const GYM_PRESETS = PRESET_IDS.filter((id) => PRESETS[id].kind === 'gym');

/** « Basic Fit · Lyon · 2 membres visibles » (R-SAL-1). */
export const gymLabel = (g: GymSummary) =>
  `${g.name} · ${g.city} · ${g.visibleMemberCount} ${plural(g.visibleMemberCount, 'membre visible', 'membres visibles')}`;

const lengthError = (value: string, min: number, max: number) =>
  value.length < min || value.length > max ? `${min} à ${max} caractères.` : null;

type Stage = 'info' | 'similar' | 'equipment';

/**
 * Création d'une salle (R-SAL-2, R-SAL-3) : nom et ville, salles proches à écarter, préréglage,
 * puis validation de la liste pré-cochée. Une salle existante (proche ou doublon) se choisit à la
 * place par `onPickExisting`. `visibility` (réglage de « Qui va à cette salle ») est rendu après la
 * ville, avant tout bouton qui enregistre (R-VIS-3).
 */
export function GymCreate(p: {
  isPrimary: boolean;
  visibleAtGym: boolean;
  onDone(): void;
  onPickExisting(gymId: string): void;
  visibility?: ReactNode;
}) {
  const repos = useRepos();
  const uid = useId();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState<{ name: string | null; city: string | null }>({
    name: null,
    city: null,
  });
  const [stage, setStage] = useState<Stage>('info');
  const [similar, setSimilar] = useState<GymSummary[]>([]);
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [equipment, setEquipment] = useState<EquipmentCode[]>([]);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  // Modifications du nom ou de la ville : une réponse arrivée après l'une d'elles est périmée.
  const edits = useRef(0);

  const check = useAction(async (n: string, c: string) => {
    const at = edits.current;
    const found = await repos.gyms.similar(n, c);
    if (edits.current !== at) return;
    setSimilar(found);
    setStage(found.length > 0 ? 'similar' : 'equipment');
  });

  const create = useAction(async () => {
    setDuplicateOf(null);
    try {
      await repos.gyms.create({
        name: name.trim(),
        city: city.trim(),
        equipment,
        isPrimary: p.isPrimary,
        visibleAtGym: p.visibleAtGym,
      });
    } catch (error) {
      const gymId = error instanceof ApiError && error.code === 'gym_duplicate' ? error.body.gymId : null;
      if (typeof gymId !== 'string') throw error;
      setDuplicateOf(gymId);
      return;
    }
    p.onDone();
  });

  /** Nom ou ville modifiés : les salles proches sont à revoir. */
  const edit = (set: (v: string) => void) => (v: string) => {
    edits.current += 1;
    set(v);
    setStage('info');
    setDuplicateOf(null);
  };

  function submitInfo() {
    const n = name.trim();
    const c = city.trim();
    const next = {
      name: lengthError(n, GYM_NAME_MIN, GYM_NAME_MAX),
      city: lengthError(c, GYM_CITY_MIN, GYM_CITY_MAX),
    };
    setErrors(next);
    if (next.name || next.city) return;
    void check.run(n, c);
  }

  function choosePreset(id: PresetId) {
    setPreset(id);
    setEquipment(sortEquipment(PRESETS[id].equipment));
  }

  return (
    <div className={styles.create}>
      <Field label="Nom de la salle" hint="L'enseigne peut y figurer." error={errors.name}>
        <input
          type="text"
          maxLength={GYM_NAME_MAX}
          value={name}
          onChange={(e) => edit(setName)(e.target.value)}
        />
      </Field>
      <Field label="Ville" error={errors.city}>
        <input
          type="text"
          maxLength={GYM_CITY_MAX}
          value={city}
          onChange={(e) => edit(setCity)(e.target.value)}
        />
      </Field>
      {p.visibility}
      {check.error ? <Banner tone="error">{check.error}</Banner> : null}
      {stage === 'info' ? (
        <Button onClick={submitInfo} disabled={check.pending}>
          Continuer
        </Button>
      ) : null}

      {stage === 'similar' ? (
        <section className={styles.similar}>
          <p>Ces salles existent peut-être déjà :</p>
          <ul className={styles.similarList}>
            {similar.map((g) => (
              <li key={g.id} className={styles.similarItem}>
                <span id={`${uid}-similar-${g.id}`}>{gymLabel(g)}</span>
                <Button
                  variant="secondary"
                  aria-describedby={`${uid}-similar-${g.id}`}
                  onClick={() => p.onPickExisting(g.id)}
                >
                  C'est ma salle
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setStage('equipment')}>
            Non, créer ma salle
          </Button>
        </section>
      ) : null}

      {stage === 'equipment' ? (
        <>
          <ChoiceList<PresetId>
            name="gym-preset"
            legend="Type de salle"
            value={preset}
            onChange={choosePreset}
            options={GYM_PRESETS.map((id) => ({ value: id, label: PRESETS[id].label }))}
          />
          {preset !== null ? (
            <>
              <p className={styles.hint}>
                Vérifie la liste : décoche ce qui manque, coche ce qui est en plus.
              </p>
              <EquipmentChecklist kind="gym" value={equipment} onChange={setEquipment} />
            </>
          ) : null}
          {duplicateOf !== null ? (
            <Banner tone="error">
              <p className={styles.bannerText}>{ERROR_MESSAGES.gym_duplicate}</p>
              <Button variant="secondary" onClick={() => p.onPickExisting(duplicateOf)}>
                Choisir cette salle
              </Button>
            </Banner>
          ) : null}
          {create.error ? <Banner tone="error">{create.error}</Banner> : null}
          <Button onClick={() => void create.run()} disabled={preset === null || create.pending}>
            Créer la salle
          </Button>
        </>
      ) : null}
    </div>
  );
}

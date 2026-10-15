import type { GymSummary } from '@rune/contracts';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, errorMessage, Field, plural, useAction } from '../../ui';
import { CreateGymCard } from './CreateGymCard';
import { GymCreate, gymLabel } from './GymCreate';
import styles from './places.module.css';

export const VISIBILITY_LABEL = 'Apparaître dans « Qui va à cette salle »';
export const MINOR_VISIBILITY_HINT = 'Désactivé par défaut pour les moins de 18 ans.';

/**
 * Salles du serveur pour `query` ; la dernière recherche lancée l'emporte. Changer `reload` relance
 * la même recherche (« Réessayer » après un échec).
 */
function useGymSearch(query: string, reload: number): { gyms: GymSummary[] | null; error: string | null } {
  const repos = useRepos();
  const [state, setState] = useState<{ gyms: GymSummary[] | null; error: string | null }>({
    gyms: null,
    error: null,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` relance la recherche
  useEffect(() => {
    let current = true;
    repos.gyms.search(query.trim()).then(
      (gyms) => {
        if (current) setState({ gyms, error: null });
      },
      (error: unknown) => {
        if (current) setState((s) => ({ gyms: s.gyms, error: errorMessage(error) }));
      },
    );
    return () => {
      current = false;
    };
  }, [repos, query, reload]);
  return state;
}

/** Ce que la barre d'actions de l'écran reçoit du sélecteur (`actions` de GymPicker). */
export interface GymPickerActions {
  /** Valider la salle choisie (désactivé sans choix) ; null pendant la création, qui a ses propres boutons. */
  submit: { run(): void; disabled: boolean } | null;
  pending: boolean;
  error: string | null;
}

/**
 * « Ta salle » (R-SAL-1) : choisir une salle existante ou en créer une, et régler sa visibilité
 * dans « Qui va à cette salle » (R-VIS-3 ; désactivée par défaut pour un mineur, P-MIN-6). Le lieu
 * est créé ici, puis `onDone`.
 * `actions` (onboarding, maquette B04) : la barre de l'écran remplace « Valider » (son bouton principal
 * valide la salle choisie, son erreur est celle du choix), et « Créer une salle » devient une carte sous la
 * liste.
 */
export function GymPicker(p: {
  isPrimary: boolean;
  defaultVisible: boolean;
  onDone(): void;
  actions?(s: GymPickerActions): ReactNode;
}) {
  const repos = useRepos();
  const hintId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(p.defaultVisible);
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);
  const { gyms, error } = useGymSearch(query, reload);
  // Une salle choisie puis écartée par la recherche n'est plus validable.
  const chosen = gyms?.some((g) => g.id === selected) ? selected : null;

  const pick = useAction(async (gymId: string) => {
    await repos.places.create({ kind: 'gym', gymId, isPrimary: p.isPrimary, visibleAtGym: visible });
    p.onDone();
  });

  const visibility = (
    <div className={styles.visibility}>
      <label className={styles.item}>
        <input
          type="checkbox"
          checked={visible}
          aria-describedby={p.defaultVisible ? undefined : hintId}
          onChange={(e) => setVisible(e.target.checked)}
        />
        {VISIBILITY_LABEL}
      </label>
      {p.defaultVisible ? null : (
        <span id={hintId} className={styles.hint}>
          {MINOR_VISIBILITY_HINT}
        </span>
      )}
    </div>
  );

  if (creating) {
    return (
      <div className={styles.picker}>
        <GymCreate
          isPrimary={p.isPrimary}
          visibleAtGym={visible}
          visibility={visibility}
          onDone={p.onDone}
          onPickExisting={(gymId) => void pick.run(gymId)}
        />
        {pick.error ? <Banner tone="error">{pick.error}</Banner> : null}
        <Button variant="secondary" onClick={() => setCreating(false)}>
          Revenir à la liste
        </Button>
        {p.actions?.({ submit: null, pending: pick.pending, error: null })}
      </div>
    );
  }

  const submit = {
    run: () => {
      if (chosen !== null) void pick.run(chosen);
    },
    disabled: chosen === null || pick.pending,
  };

  return (
    <div className={styles.picker}>
      <Field label="Rechercher une salle">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      {error ? (
        <>
          <Banner tone="error">{error}</Banner>
          <Button variant="secondary" onClick={() => setReload((n) => n + 1)}>
            Réessayer
          </Button>
        </>
      ) : null}
      {gyms !== null ? (
        <p role="status" className={styles.hint}>
          {gyms.length === 0
            ? 'Aucune salle trouvée.'
            : `${gyms.length} ${plural(gyms.length, 'salle trouvée', 'salles trouvées')}.`}
        </p>
      ) : null}
      {gyms !== null && gyms.length > 0 ? (
        <ChoiceList<string>
          name="gym"
          legend="Salles"
          value={chosen}
          onChange={setSelected}
          options={gyms.map((g) => ({ value: g.id, label: gymLabel(g) }))}
        />
      ) : null}
      {p.actions ? (
        <CreateGymCard onClick={() => setCreating(true)} />
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)}>
          Ma salle n'est pas dans la liste
        </Button>
      )}
      {visibility}
      {p.actions ? (
        p.actions({ submit, pending: pick.pending, error: pick.error })
      ) : (
        <>
          {pick.error ? <Banner tone="error">{pick.error}</Banner> : null}
          <Button onClick={submit.run} disabled={submit.disabled}>
            Valider
          </Button>
        </>
      )}
    </div>
  );
}

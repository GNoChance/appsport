import type { GymSummary } from '@appsport/contracts';
import { useEffect, useId, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, errorMessage, Field, useAction } from '../../ui';
import { GymCreate, gymLabel } from './GymCreate';
import styles from './places.module.css';

export const VISIBILITY_LABEL = 'Apparaître dans « Qui va à cette salle »';
export const MINOR_VISIBILITY_HINT = 'Désactivé par défaut pour les moins de 18 ans.';

/** Salles du serveur pour `query` ; la dernière recherche lancée l'emporte. */
function useGymSearch(query: string): { gyms: GymSummary[] | null; error: string | null } {
  const repos = useRepos();
  const [state, setState] = useState<{ gyms: GymSummary[] | null; error: string | null }>({
    gyms: null,
    error: null,
  });
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
  }, [repos, query]);
  return state;
}

/**
 * « Ta salle » (R-SAL-1) : choisir une salle existante ou en créer une, et régler sa visibilité
 * dans « Qui va à cette salle » (R-VIS-3 ; désactivée par défaut pour un mineur, P-MIN-6). Le lieu
 * est créé ici, puis `onDone`.
 */
export function GymPicker(p: { isPrimary: boolean; defaultVisible: boolean; onDone(): void }) {
  const repos = useRepos();
  const hintId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(p.defaultVisible);
  const [creating, setCreating] = useState(false);
  const { gyms, error } = useGymSearch(query);
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
          onDone={p.onDone}
          onPickExisting={(gymId) => void pick.run(gymId)}
        />
        {visibility}
        {pick.error ? <Banner tone="error">{pick.error}</Banner> : null}
        <Button variant="secondary" onClick={() => setCreating(false)}>
          Revenir à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <Field label="Rechercher une salle">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {gyms !== null && gyms.length === 0 ? <p className={styles.hint}>Aucune salle trouvée.</p> : null}
      {gyms !== null && gyms.length > 0 ? (
        <ChoiceList<string>
          name="gym"
          legend="Salles"
          value={chosen}
          onChange={setSelected}
          options={gyms.map((g) => ({ value: g.id, label: gymLabel(g) }))}
        />
      ) : null}
      <Button variant="secondary" onClick={() => setCreating(true)}>
        Ma salle n'est pas dans la liste
      </Button>
      {visibility}
      {pick.error ? <Banner tone="error">{pick.error}</Banner> : null}
      <Button
        onClick={() => {
          if (chosen !== null) void pick.run(chosen);
        }}
        disabled={chosen === null || pick.pending}
      >
        Valider
      </Button>
    </div>
  );
}

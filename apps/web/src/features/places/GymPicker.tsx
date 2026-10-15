import type { GymSummary } from '@rune/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { useLive } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceCard, ChoiceGroup, errorMessage, Field, plural, useAction } from '../../ui';
import { GymCreate, gymLabel } from './GymCreate';
import { CloseIcon, GymIcon, PlusIcon, SearchIcon, WarningIcon } from './icons';
import styles from './places.module.css';
import { useSubScreenBusy } from './SubScreen';

export const VISIBILITY_LABEL = 'Apparaître dans « Qui va à cette salle »';
export const MINOR_VISIBILITY_HINT = 'Désactivé par défaut pour les moins de 18 ans.';
const OWNED_TEXT = 'Déjà dans tes lieux';

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

/**
 * « Ta salle » (R-SAL-1, maquette D04) : chercher une salle existante (une salle déjà parmi les lieux de
 * l'utilisateur est grisée, R-LIEU-2) ou en créer une, et régler sa visibilité dans « Qui va à cette salle »
 * (R-VIS-3 ; désactivée par défaut pour un mineur, P-MIN-6). La visibilité part avec « Valider » : c'est une
 * case à cocher, dessinée en interrupteur. Le lieu est créé ici, puis `onDone`.
 */
export function GymPicker(p: { isPrimary: boolean; defaultVisible: boolean; onDone(): void }) {
  const repos = useRepos();
  const hintId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(p.defaultVisible);
  const [creating, setCreating] = useState(false);
  const [reload, setReload] = useState(0);
  const { gyms, error } = useGymSearch(query, reload);
  const places = useLive(() => repos.places.list(), [repos]);
  const owned = new Set((places ?? []).flatMap((pl) => (pl.gymId ? [pl.gymId] : [])));
  // Une salle choisie puis écartée par la recherche (ou déjà parmi les lieux) n'est plus validable.
  const chosen =
    gyms?.some((g) => g.id === selected) && selected !== null && !owned.has(selected) ? selected : null;

  const pick = useAction(async (gymId: string) => {
    await repos.places.create({ kind: 'gym', gymId, isPrimary: p.isPrimary, visibleAtGym: visible });
    p.onDone();
  });
  useSubScreenBusy(pick.pending);

  const visibility = (
    <div className={styles.visibility}>
      <label className={styles.toggleCard}>
        <span>{VISIBILITY_LABEL}</span>
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={visible}
          aria-describedby={p.defaultVisible ? undefined : hintId}
          onChange={(e) => setVisible(e.target.checked)}
        />
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
        <Button variant="secondary" block onClick={() => setCreating(false)}>
          Revenir à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Field label="Rechercher une salle">
          <input
            ref={searchRef}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <span className={styles.searchIcon} aria-hidden="true">
          <SearchIcon />
        </span>
        {query !== '' ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            className={styles.searchClear}
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
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
        <ChoiceGroup legend="Salles">
          {gyms.map((g) => {
            const mine = owned.has(g.id);
            return (
              <ChoiceCard
                key={g.id}
                type="radio"
                name="gym"
                value={g.id}
                checked={chosen === g.id}
                disabled={mine}
                onChange={() => setSelected(g.id)}
                icon={<GymIcon />}
                title={gymLabel(g)}
                description={mine ? OWNED_TEXT : undefined}
              />
            );
          })}
        </ChoiceGroup>
      ) : null}
      {/* Recherche qui trouve une salle à choisir : la choisir plutôt que d'en créer une en double (R-SAL-3). */}
      {query.trim() !== '' && gyms?.some((g) => !owned.has(g.id)) ? (
        <div role="note" className={styles.warningNote}>
          <WarningIcon />
          <p>
            <strong>Ta salle existe peut-être déjà :</strong> choisis-la plutôt que d'en créer une en double.
          </p>
        </div>
      ) : null}
      <Button variant="secondary" block onClick={() => setCreating(true)}>
        <PlusIcon />
        Ma salle n'est pas dans la liste
      </Button>
      {visibility}
      {pick.error ? <Banner tone="error">{pick.error}</Banner> : null}
      <Button
        block
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

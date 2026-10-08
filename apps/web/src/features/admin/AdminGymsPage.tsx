import {
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  type GymSummary,
  type UpdateGymRequest,
} from '@appsport/contracts';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useRepos } from '../../repos';
import { Button, Field, Page, plural } from '../../ui';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';
import { ActionDialog, LoadFailure, useServerData } from './admin-ui';

export const GYM_IN_USE_MESSAGE =
  'Des membres ont encore cette salle parmi leurs lieux : elle ne peut pas être supprimée.';

const lengthError = (value: string, min: number, max: number) =>
  value.length < min || value.length > max ? `${min} à ${max} caractères.` : null;

/**
 * Admin › Salles (02 §6) : liste avec recherche, modification du nom et de la ville (R-SAL-4,
 * matériel sur la fiche de la salle), suppression d'une salle inutilisée (R-SAL-7). En ligne
 * seulement ; la liste est relue après chaque réussite.
 */
export function AdminGymsPage() {
  const repos = useRepos();
  const [query, setQuery] = useState('');
  const load = useCallback(() => repos.gyms.search(query.trim()), [repos, query]);
  const { data: gyms, error, reload } = useServerData(load);
  const [editing, setEditing] = useState<GymSummary | null>(null);
  const [deleting, setDeleting] = useState<GymSummary | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <Page title="Salles">
      <AdminNav />
      <Field label="Rechercher une salle">
        <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
      {gyms && gyms.length === 0 ? <p>Aucune salle trouvée.</p> : null}
      {gyms && gyms.length > 0 ? (
        <ul aria-label="Salles" className={styles.cards}>
          {gyms.map((g) => (
            <li key={g.id} className={styles.card}>
              <Link href={`/gyms/${g.id}`} className={styles.cardTitle}>
                {g.name}
              </Link>
              <span className={styles.meta}>
                {g.city} · {g.visibleMemberCount}{' '}
                {plural(g.visibleMemberCount, 'membre visible', 'membres visibles')}
              </span>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setEditing(g)}>
                  Modifier
                </Button>
                <Button variant="danger" onClick={() => setDeleting(g)}>
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {editing ? (
        <EditGymDialog
          gym={editing}
          reload={reload}
          onClose={() => setEditing(null)}
          fallbackFocus={searchRef}
        />
      ) : null}
      {deleting ? (
        <ActionDialog
          title={`Supprimer ${deleting.name}`}
          confirmLabel="Supprimer"
          danger
          overrides={{ gym_in_use: GYM_IN_USE_MESSAGE }}
          fallbackFocus={searchRef}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await repos.admin.deleteGym(deleting.id);
            await reload();
          }}
        >
          <p>
            Possible seulement si plus aucun membre ne l'a parmi ses lieux. Les séances passées y restent
            rattachées ; recréer une salle de même nom dans la même ville la réactive.
          </p>
        </ActionDialog>
      ) : null}
    </Page>
  );
}

/**
 * Nom et ville (R-SAL-2 : 2 à 60 caractères), contrôlés ici ; seuls les champs changés partent
 * (R-SAL-5 : la dernière écriture gagne, champ par champ). Rien de changé : le dialogue se ferme.
 */
function EditGymDialog(p: {
  gym: GymSummary;
  reload(): Promise<void>;
  onClose(): void;
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const repos = useRepos();
  const [name, setName] = useState(p.gym.name);
  const [city, setCity] = useState(p.gym.city);
  const [errors, setErrors] = useState<{ name: string | null; city: string | null }>({
    name: null,
    city: null,
  });

  function validate(): boolean {
    const next = {
      name: lengthError(name.trim(), GYM_NAME_MIN, GYM_NAME_MAX),
      city: lengthError(city.trim(), GYM_CITY_MIN, GYM_CITY_MAX),
    };
    setErrors(next);
    return !next.name && !next.city;
  }

  async function save() {
    const n = name.trim();
    const c = city.trim();
    const patch: UpdateGymRequest = {
      ...(n !== p.gym.name ? { name: n } : {}),
      ...(c !== p.gym.city ? { city: c } : {}),
    };
    if (Object.keys(patch).length === 0) return;
    await repos.gyms.update(p.gym.id, patch);
    await p.reload();
  }

  return (
    <ActionDialog
      title={`Modifier ${p.gym.name}`}
      confirmLabel="Enregistrer"
      fallbackFocus={p.fallbackFocus}
      validate={validate}
      onConfirm={save}
      onClose={p.onClose}
    >
      <Field label="Nom de la salle" error={errors.name}>
        <input type="text" maxLength={GYM_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Ville" error={errors.city}>
        <input type="text" maxLength={GYM_CITY_MAX} value={city} onChange={(e) => setCity(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}

import {
  GYM_CITY_MAX,
  GYM_CITY_MIN,
  GYM_NAME_MAX,
  GYM_NAME_MIN,
  type GymSummary,
  type UpdateGymRequest,
} from '@rune/contracts';
import { type RefObject, useCallback, useId, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useRepos } from '../../repos';
import { Button, EmptyState, Field, plural } from '../../ui';
import { GymIcon } from '../places/icons';
import { AdminPage } from './AdminPage';
import styles from './admin.module.css';
import { ActionDialog, LoadFailure, Loading, useServerData } from './admin-ui';

export const GYM_IN_USE_MESSAGE =
  'Des membres ont encore cette salle parmi leurs lieux : elle ne peut pas être supprimée.';

const lengthError = (value: string, min: number, max: number) =>
  value.length < min || value.length > max ? `${min} à ${max} caractères.` : null;

/**
 * Admin › Salles (02 §6) : liste en cartes avec recherche, modification du nom et de la ville (R-SAL-4,
 * matériel sur la fiche de la salle), suppression d'une salle inutilisée (R-SAL-7). En ligne
 * seulement ; la liste est relue après chaque réussite.
 */
export function AdminGymsPage() {
  const repos = useRepos();
  const [query, setQuery] = useState('');
  const load = useCallback(() => repos.gyms.search(query.trim()), [repos, query]);
  const { data: gyms, error, loading, reload } = useServerData(load);
  const [editing, setEditing] = useState<GymSummary | null>(null);
  const [deleting, setDeleting] = useState<GymSummary | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  return (
    <AdminPage>
      <section aria-labelledby={headingId} className={styles.section}>
        <h2 id={headingId}>Salles</h2>
        <Field label="Rechercher une salle">
          <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        {loading ? <Loading /> : null}
        {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
        {gyms && gyms.length === 0 ? (
          <EmptyState
            icon={<GymIcon />}
            title="Aucune salle trouvée."
            text={
              query.trim()
                ? 'Essaie un autre nom ou une autre ville.'
                : "Une salle apparaît ici dès qu'un membre la crée depuis ses lieux."
            }
          />
        ) : null}
        {gyms && gyms.length > 0 ? (
          <ul aria-labelledby={headingId} className={`stagger ${styles.cards}`}>
            {gyms.map((g) => (
              <GymCard key={g.id} gym={g} onEdit={() => setEditing(g)} onDelete={() => setDeleting(g)} />
            ))}
          </ul>
        ) : null}
      </section>
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
          reload={reload}
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
    </AdminPage>
  );
}

/**
 * Carte d'une salle : nom (vers sa fiche ; seul chemin vers elle, donc un lien de 44 px de haut, le nom coupé
 * d'une ellipse), ville et membres visibles ; ses actions sont décrites par son nom.
 */
function GymCard(p: { gym: GymSummary; onEdit(): void; onDelete(): void }) {
  const g = p.gym;
  const nameId = useId();
  return (
    <li className={`${styles.card} ${styles.gymCard}`}>
      <Link id={nameId} href={`/gyms/${g.id}`} className={styles.gymLink}>
        <span className={styles.cardTitle}>{g.name}</span>
      </Link>
      <span className={styles.meta}>
        {g.city} · {g.visibleMemberCount} {plural(g.visibleMemberCount, 'membre visible', 'membres visibles')}
      </span>
      <div className={styles.gymActions}>
        <Button variant="secondary" className={styles.compact} aria-describedby={nameId} onClick={p.onEdit}>
          Modifier
        </Button>
        <Button variant="danger" className={styles.compact} aria-describedby={nameId} onClick={p.onDelete}>
          Supprimer
        </Button>
      </div>
    </li>
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
      reload={p.reload}
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

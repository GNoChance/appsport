import type { GymSummary, OpsStatus } from '@appsport/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminGymsPage } from '../../src/features/admin/AdminGymsPage';
import { BACKUP_LATE_MS, DISK_WARN_PCT, ServerHealthPage } from '../../src/features/admin/ServerHealthPage';
import { fill } from '../support/auth';
import { createFakeApi, type FakeApi } from '../support/fake-api';
import { DEFAULT_NOW, makeMe, renderWithServices } from '../support/render';
import { until } from '../support/wait';

const ADMIN = makeMe({ id: 'u-1', username: 'bastien', role: 'admin' });

const GYMS: GymSummary[] = [
  { id: 'g-1', name: 'Basic Fit', city: 'Lyon', visibleMemberCount: 2 },
  { id: 'g-2', name: 'Fitness Park', city: 'Villeurbanne', visibleMemberCount: 0 },
];

const sent = (api: FakeApi, method: string, path: string) =>
  api.calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);
const searches = (api: FakeApi) =>
  api.calls.filter((c) => c.method === 'GET' && c.path === '/api/gyms').map((c) => c.query.get('q'));

async function renderGyms(api: FakeApi = createFakeApi()) {
  api.on('GET', '/api/gyms', { status: 200, body: GYMS });
  const rendered = await renderWithServices(<AdminGymsPage />, { api, me: ADMIN });
  await screen.findByRole('list', { name: 'Salles' });
  return rendered;
}

const gym = (name: string) => {
  const li = within(screen.getByRole('list', { name: 'Salles' }))
    .getAllByRole('listitem')
    .find((el) => el.textContent?.includes(name));
  if (!li) throw new Error(`salle ${name} absente`);
  return within(li);
};
const dialog = () => within(screen.getByRole('dialog'));

describe('AdminGymsPage (02 §6, R-SAL-4, R-SAL-7)', () => {
  it('liste GET /api/gyms?q= : nom (lien vers la fiche), ville, membres visibles ; recherche', async () => {
    const api = createFakeApi();
    await renderGyms(api);
    expect(screen.getByRole('heading', { level: 1, name: 'Salles' })).toBeTruthy();
    expect(searches(api)).toEqual(['']);
    expect(gym('Basic Fit').getByRole('link', { name: 'Basic Fit' }).getAttribute('href')).toBe('/gyms/g-1');
    expect(gym('Basic Fit').getByText('Lyon · 2 membres visibles')).toBeTruthy();
    expect(gym('Fitness Park').getByText('Villeurbanne · 0 membre visible')).toBeTruthy();
    fill('Rechercher une salle', 'basic');
    await until(() => searches(api).includes('basic'));
  });

  it('lecture en cours : « Chargement… », puis la liste', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('GET', '/api/gyms', async () => {
      await reply.promise;
      return { status: 200, body: GYMS };
    });
    await renderWithServices(<AdminGymsPage />, { api, me: ADMIN });
    expect((await screen.findByText('Chargement…')).getAttribute('role')).toBe('status');
    reply.resolve();
    expect(await screen.findByRole('list', { name: 'Salles' })).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('« Modifier » → PATCH /api/gyms/g-1 { city } (champs changés seulement) puis liste relue', async () => {
    const api = createFakeApi().on('PATCH', '/api/gyms/:id', { status: 204 });
    await renderGyms(api);
    fireEvent.click(gym('Basic Fit').getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('dialog', { name: 'Modifier Basic Fit' })).toBeTruthy();
    expect((dialog().getByLabelText('Nom de la salle') as HTMLInputElement).value).toBe('Basic Fit');
    fill('Ville', 'Villeurbanne');
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer' }));
    await until(() => screen.queryByRole('dialog') === null);
    expect(searches(api)).toHaveLength(2);
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([{ city: 'Villeurbanne' }]);
  });

  it('nom trop court : message lié au champ, aucun envoi', async () => {
    const api = createFakeApi();
    await renderGyms(api);
    fireEvent.click(gym('Basic Fit').getByRole('button', { name: 'Modifier' }));
    fill('Nom de la salle', 'B');
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer' }));
    expect(dialog().getByText('2 à 60 caractères.')).toBeTruthy();
    expect(sent(api, 'PATCH', '/api/gyms/g-1')).toEqual([]);
  });

  it('« Supprimer » (confirmé) → DELETE /api/admin/gyms/g-1 {} puis liste relue', async () => {
    const api = createFakeApi().on('DELETE', '/api/admin/gyms/:id', { status: 204 });
    await renderGyms(api);
    fireEvent.click(gym('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Supprimer Basic Fit' })).getByRole('button', {
        name: 'Supprimer',
      }),
    );
    await until(() => screen.queryByRole('dialog') === null);
    expect(searches(api)).toHaveLength(2);
    expect(sent(api, 'DELETE', '/api/admin/gyms/g-1')).toEqual([{}]);
  });

  it('salle déjà supprimée (404 not_found) : message gardé, liste relue', async () => {
    const api = createFakeApi().on('DELETE', '/api/admin/gyms/:id', {
      status: 404,
      body: { error: 'not_found' },
    });
    await renderGyms(api);
    fireEvent.click(gym('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Supprimer' }));
    expect(await dialog().findByText('Élément introuvable.')).toBeTruthy();
    await until(() => searches(api).length === 2);
  });

  it('409 gym_in_use → message, dialogue gardé', async () => {
    const api = createFakeApi().on('DELETE', '/api/admin/gyms/:id', {
      status: 409,
      body: { error: 'gym_in_use' },
    });
    await renderGyms(api);
    fireEvent.click(gym('Basic Fit').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Supprimer' }));
    expect(
      await dialog().findByText(
        'Des membres ont encore cette salle parmi leurs lieux : elle ne peut pas être supprimée.',
      ),
    ).toBeTruthy();
    expect(searches(api)).toHaveLength(1);
  });
});

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(DEFAULT_NOW - ms).toISOString();

/** État d'exploitation de 08 §9 : déploiement, sauvegarde, test de restauration, hôte. */
const OPS: OpsStatus = {
  deploy: { at: '2026-10-01T09:00:00.000Z', version: 'v1.2.3', previousVersion: 'v1.2.2', ok: true },
  backup: { at: ago(5 * HOUR), ok: true },
  restoreTest: { at: '2026-10-04T05:00:00.000Z', ok: true },
  host: {
    at: ago(8 * HOUR),
    ok: false,
    disks: [
      { mount: '/', usedPct: 42 },
      { mount: '/srv/appsport', usedPct: 81 },
      { mount: '/srv/backup', usedPct: 80 },
    ],
    smartOk: true,
    rebootRequired: true,
  },
};

async function renderHealth(opsStatus: OpsStatus | null, api: FakeApi = createFakeApi()) {
  api.on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'v1.2.3', opsStatus } });
  const rendered = await renderWithServices(<ServerHealthPage />, { api, me: ADMIN });
  await screen.findByText('Version en service : v1.2.3');
  return rendered;
}

describe('ServerHealthPage (08 §9)', () => {
  it('seuils : 26 h de sauvegarde, disque au-delà de 80 %', () => {
    expect(BACKUP_LATE_MS).toBe(26 * HOUR);
    expect(DISK_WARN_PCT).toBe(80);
  });

  it('version, déploiement, sauvegarde, test de restauration, disques, SMART, redémarrage', async () => {
    await renderHealth(OPS);
    expect(screen.getByRole('heading', { level: 1, name: 'État du serveur' })).toBeTruthy();
    expect(screen.getByText('Dernier déploiement : v1.2.3 le 01/10/2026 (réussi)')).toBeTruthy();
    expect(screen.getByText('Dernière sauvegarde : il y a 5 h (réussie)')).toBeTruthy();
    expect(screen.getByText('Dernier test de restauration : 04/10/2026 (réussi)')).toBeTruthy();
    expect(screen.getByText("Dernier contrôle de l'hôte : il y a 8 h")).toBeTruthy();
    const disks = within(screen.getByRole('list', { name: 'Espace disque' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(disks).toEqual(['/ : 42 %', '/srv/appsport : 81 % (au-delà de 80 %)', '/srv/backup : 80 %']);
    expect(screen.getByText('SMART : OK')).toBeTruthy();
    expect(screen.getByText('Redémarrage nécessaire')).toBeTruthy();
    expect(screen.queryByText('Sauvegarde en retard (plus de 26 h)')).toBeNull();
    expect(screen.queryByText('Aucune sauvegarde enregistrée')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pourcentages arrondis au-dessus : 80,2 % est au-delà de 80 %, 79,6 % ne l’est pas', async () => {
    await renderHealth({
      ...OPS,
      host: {
        ...(OPS.host as NonNullable<OpsStatus['host']>),
        disks: [
          { mount: '/', usedPct: 80.2 },
          { mount: '/srv/appsport', usedPct: 79.6 },
        ],
      },
    });
    const disks = within(screen.getByRole('list', { name: 'Espace disque' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(disks).toEqual(['/ : 81 % (au-delà de 80 %)', '/srv/appsport : 80 %']);
  });

  it('sauvegarde de plus de 26 h → bandeau « Sauvegarde en retard (plus de 26 h) »', async () => {
    await renderHealth({ ...OPS, backup: { at: ago(28 * HOUR), ok: true } });
    const late = screen.getByText('Sauvegarde en retard (plus de 26 h)');
    expect(late.closest('[role="status"], [role="alert"]')).not.toBeNull();
    // En heures sous 72 h : « il y a 1 j » sous « plus de 26 h » minimiserait le retard.
    expect(screen.getByText('Dernière sauvegarde : il y a 28 h (réussie)')).toBeTruthy();
  });

  it('sauvegarde de 3 jours et plus : âge en jours', async () => {
    await renderHealth({ ...OPS, backup: { at: ago(80 * HOUR), ok: true } });
    expect(screen.getByText('Dernière sauvegarde : il y a 3 j (réussie)')).toBeTruthy();
    expect(screen.getByText('Sauvegarde en retard (plus de 26 h)')).toBeTruthy();
  });

  it('sauvegarde de 26 h tout juste : pas encore en retard', async () => {
    await renderHealth({ ...OPS, backup: { at: ago(26 * HOUR), ok: true } });
    expect(screen.queryByText('Sauvegarde en retard (plus de 26 h)')).toBeNull();
  });

  it('sauvegarde échouée → « (échouée) » et bandeau d’erreur', async () => {
    await renderHealth({
      ...OPS,
      backup: { at: ago(5 * HOUR), ok: false, detail: 'restic: dépôt verrouillé' },
    });
    expect(screen.getByText('Dernière sauvegarde : il y a 5 h (échouée)')).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('La dernière sauvegarde a échoué.');
    expect(alert.textContent).toContain('restic: dépôt verrouillé');
  });

  it('échecs : déploiement, test de restauration, SMART ; redémarrage inutile', async () => {
    await renderHealth({
      ...OPS,
      deploy: { at: '2026-10-01T09:00:00.000Z', version: 'v1.2.4', previousVersion: 'v1.2.3', ok: false },
      restoreTest: { at: '2026-10-04T05:00:00.000Z', ok: false },
      host: { ...(OPS.host as NonNullable<OpsStatus['host']>), smartOk: false, rebootRequired: false },
    });
    expect(screen.getByText('Dernier déploiement : v1.2.4 le 01/10/2026 (échoué)')).toBeTruthy();
    expect(screen.getByText('Dernier test de restauration : 04/10/2026 (échoué)')).toBeTruthy();
    expect(screen.getByText('SMART : problème détecté')).toBeTruthy();
    expect(screen.queryByText('Redémarrage nécessaire')).toBeNull();
  });

  it('aucune sauvegarde enregistrée : bandeau d’avertissement (08 §9 : sauvegarde absente)', async () => {
    await renderHealth({ deploy: OPS.deploy, host: OPS.host });
    const missing = screen.getByText('Aucune sauvegarde enregistrée');
    expect(missing.closest('[role="status"], [role="alert"]')).not.toBeNull();
    expect(screen.getByText('Dernière sauvegarde : aucune')).toBeTruthy();
  });

  it('contrôles absents : « aucune », « aucun »', async () => {
    await renderHealth({});
    expect(screen.getByText('Dernier déploiement : aucun')).toBeTruthy();
    expect(screen.getByText('Dernière sauvegarde : aucune')).toBeTruthy();
    expect(screen.getByText('Dernier test de restauration : aucun')).toBeTruthy();
    expect(screen.getByText("Dernier contrôle de l'hôte : aucun")).toBeTruthy();
  });

  it('lecture en cours : « Chargement… », puis l’état', async () => {
    const reply = Promise.withResolvers<void>();
    const api = createFakeApi().on('GET', '/api/admin/ops-status', async () => {
      await reply.promise;
      return { status: 200, body: { version: 'v1.2.3', opsStatus: OPS } };
    });
    await renderWithServices(<ServerHealthPage />, { api, me: ADMIN });
    expect((await screen.findByText('Chargement…')).getAttribute('role')).toBe('status');
    reply.resolve();
    expect(await screen.findByText('Version en service : v1.2.3')).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('opsStatus null → aucun état d’exploitation disponible', async () => {
    await renderHealth(null);
    expect(
      screen.getByText(
        "Aucun état d'exploitation disponible : les scripts de l'hôte n'ont encore rien écrit.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Dernière sauvegarde/)).toBeNull();
  });

  it('hors ligne : « Nécessite le réseau » puis « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<ServerHealthPage />, { api, me: ADMIN });
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
    api.setOffline(false);
    api.on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'v1.2.3', opsStatus: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Version en service : v1.2.3')).toBeTruthy();
  });
});

import type { GymSummary, OpsStatus } from '@rune/contracts';
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
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Salles' })).toBeTruthy();
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

type Host = NonNullable<OpsStatus['host']>;

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
      { mount: '/srv/rune', usedPct: 81 },
      { mount: '/srv/backup', usedPct: 80 },
    ],
    smartOk: true,
    rebootRequired: true,
  },
};

/** Tout va bien : aucune alerte. */
const HEALTHY: OpsStatus = {
  ...OPS,
  host: { ...(OPS.host as Host), ok: true, disks: [{ mount: '/', usedPct: 42 }], rebootRequired: false },
};

async function renderHealth(opsStatus: OpsStatus | null, api: FakeApi = createFakeApi()) {
  api.on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'v1.2.3', opsStatus } });
  const rendered = await renderWithServices(<ServerHealthPage />, { api, me: ADMIN });
  await screen.findByRole('region', { name: 'Résumé' });
  return rendered;
}

const summary = () => within(screen.getByRole('region', { name: 'Résumé' }));
/** Ligne d'un contrôle de la section Exploitation (libellé, détail, badge), trouvée par son libellé. */
const checkRow = (label: string) => {
  const li = within(screen.getByRole('list', { name: 'Exploitation' }))
    .getAllByRole('listitem')
    .find((el) => el.textContent?.startsWith(label));
  if (!li) throw new Error(`contrôle ${label} absent`);
  return within(li);
};
const disks = () =>
  within(screen.getByRole('list', { name: 'Espace disque' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);
const hostFacts = () => {
  const host = within(screen.getByRole('region', { name: 'Hôte' }));
  const terms = host.getAllByRole('term').map((t) => t.textContent);
  const values = host.getAllByRole('definition').map((d) => d.textContent);
  return Object.fromEntries(terms.map((t, i) => [t, values[i]]));
};

describe('ServerHealthPage (08 §9, maquette E05)', () => {
  it('seuils : 26 h de sauvegarde, disque au-delà de 80 %', () => {
    expect(BACKUP_LATE_MS).toBe(26 * HOUR);
    expect(DISK_WARN_PCT).toBe(80);
  });

  it('résumé : version, nombre d’alertes, « Dernier contrôle de l’hôte » ; un badge par contrôle', async () => {
    await renderHealth(OPS);
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeTruthy();
    expect(summary().getByText('Version en service')).toBeTruthy();
    expect(summary().getByText('v1.2.3')).toBeTruthy();
    // Disque /srv/rune à 81 % et redémarrage nécessaire.
    expect(summary().getByText('2 alertes')).toBeTruthy();
    expect(summary().getByText("Dernier contrôle de l'hôte : il y a 8 h")).toBeTruthy();
    expect(checkRow('Dernier déploiement').getByText('v1.2.3 le 01/10/2026')).toBeTruthy();
    expect(checkRow('Dernier déploiement').getByText('Réussi')).toBeTruthy();
    expect(checkRow('Dernière sauvegarde').getByText('il y a 5 h')).toBeTruthy();
    expect(checkRow('Dernière sauvegarde').getByText('Réussie')).toBeTruthy();
    expect(checkRow('Test de restauration').getByText('04/10/2026')).toBeTruthy();
    expect(checkRow('Test de restauration').getByText('Réussi')).toBeTruthy();
    expect(disks()).toEqual(['/ : 42 %', '/srv/rune : 81 %Au-delà de 80 %', '/srv/backup : 80 %']);
    expect(hostFacts()).toEqual({ SMART: 'OK', Redémarrage: 'Nécessaire' });
    expect(screen.queryByText('Sauvegarde en retard (plus de 26 h)')).toBeNull();
    expect(screen.queryByText('Aucune sauvegarde enregistrée')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tout va bien : « Aucune alerte », redémarrage « Non nécessaire »', async () => {
    await renderHealth(HEALTHY);
    expect(summary().getByText('Aucune alerte')).toBeTruthy();
    expect(hostFacts()).toEqual({ SMART: 'OK', Redémarrage: 'Non nécessaire' });
  });

  it('pourcentages arrondis au-dessus : 80,2 % est au-delà de 80 %, 79,6 % ne l’est pas', async () => {
    await renderHealth({
      ...OPS,
      host: {
        ...(OPS.host as Host),
        disks: [
          { mount: '/', usedPct: 80.2 },
          { mount: '/srv/rune', usedPct: 79.6 },
        ],
      },
    });
    expect(disks()).toEqual(['/ : 81 %Au-delà de 80 %', '/srv/rune : 80 %']);
  });

  it('deux disques au-delà de 80 % : une alerte par disque', async () => {
    await renderHealth({
      ...HEALTHY,
      host: {
        ...(HEALTHY.host as Host),
        ok: false,
        detail: 'disque / à 85 %; disque /srv/rune à 90 %',
        disks: [
          { mount: '/', usedPct: 85 },
          { mount: '/srv/rune', usedPct: 90 },
        ],
      },
    });
    expect(disks()).toEqual(['/ : 85 %Au-delà de 80 %', '/srv/rune : 90 %Au-delà de 80 %']);
    expect(summary().getByText('2 alertes')).toBeTruthy();
  });

  it('sauvegarde de plus de 26 h → bandeau « Sauvegarde en retard (plus de 26 h) », comptée en alerte', async () => {
    await renderHealth({ ...OPS, backup: { at: ago(28 * HOUR), ok: true } });
    const late = screen.getByText('Sauvegarde en retard (plus de 26 h)');
    expect(late.closest('[role="status"], [role="alert"]')).not.toBeNull();
    // En heures sous 72 h : « il y a 1 j » sous « plus de 26 h » minimiserait le retard.
    expect(checkRow('Dernière sauvegarde').getByText('il y a 28 h')).toBeTruthy();
    expect(summary().getByText('3 alertes')).toBeTruthy();
  });

  it('sauvegarde de 3 jours et plus : âge en jours', async () => {
    await renderHealth({ ...OPS, backup: { at: ago(80 * HOUR), ok: true } });
    expect(checkRow('Dernière sauvegarde').getByText('il y a 3 j')).toBeTruthy();
    expect(screen.getByText('Sauvegarde en retard (plus de 26 h)')).toBeTruthy();
  });

  it('sauvegarde de 26 h tout juste : pas encore en retard', async () => {
    await renderHealth({ ...HEALTHY, backup: { at: ago(26 * HOUR), ok: true } });
    expect(screen.queryByText('Sauvegarde en retard (plus de 26 h)')).toBeNull();
    expect(summary().getByText('Aucune alerte')).toBeTruthy();
  });

  it('sauvegarde échouée → badge « Échouée » et bandeau d’erreur avec le détail', async () => {
    await renderHealth({
      ...HEALTHY,
      backup: { at: ago(5 * HOUR), ok: false, detail: 'restic: dépôt verrouillé' },
    });
    expect(checkRow('Dernière sauvegarde').getByText('Échouée')).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('La dernière sauvegarde a échoué.');
    expect(alert.textContent).toContain('restic: dépôt verrouillé');
    expect(summary().getByText('1 alerte')).toBeTruthy();
  });

  it('sauvegarde échouée et en retard : les deux bandeaux, une seule alerte pour la sauvegarde', async () => {
    await renderHealth({ ...HEALTHY, backup: { at: ago(28 * HOUR), ok: false } });
    expect(screen.getByRole('alert').textContent).toContain('La dernière sauvegarde a échoué.');
    expect(screen.getByText('Sauvegarde en retard (plus de 26 h)')).toBeTruthy();
    expect(checkRow('Dernière sauvegarde').getByText('Échouée')).toBeTruthy();
    expect(summary().getByText('1 alerte')).toBeTruthy();
  });

  it('déploiement raté écrit par les scripts (même version, ok false) : « Échoué » avec la version, compté en alerte', async () => {
    await renderHealth({
      ...HEALTHY,
      deploy: { at: '2026-10-05T19:00:00.000Z', version: 'v1.2.3', previousVersion: 'v1.2.3', ok: false },
    });
    expect(checkRow('Dernier déploiement').getByText('v1.2.3 le 05/10/2026')).toBeTruthy();
    expect(checkRow('Dernier déploiement').getByText('Échoué')).toBeTruthy();
    expect(checkRow('Dernier déploiement').queryByText('Réussi')).toBeNull();
    expect(summary().getByText('1 alerte')).toBeTruthy();
  });

  it('échecs : déploiement, test de restauration, SMART ; redémarrage inutile', async () => {
    await renderHealth({
      ...OPS,
      deploy: { at: '2026-10-01T09:00:00.000Z', version: 'v1.2.4', previousVersion: 'v1.2.3', ok: false },
      restoreTest: { at: '2026-10-04T05:00:00.000Z', ok: false },
      host: { ...(OPS.host as Host), smartOk: false, rebootRequired: false },
    });
    expect(checkRow('Dernier déploiement').getByText('v1.2.4 le 01/10/2026')).toBeTruthy();
    expect(checkRow('Dernier déploiement').getByText('Échoué')).toBeTruthy();
    expect(checkRow('Test de restauration').getByText('Échoué')).toBeTruthy();
    expect(hostFacts()).toEqual({ SMART: 'Problème détecté', Redémarrage: 'Non nécessaire' });
    // Déploiement, restauration, SMART et le disque à 81 %.
    expect(summary().getByText('4 alertes')).toBeTruthy();
  });

  it.each([
    ["df absent de l'hôte", []],
    ['disque /srv/backup illisible', [{ mount: '/', usedPct: 42 }]],
  ])(
    'contrôle de l’hôte échoué sans autre signe (%s) : compté en alerte, détail affiché comme Healthchecks',
    async (detail, hostDisks) => {
      await renderHealth({
        ...HEALTHY,
        host: { ...(HEALTHY.host as Host), ok: false, detail, disks: hostDisks },
      });
      expect(summary().getByText('1 alerte')).toBeTruthy();
      expect(summary().queryByText('Aucune alerte')).toBeNull();
      const host = within(screen.getByRole('region', { name: 'Hôte' }));
      expect(host.getByText(`Contrôle échoué : ${detail}`)).toBeTruthy();
      expect(hostFacts()).toEqual({ SMART: 'OK', Redémarrage: 'Non nécessaire' });
    },
  );

  it('contrôle de l’hôte échoué par un disque plein et un redémarrage : deux alertes, pas une de plus pour l’échec', async () => {
    await renderHealth({
      ...HEALTHY,
      host: {
        ...(HEALTHY.host as Host),
        ok: false,
        detail: 'disque / à 85 %; redémarrage requis',
        disks: [{ mount: '/', usedPct: 85 }],
        rebootRequired: true,
      },
    });
    expect(summary().getByText('2 alertes')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Hôte' })).getByText(
        'Contrôle échoué : disque / à 85 %; redémarrage requis',
      ),
    ).toBeTruthy();
  });

  it('contrôle de l’hôte échoué sans détail : « Contrôle échoué » seul', async () => {
    await renderHealth({ ...HEALTHY, host: { ...(HEALTHY.host as Host), ok: false } });
    expect(summary().getByText('1 alerte')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Hôte' })).getByText('Contrôle échoué')).toBeTruthy();
  });

  it('contrôle de l’hôte réussi : aucune ligne d’échec', async () => {
    await renderHealth(HEALTHY);
    expect(screen.queryByText(/Contrôle échoué/)).toBeNull();
  });

  it('aucune sauvegarde enregistrée : bandeau d’avertissement et badge « Absente » (08 §9 : sauvegarde absente)', async () => {
    await renderHealth({ deploy: OPS.deploy, host: HEALTHY.host });
    const missing = screen.getByText('Aucune sauvegarde enregistrée');
    expect(missing.closest('[role="status"], [role="alert"]')).not.toBeNull();
    expect(checkRow('Dernière sauvegarde').getByText('Aucune')).toBeTruthy();
    expect(checkRow('Dernière sauvegarde').getByText('Absente')).toBeTruthy();
    expect(summary().getByText('1 alerte')).toBeTruthy();
  });

  it('contrôles absents : « Aucun », « Aucune », pas de section Hôte', async () => {
    await renderHealth({});
    expect(checkRow('Dernier déploiement').getByText('Aucun')).toBeTruthy();
    expect(checkRow('Dernière sauvegarde').getByText('Aucune')).toBeTruthy();
    expect(checkRow('Test de restauration').getByText('Aucun')).toBeTruthy();
    expect(summary().getByText("Dernier contrôle de l'hôte : aucun")).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Hôte' })).toBeNull();
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
    expect(await screen.findByRole('region', { name: 'Résumé' })).toBeTruthy();
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('opsStatus null → version seule et « aucun état d’exploitation disponible »', async () => {
    await renderHealth(null);
    expect(summary().getByText('v1.2.3')).toBeTruthy();
    expect(
      screen.getByText(
        "Aucun état d'exploitation disponible : les scripts de l'hôte n'ont encore rien écrit.",
      ),
    ).toBeTruthy();
    expect(summary().queryByText(/alerte/)).toBeNull();
    expect(screen.queryByText(/Dernier contrôle/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Exploitation' })).toBeNull();
  });

  it('hors ligne : « Nécessite le réseau » puis « Réessayer »', async () => {
    const api = createFakeApi();
    api.setOffline('reject');
    await renderWithServices(<ServerHealthPage />, { api, me: ADMIN });
    expect(await screen.findByText('Nécessite le réseau')).toBeTruthy();
    api.setOffline(false);
    api.on('GET', '/api/admin/ops-status', { status: 200, body: { version: 'v1.2.3', opsStatus: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('region', { name: 'Résumé' })).toBeTruthy();
  });
});

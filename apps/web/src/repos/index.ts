import { useMemo } from 'react';
import { type AppServices, useServices } from '../app-services';
import { type AdminRepo, createAdminRepo } from './admin-repo';
import { type ConsentRepo, createConsentRepo } from './consent-repo';
import { createGymsRepo, type GymsRepo } from './gyms-repo';
import { createMeRepo, type MeRepo } from './me-repo';
import { createPlacesRepo, type PlacesRepo } from './places-repo';
import { createProfileRepo, type ProfileRepo } from './profile-repo';
import { createRejectionsRepo, type RejectionsRepo } from './rejections-repo';
import { createStatusRepo, type StatusRepo } from './status-repo';

export type { AdminRepo } from './admin-repo';
export type { ConsentRepo, LimitationView } from './consent-repo';
export type { GymsRepo } from './gyms-repo';
export type { DeviceOwner, MeRepo } from './me-repo';
export type { PlacesRepo, PlaceView } from './places-repo';
export type { ProfileRepo, TrainingProfileView } from './profile-repo';
export type { RejectionsRepo, RejectionView } from './rejections-repo';
export { isLive, parseJsonColumn } from './rows';
export type { StatusRepo } from './status-repo';

/** Seul accès des écrans aux données : Dexie (miroirs, meta, outbox) et API en ligne (01 §2 et §3). */
export interface Repos {
  me: MeRepo;
  profile: ProfileRepo;
  places: PlacesRepo;
  gyms: GymsRepo;
  consent: ConsentRepo;
  admin: AdminRepo;
  rejections: RejectionsRepo;
  status: StatusRepo;
}

export function createRepos(s: AppServices): Repos {
  return {
    me: createMeRepo(s),
    profile: createProfileRepo(s),
    places: createPlacesRepo(s),
    gyms: createGymsRepo(s),
    consent: createConsentRepo(s),
    admin: createAdminRepo(s),
    rejections: createRejectionsRepo(s),
    status: createStatusRepo(s),
  };
}

const cache = new WeakMap<AppServices, Repos>();

/** Dépôts de `services`, un seul jeu par services : ceux des écrans et ceux de main.tsx sont les mêmes. */
export function reposFor(services: AppServices): Repos {
  let repos = cache.get(services);
  if (!repos) {
    repos = createRepos(services);
    cache.set(services, repos);
  }
  return repos;
}

/** Dépôts des services courants (référence stable). */
export function useRepos(): Repos {
  const services = useServices();
  return useMemo(() => reposFor(services), [services]);
}

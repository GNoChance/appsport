import type { SwStatus } from '../../sw/protocol';

/** Dernier pull réussi : récent s'il date de moins de 24 h. */
export const RECENT_PULL_MS = 86_400_000;

export interface Readiness {
  ready: boolean;
  checks: { shell: boolean; catalog: boolean; illustrations: boolean; recentPull: boolean };
}

export type ReadinessCheck = keyof Readiness['checks'];

/** Libellé de chaque vérification en échec, dans l'ordre d'affichage. */
export const READINESS_FAILURES: Record<ReadinessCheck, string> = {
  shell: "Appli pas encore enregistrée sur l'appareil",
  catalog: 'Catalogue à télécharger',
  illustrations: 'Illustrations à télécharger',
  recentPull: 'Pas de synchronisation depuis plus de 24 h',
};

export const NOT_READY: Readiness = {
  ready: false,
  checks: { shell: false, catalog: false, illustrations: false, recentPull: false },
};

/**
 * « Prêt hors ligne » si et seulement si : coquille du build courant en précache, catalogue local
 * à la dernière version connue du serveur, illustrations en cache, pull réussi il y a moins de 24 h.
 */
export function computeReadiness(i: {
  sw: SwStatus | null;
  catalogVersion: string | null;
  serverCatalogVersion: string | null;
  lastPullOkAt: string | null;
  now: number;
}): Readiness {
  const pulledAt = i.lastPullOkAt === null ? Number.NaN : Date.parse(i.lastPullOkAt);
  const checks = {
    shell: i.sw?.shellCached === true,
    catalog: i.catalogVersion !== null && i.catalogVersion === i.serverCatalogVersion,
    illustrations: i.sw !== null && i.sw.illustrationsMissing === 0,
    recentPull: !Number.isNaN(pulledAt) && i.now - pulledAt < RECENT_PULL_MS,
  };
  return { ready: checks.shell && checks.catalog && checks.illustrations && checks.recentPull, checks };
}

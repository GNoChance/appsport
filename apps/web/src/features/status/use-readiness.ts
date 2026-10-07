import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices, useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { computeReadiness, NOT_READY, type Readiness } from './readiness';

export const READINESS_REFRESH_MS = 5000;

/** État « Prêt hors ligne », recalculé au montage, à chaque état de synchro et toutes les 5 s. */
export function useReadiness(): { readiness: Readiness; refresh(): Promise<void>; retry(): Promise<void> } {
  const services = useServices();
  const repos = useRepos();
  const syncState = useSyncState();
  const [readiness, setReadiness] = useState<Readiness>(NOT_READY);
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const call = ++latest.current;
    const [sw, inputs] = await Promise.all([
      services.swStatus().catch(() => null),
      repos.status.readinessInputs(),
    ]);
    // Un calcul plus récent a pu finir avant celui-ci.
    if (!mounted.current || call !== latest.current) return;
    setReadiness(computeReadiness({ sw, ...inputs, now: services.now() }));
  }, [services, repos]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalcul voulu à chaque état de synchro
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, syncState]);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, READINESS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const retry = useCallback(async () => {
    try {
      await repos.status.retry();
    } catch {
      // Hors ligne ou catalogue indisponible : le voyant dit déjà ce qui manque.
    }
    await refresh();
  }, [repos, refresh]);

  return { readiness, refresh, retry };
}

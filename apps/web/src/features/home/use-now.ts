import { useEffect, useState } from 'react';
import { useServices } from '../../app-services';

/** Une minute : Paris est décalé d'heures entières, une minute pleine tombe pile à 18 h et à minuit. */
export const NOW_STEP_MS = 60_000;

/**
 * Heure de l'horloge des services (injectée dans les tests), relue à chaque minute pleine : un écran resté ouvert
 * suit la bascule de 18 h et le changement de jour par lui-même, sans attendre qu'autre chose le rende de nouveau.
 * Entre deux minutes, la valeur ne change pas, donc aucun rendu.
 */
export function useNow(stepMs = NOW_STEP_MS): number {
  const services = useServices();
  const [now, setNow] = useState(() => services.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Jusqu'à la prochaine minute pleine ; un minuteur parti un peu tôt se recale au tour suivant.
    const schedule = () => {
      timer = setTimeout(tick, stepMs - (services.now() % stepMs));
    };
    const tick = () => {
      setNow(services.now());
      schedule();
    };
    schedule();
    return () => clearTimeout(timer);
  }, [services, stepMs]);
  return now;
}

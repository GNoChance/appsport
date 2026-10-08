import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMe } from '../../app-services';

interface Target {
  userId: string;
  to: string;
}

/**
 * Navigation après l'ouverture d'une session (création du compte, réinitialisation) : elle attend
 * que `meta.me` porte le nouvel utilisateur, vu au même rendu par la garde de l'appli. Naviguer
 * plus tôt mènerait la garde, encore sur l'ancien état, à renvoyer vers /login.
 */
export function useSessionRedirect(): (userId: string, to: string) => void {
  const me = useMe();
  const [, navigate] = useLocation();
  const [target, setTarget] = useState<Target | null>(null);
  useEffect(() => {
    if (!target || me?.id !== target.userId) return;
    setTarget(null);
    navigate(target.to, { replace: true });
  }, [target, me, navigate]);
  return (userId, to) => setTarget({ userId, to });
}

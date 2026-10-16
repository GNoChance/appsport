import { useCallback, useEffect, useRef, useState } from 'react';

type Errors<K extends string> = Partial<Record<K, string>>;

/**
 * Erreurs rattachées aux champs d'un formulaire (maquettes A03, A04) : `show` les pose à l'envoi (refus
 * local ou du serveur) et le premier champ en cause, marqué aria-invalid au rendu, prend le focus ;
 * `clear` retire celles des champs repris à la saisie, sans déplacer le focus.
 */
export function useFieldErrors<K extends string>() {
  const formRef = useRef<HTMLFormElement>(null);
  // Chaque `show` compte une demande de focus, rendue avec ses erreurs : l'effet ne suit qu'elle.
  const [state, setState] = useState<{ errors: Errors<K>; focusRequest: number }>({
    errors: {},
    focusRequest: 0,
  });
  const { errors, focusRequest } = state;

  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const show = useCallback((next: Errors<K>) => {
    setState((s) => ({ errors: next, focusRequest: s.focusRequest + 1 }));
  }, []);

  const clear = useCallback((...keys: K[]) => {
    setState((s) => {
      if (!keys.some((k) => s.errors[k])) return s;
      const rest = { ...s.errors };
      for (const k of keys) delete rest[k];
      return { ...s, errors: rest };
    });
  }, []);

  return { formRef, errors, show, clear };
}

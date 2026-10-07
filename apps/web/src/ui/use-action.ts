import type { ApiErrorCode } from '@appsport/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, NetworkRequiredError } from '../api/client';
import { errorMessage } from './errors';

type ActionCode = ApiErrorCode | 'network' | 'unknown';

/** Action asynchrone d'un écran : état « en cours », message d'erreur traduit et code. */
export function useAction<A extends unknown[], R>(
  fn: (...a: A) => Promise<R>,
  overrides?: Partial<Record<ApiErrorCode, string>>,
): {
  run(...a: A): Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  code: ActionCode | null;
  reset(): void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<ActionCode | null>(null);
  const latest = useRef({ fn, overrides });
  latest.current = { fn, overrides };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setCode(null);
  }, []);

  const run = useCallback(async (...a: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    setCode(null);
    try {
      return await latest.current.fn(...a);
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e, latest.current.overrides));
        setCode(e instanceof ApiError ? e.code : e instanceof NetworkRequiredError ? 'network' : 'unknown');
      }
      return undefined;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);

  return { run, pending, error, code, reset };
}

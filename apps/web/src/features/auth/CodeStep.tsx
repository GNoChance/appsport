import { formatSecretCode, parseSecretCode } from '@appsport/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Button, Field } from '../../ui';
import styles from './auth.module.css';
import { INCOMPLETE_CODE_MESSAGE } from './messages';

/** Fragment d'adresse `#code` à l'ouverture de la page : présent ou non, et code lisible ou non. */
export interface FragmentCode {
  present: boolean;
  code: string | null;
}

export function readFragment(): FragmentCode {
  const hash = window.location.hash;
  return hash.length > 1 ? { present: true, code: parseSecretCode(hash) } : { present: false, code: null };
}

/**
 * Fragment lu une fois à l'ouverture, puis effacé de l'adresse par `history.replaceState` (R-INV-4).
 * La lecture est pure et l'effacement idempotent : le mode strict de React les rejoue sans dommage.
 */
export function useFragmentCode(): FragmentCode {
  const [fragment] = useState(readFragment);
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  return fragment;
}

/**
 * Saisie d'un code (lien complet ou code, R-INV-5) puis vérification par le serveur. Un fragment
 * lisible déclenche la vérification seul, une seule fois.
 */
export function CodeStep<T>(p: {
  label: string;
  fragment: FragmentCode;
  check(code: string): Promise<T>;
  onChecked(code: string, result: T): void;
  describeError(e: unknown): string;
}) {
  const [value, setValue] = useState(p.fragment.code ? formatSecretCode(p.fragment.code) : '');
  const [problem, setProblem] = useState<string | null>(
    p.fragment.present && !p.fragment.code ? INCOMPLETE_CODE_MESSAGE : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const latest = useRef(p);
  latest.current = p;

  const run = useCallback(async (code: string) => {
    setPending(true);
    setError(null);
    try {
      latest.current.onChecked(code, await latest.current.check(code));
    } catch (e) {
      setError(latest.current.describeError(e));
    } finally {
      setPending(false);
    }
  }, []);

  const started = useRef(false);
  useEffect(() => {
    const code = latest.current.fragment.code;
    if (started.current || !code) return;
    started.current = true;
    void run(code);
  }, [run]);

  const submit = () => {
    const code = parseSecretCode(value);
    if (!code) {
      setProblem(INCOMPLETE_CODE_MESSAGE);
      return;
    }
    void run(code);
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
    >
      <Field label={p.label} error={problem}>
        <input
          type="text"
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setProblem(null);
          }}
        />
      </Field>
      {pending ? <Banner tone="info">Vérification du code…</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button type="submit" disabled={pending}>
        Suivant
      </Button>
    </form>
  );
}

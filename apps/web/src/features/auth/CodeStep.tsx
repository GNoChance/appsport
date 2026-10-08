import { formatSecretCode, parseSecretCode } from '@appsport/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Button, Field } from '../../ui';
import styles from './auth.module.css';
import { INCOMPLETE_CODE_MESSAGE } from './messages';

/**
 * Fragment d'adresse `#code` : présent ou non, code lisible ou non, et numéro de lecture (`seq`),
 * qui change à chaque fragment reçu, même identique au précédent.
 */
export interface FragmentCode {
  present: boolean;
  code: string | null;
  seq: number;
}

export function readFragment(seq = 0): FragmentCode {
  const hash = window.location.hash;
  return hash.length > 1
    ? { present: true, code: parseSecretCode(hash), seq }
    : { present: false, code: null, seq };
}

/** Retire le fragment de l'adresse sans nouvelle entrée d'historique (R-INV-4). */
function clearFragment(): void {
  if (!window.location.hash) return;
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

/**
 * Fragment lu à l'ouverture, puis effacé de l'adresse par `history.replaceState` (R-INV-4) ; un
 * fragment reçu page ouverte (`hashchange` : lien ouvert dans l'appli déjà affichée) est lu et
 * effacé de même. La lecture initiale est pure et l'effacement idempotent : le mode strict de
 * React les rejoue sans dommage.
 */
export function useFragmentCode(): FragmentCode {
  const [fragment, setFragment] = useState(() => readFragment());
  useEffect(() => {
    clearFragment();
    const onHashChange = () => {
      if (!window.location.hash) return;
      const next = readFragment();
      clearFragment();
      setFragment((previous) => ({ ...next, seq: previous.seq + 1 }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return fragment;
}

/**
 * Saisie d'un code (lien complet ou code, R-INV-5) puis vérification par le serveur. Chaque
 * fragment lisible déclenche la vérification seul, une seule fois ; un fragment illisible est
 * signalé « Code incomplet ».
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

  const seen = useRef<number | null>(null);
  const { seq } = p.fragment;
  useEffect(() => {
    const { present, code } = latest.current.fragment;
    if (seen.current === seq) return;
    seen.current = seq;
    if (!present) return;
    if (!code) {
      setValue('');
      setProblem(INCOMPLETE_CODE_MESSAGE);
      return;
    }
    setValue(formatSecretCode(code));
    setProblem(null);
    void run(code);
  }, [seq, run]);

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

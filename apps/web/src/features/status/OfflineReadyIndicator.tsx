import { useState } from 'react';
import { Button } from '../../ui';
import { READINESS_FAILURES, type Readiness, type ReadinessCheck } from './readiness';
import styles from './status.module.css';
import { useReadiness } from './use-readiness';

const CHECKS = Object.keys(READINESS_FAILURES) as ReadinessCheck[];

function IndicatorView(p: { readiness: Readiness; onRetry?: () => void; retrying?: boolean }) {
  const { ready, checks } = p.readiness;
  const failing = CHECKS.filter((c) => !checks[c]);
  return (
    <section
      data-testid="offline-ready"
      data-state={ready ? 'ready' : 'not-ready'}
      className={`${styles.indicator} ${ready ? styles.ready : styles.notReady}`}
      aria-live="polite"
    >
      <p className={styles.title}>
        <span className={styles.dot} aria-hidden="true" />
        {ready ? 'Prêt hors ligne' : 'Pas encore prêt hors ligne'}
      </p>
      {failing.length > 0 ? (
        <ul className={styles.failures}>
          {failing.map((c) => (
            <li key={c}>{READINESS_FAILURES[c]}</li>
          ))}
        </ul>
      ) : null}
      {!ready && p.onRetry ? (
        <Button variant="secondary" onClick={p.onRetry} disabled={p.retrying}>
          Réessayer
        </Button>
      ) : null}
    </section>
  );
}

function LiveIndicator() {
  const { readiness, retry } = useReadiness();
  const [retrying, setRetrying] = useState(false);
  const onRetry = () => {
    setRetrying(true);
    void retry().finally(() => setRetrying(false));
  };
  return <IndicatorView readiness={readiness} onRetry={onRetry} retrying={retrying} />;
}

/** Voyant « Prêt hors ligne » : état fourni, ou calculé en direct (`useReadiness`). */
export function OfflineReadyIndicator(p: { readiness?: Readiness }) {
  return p.readiness ? <IndicatorView readiness={p.readiness} /> : <LiveIndicator />;
}

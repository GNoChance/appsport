import { useRef, useState } from 'react';
import { useServices } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, downloadJson, exportFileName, useAction } from '../../ui';
import styles from './privacy.module.css';

function unsentWarning(n: number): string {
  return n === 1
    ? "1 élément n'est pas encore envoyé au serveur : il ne figurera pas dans l'export."
    : `${n} éléments ne sont pas encore envoyés au serveur : ils ne figureront pas dans l'export.`;
}

/**
 * « Télécharger mes données » (R-EXP-1, P-DRT-1) : export du serveur, en ligne, enregistré sous
 * `appsport-export-AAAA-MM-JJ.json`. Des éléments encore dans la file d'envoi : avertissement
 * d'abord, et rien ne part avant « Exporter quand même ».
 */
export function ExportButton(p: { label?: string }) {
  const repos = useRepos();
  const { now } = useServices();
  const [unsent, setUnsent] = useState<number | null>(null);
  const checking = useRef(false);
  const exporting = useAction(async () => {
    const data = await repos.me.exportData();
    downloadJson(exportFileName(now()), data);
    setUnsent(null);
  });

  async function start() {
    if (checking.current) return;
    checking.current = true;
    exporting.reset();
    try {
      // File illisible : rien à signaler, l'export du serveur part quand même.
      const pending = await repos.status.pendingCount().catch(() => 0);
      if (pending > 0) setUnsent(pending);
      else await exporting.run();
    } finally {
      checking.current = false;
    }
  }

  return (
    <div className={styles.export}>
      <Button variant="secondary" disabled={exporting.pending} onClick={() => void start()}>
        {p.label ?? 'Télécharger mes données'}
      </Button>
      {unsent !== null ? (
        <Banner tone="warning">
          <p>{unsentWarning(unsent)}</p>
          <Button variant="secondary" disabled={exporting.pending} onClick={() => void exporting.run()}>
            Exporter quand même
          </Button>
        </Banner>
      ) : null}
      {exporting.error ? <Banner tone="error">{exporting.error}</Banner> : null}
    </div>
  );
}

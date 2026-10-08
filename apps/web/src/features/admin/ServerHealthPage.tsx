import type { OpsStatus, OpsStatusResponse } from '@appsport/contracts';
import { useCallback, useId } from 'react';
import { useServices } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, formatAge, formatDate, Page } from '../../ui';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';
import { LoadFailure, Loading, useServerData } from './admin-ui';

const HOUR_MS = 3_600_000;
/** [décision plan] période de 24 h + 2 h de grâce du contrôle `backup` (08 §9). */
export const BACKUP_LATE_MS = 26 * HOUR_MS;
const BACKUP_LATE_HOURS = BACKUP_LATE_MS / HOUR_MS;
/** Disque en alerte au-delà de ce taux d'occupation (08 §9, contrôle `host`). */
export const DISK_WARN_PCT = 80;

export const NO_OPS_STATUS =
  "Aucun état d'exploitation disponible : les scripts de l'hôte n'ont encore rien écrit.";
/** Contrôle `backup` : « sauvegarde absente » est une alerte (08 §9). */
export const NO_BACKUP = 'Aucune sauvegarde enregistrée';

/**
 * Âge de la dernière sauvegarde : en heures jusqu'à 72 h, pour qu'un retard (au-delà de 26 h) ne
 * se lise pas « il y a 1 j » ; au-delà, en jours.
 */
function backupAge(iso: string, nowMs: number): string {
  const hours = Math.floor((nowMs - Date.parse(iso)) / HOUR_MS);
  return hours >= 1 && hours < 72 ? `il y a ${hours} h` : formatAge(iso, nowMs);
}

const done = (ok: boolean) => (ok ? 'réussi' : 'échoué');
const doneFeminine = (ok: boolean) => (ok ? 'réussie' : 'échouée');

/**
 * Admin › État du serveur (08 §9) : version en service, dernier déploiement, âge de la dernière
 * sauvegarde (en retard au-delà de 26 h), dernier test de restauration, espace disque, SMART et
 * redémarrage, tels qu'écrits par les scripts de l'hôte dans /data/ops/status.json.
 */
export function ServerHealthPage() {
  const repos = useRepos();
  const load = useCallback(() => repos.admin.opsStatus(), [repos]);
  const { data, error, loading, reload } = useServerData(load);
  return (
    <Page title="État du serveur">
      <AdminNav />
      {loading ? <Loading /> : null}
      {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
      {data ? <HealthReport status={data} /> : null}
    </Page>
  );
}

function HealthReport(p: { status: OpsStatusResponse }) {
  const { now } = useServices();
  const ops = p.status.opsStatus;
  return (
    <>
      <p>Version en service : {p.status.version}</p>
      {ops ? <OpsReport ops={ops} nowMs={now()} /> : <p>{NO_OPS_STATUS}</p>}
    </>
  );
}

function OpsReport(p: { ops: OpsStatus; nowMs: number }) {
  const { deploy, backup, restoreTest, host } = p.ops;
  const hostId = useId();
  const disksId = useId();
  const late = backup !== undefined && p.nowMs - Date.parse(backup.at) > BACKUP_LATE_MS;
  return (
    <>
      {backup && !backup.ok ? (
        <Banner tone="error">
          La dernière sauvegarde a échoué.{backup.detail ? ` Détail : ${backup.detail}` : ''}
        </Banner>
      ) : null}
      {backup === undefined ? <Banner tone="warning">{NO_BACKUP}</Banner> : null}
      {late ? <Banner tone="warning">Sauvegarde en retard (plus de {BACKUP_LATE_HOURS} h)</Banner> : null}
      <ul className={styles.facts}>
        <li>
          {deploy
            ? `Dernier déploiement : ${deploy.version} le ${formatDate(deploy.at)} (${done(deploy.ok)})`
            : 'Dernier déploiement : aucun'}
        </li>
        <li>
          {backup
            ? `Dernière sauvegarde : ${backupAge(backup.at, p.nowMs)} (${doneFeminine(backup.ok)})`
            : 'Dernière sauvegarde : aucune'}
        </li>
        <li>
          {restoreTest
            ? `Dernier test de restauration : ${formatDate(restoreTest.at)} (${done(restoreTest.ok)})`
            : 'Dernier test de restauration : aucun'}
        </li>
        <li>
          {host
            ? `Dernier contrôle de l'hôte : ${formatAge(host.at, p.nowMs)}`
            : "Dernier contrôle de l'hôte : aucun"}
        </li>
      </ul>
      {host ? (
        <section aria-labelledby={hostId} className={styles.section}>
          <h2 id={hostId}>Hôte</h2>
          <h3 id={disksId}>Espace disque</h3>
          <ul aria-labelledby={disksId} className={styles.facts}>
            {host.disks.map((d) => {
              const warn = d.usedPct > DISK_WARN_PCT;
              return (
                <li key={d.mount} className={warn ? styles.alert : undefined}>
                  {`${d.mount} : ${Math.ceil(d.usedPct)} %${warn ? ` (au-delà de ${DISK_WARN_PCT} %)` : ''}`}
                </li>
              );
            })}
          </ul>
          <p className={host.smartOk ? undefined : styles.alert}>
            {host.smartOk ? 'SMART : OK' : 'SMART : problème détecté'}
          </p>
          {host.rebootRequired ? <p className={styles.alert}>Redémarrage nécessaire</p> : null}
        </section>
      ) : null}
    </>
  );
}

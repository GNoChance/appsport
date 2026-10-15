import type { OpsStatus, OpsStatusResponse } from '@rune/contracts';
import { type CSSProperties, type ReactNode, useCallback, useId } from 'react';
import { useServices } from '../../app-services';
import { useRepos } from '../../repos';
import { Badge, Banner, formatAge, formatDate, plural } from '../../ui';
import { AdminPage } from './AdminPage';
import styles from './admin.module.css';
import { LoadFailure, Loading, useServerData } from './admin-ui';
import {
  BackupIcon,
  ClockIcon,
  DeployIcon,
  DriveIcon,
  PowerIcon,
  PulseIcon,
  RestoreIcon,
  ServerIcon,
  WarningIcon,
} from './icons';

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

const backupLate = (backup: OpsStatus['backup'], nowMs: number) =>
  backup !== undefined && nowMs - Date.parse(backup.at) > BACKUP_LATE_MS;

/**
 * Alertes de l'état d'exploitation (08 §9) : déploiement raté (y compris celui que les scripts écrivent avec
 * `ok: false` et la même version, T43-F14), sauvegarde absente, ratée ou en retard (une alerte), test de
 * restauration raté, chaque disque au-delà de 80 %, SMART en défaut, redémarrage nécessaire.
 */
export function opsAlertCount(ops: OpsStatus, nowMs: number): number {
  const { deploy, backup, restoreTest, host } = ops;
  return [
    deploy !== undefined && !deploy.ok,
    backup === undefined || !backup.ok || backupLate(backup, nowMs),
    restoreTest !== undefined && !restoreTest.ok,
    ...(host
      ? [...host.disks.map((d) => d.usedPct > DISK_WARN_PCT), !host.smartOk, host.rebootRequired]
      : []),
  ].filter(Boolean).length;
}

/** Résultat d'un contrôle : réussi en vert, échoué en danger (le mot dit toujours l'état). */
function Outcome(p: { ok: boolean; feminine?: boolean }) {
  const label = p.ok ? 'Réussi' : 'Échoué';
  return <Badge tone={p.ok ? 'success' : 'danger'}>{p.feminine ? `${label}e` : label}</Badge>;
}

/**
 * Admin › Serveur (08 §9, maquette E05) : résumé (version en service, nombre d'alertes, dernier contrôle de
 * l'hôte), puis l'exploitation (dernier déploiement, âge de la dernière sauvegarde, en retard au-delà de 26 h,
 * dernier test de restauration), chacun avec son badge, et l'hôte (espace disque, SMART, redémarrage), tels
 * qu'écrits par les scripts de l'hôte dans /data/ops/status.json.
 */
export function ServerHealthPage() {
  const repos = useRepos();
  const load = useCallback(() => repos.admin.opsStatus(), [repos]);
  const { data, error, loading, reload } = useServerData(load);
  return (
    <AdminPage>
      {loading ? <Loading /> : null}
      {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
      {data ? <HealthReport status={data} /> : null}
    </AdminPage>
  );
}

function HealthReport(p: { status: OpsStatusResponse }) {
  const { now } = useServices();
  const nowMs = now();
  const ops = p.status.opsStatus;
  const alerts = ops ? opsAlertCount(ops, nowMs) : 0;
  return (
    <>
      <section aria-label="Résumé" className={`enter-up ${styles.card} ${styles.summary}`}>
        <div className={styles.summaryHead}>
          <span className={styles.summaryIcon} aria-hidden="true">
            <ServerIcon />
          </span>
          <div className={styles.summaryText}>
            <span className={styles.meta}>Version en service</span>
            <span className={styles.version}>{p.status.version}</span>
          </div>
          {ops ? (
            <Badge tone={alerts > 0 ? 'warning' : 'success'}>
              {alerts > 0 ? `${alerts} ${plural(alerts, 'alerte', 'alertes')}` : 'Aucune alerte'}
            </Badge>
          ) : null}
        </div>
        {ops ? (
          <p className={styles.hostCheck}>
            <ClockIcon />
            {ops.host
              ? `Dernier contrôle de l'hôte : ${formatAge(ops.host.at, nowMs)}`
              : "Dernier contrôle de l'hôte : aucun"}
          </p>
        ) : null}
      </section>
      {ops ? <OpsReport ops={ops} nowMs={nowMs} /> : <p>{NO_OPS_STATUS}</p>}
    </>
  );
}

/** Ligne d'un contrôle : icône, libellé, détail (date, âge, version), badge du résultat. */
function CheckRow(p: { icon: ReactNode; label: string; detail: string; badge?: ReactNode }) {
  return (
    <li className={styles.checkRow}>
      <span className={styles.checkIcon} aria-hidden="true">
        {p.icon}
      </span>
      <span className={styles.checkText}>
        <span className={styles.checkLabel}>{p.label}</span>
        <span className={styles.meta}>{p.detail}</span>
      </span>
      {p.badge}
    </li>
  );
}

function OpsReport(p: { ops: OpsStatus; nowMs: number }) {
  const { deploy, backup, restoreTest, host } = p.ops;
  const opsId = useId();
  return (
    <>
      {backup && !backup.ok ? (
        <Banner tone="error">
          La dernière sauvegarde a échoué.{backup.detail ? ` Détail : ${backup.detail}` : ''}
        </Banner>
      ) : null}
      {backup === undefined ? <Banner tone="warning">{NO_BACKUP}</Banner> : null}
      {backupLate(backup, p.nowMs) ? (
        <Banner tone="warning">Sauvegarde en retard (plus de {BACKUP_LATE_HOURS} h)</Banner>
      ) : null}
      <section aria-labelledby={opsId} className={styles.section}>
        <h2 id={opsId}>Exploitation</h2>
        <ul aria-labelledby={opsId} className={`${styles.card} ${styles.checks}`}>
          <CheckRow
            icon={<DeployIcon />}
            label="Dernier déploiement"
            detail={deploy ? `${deploy.version} le ${formatDate(deploy.at)}` : 'Aucun'}
            badge={deploy ? <Outcome ok={deploy.ok} /> : undefined}
          />
          <CheckRow
            icon={<BackupIcon />}
            label="Dernière sauvegarde"
            detail={backup ? backupAge(backup.at, p.nowMs) : 'Aucune'}
            badge={backup ? <Outcome ok={backup.ok} feminine /> : <Badge tone="warning">Absente</Badge>}
          />
          <CheckRow
            icon={<RestoreIcon />}
            label="Test de restauration"
            detail={restoreTest ? formatDate(restoreTest.at) : 'Aucun'}
            badge={restoreTest ? <Outcome ok={restoreTest.ok} /> : undefined}
          />
        </ul>
      </section>
      {host ? <HostReport host={host} /> : null}
    </>
  );
}

/** Hôte (08 §9, contrôle `host`) : occupation de chaque disque (barre qui se remplit), SMART et redémarrage. */
function HostReport(p: { host: NonNullable<OpsStatus['host']> }) {
  const { host } = p;
  const hostId = useId();
  const disksId = useId();
  return (
    <section aria-labelledby={hostId} className={styles.section}>
      <h2 id={hostId}>Hôte</h2>
      <div className={styles.card}>
        <div className={styles.disks}>
          <h3 id={disksId}>
            <DriveIcon />
            Espace disque
          </h3>
          <ul aria-labelledby={disksId}>
            {host.disks.map((d) => {
              const pct = Math.ceil(d.usedPct);
              const warn = d.usedPct > DISK_WARN_PCT;
              const fill = { '--fill': Math.min(100, Math.max(0, pct)) / 100 } as CSSProperties;
              return (
                <li key={d.mount} className={styles.disk} data-warn={warn || undefined}>
                  <span className={styles.diskHead}>
                    <span className={styles.diskMount}>{d.mount}</span>
                    <span className={styles.srOnly}> : </span>
                    <span className={styles.diskPct}>{pct} %</span>
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.barFill} style={fill} />
                  </span>
                  {warn ? (
                    <span className={styles.diskWarn}>
                      <WarningIcon />
                      Au-delà de {DISK_WARN_PCT} %
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
        <dl className={styles.hostFacts}>
          <div>
            <dt>
              <PulseIcon />
              SMART
            </dt>
            <dd>
              <Badge tone={host.smartOk ? 'success' : 'danger'}>
                {host.smartOk ? 'OK' : 'Problème détecté'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>
              <PowerIcon />
              Redémarrage
            </dt>
            <dd>{host.rebootRequired ? <Badge tone="warning">Nécessaire</Badge> : 'Non nécessaire'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

import type { MemberSummary } from '@rune/contracts';
import { type MouseEvent, type ReactNode, useId } from 'react';
import { Badge, formatAge } from '../../ui';
import styles from './admin.module.css';
import { CheckIcon, ClockIcon, DashIcon, MoreIcon } from './icons';

/** Dernière connexion, relative à l'horloge de l'appli (« il y a 3 h ») ; jamais connecté, dit tel quel. */
export function lastLoginText(lastLoginAt: string | null, nowMs: number): string {
  return lastLoginAt ? `Dernière connexion : ${formatAge(lastLoginAt, nowMs)}` : 'Jamais connecté';
}

/** Oui, non ou en cours : l'icône appuie le mot, qui dit toujours l'état. */
function Fact(p: { term: string; state: 'yes' | 'no' | 'pending'; children: ReactNode }) {
  const icon = p.state === 'yes' ? <CheckIcon /> : p.state === 'pending' ? <ClockIcon /> : <DashIcon />;
  return (
    <div className={styles.fact}>
      <dt>{p.term}</dt>
      <dd data-state={p.state}>
        {icon}
        {p.children}
      </dd>
    </div>
  );
}

/**
 * Carte d'un membre (maquette E01, 02 §6) : initiale, pseudo (le nom de la carte), badges de rôle, de statut et
 * « Mineur », dernière connexion relative, puis accords santé et coach et onboarding (oui ou non, jamais une donnée
 * C1 à C3 : seulement ce que renvoie /api/admin, P-ADM-1). Toutes les actions passent par la feuille
 * « Actions pour <pseudo> ».
 */
export function MemberCard(p: {
  member: MemberSummary;
  nowMs: number;
  onActions(e: MouseEvent<HTMLButtonElement>): void;
}) {
  const m = p.member;
  const nameId = useId();
  const active = m.status === 'active';
  return (
    <article aria-labelledby={nameId} className={styles.memberCard} data-status={m.status}>
      <div className={styles.memberHead}>
        <span className={styles.avatar} aria-hidden="true">
          {(Array.from(m.username)[0] ?? '').toUpperCase()}
        </span>
        <div className={styles.memberText}>
          <div className={styles.memberLine}>
            <h3 id={nameId} className={styles.memberName}>
              {m.username}
            </h3>
            {m.role === 'admin' ? <Badge tone="accent">Admin</Badge> : null}
            <Badge tone={active ? 'success' : 'muted'}>{active ? 'Actif' : 'Désactivé'}</Badge>
            {m.isMinor ? <Badge tone="warning">Mineur</Badge> : null}
          </div>
          <p className={styles.meta}>{lastLoginText(m.lastLoginAt, p.nowMs)}</p>
        </div>
        <button
          type="button"
          className={styles.moreButton}
          aria-label={`Actions pour ${m.username}`}
          aria-haspopup="dialog"
          onClick={p.onActions}
        >
          <MoreIcon />
        </button>
      </div>
      <dl className={styles.facts}>
        <Fact term="Accord santé" state={m.consents.health ? 'yes' : 'no'}>
          {m.consents.health ? 'Oui' : 'Non'}
        </Fact>
        <Fact term="Accord coach" state={m.consents.aiCoach ? 'yes' : 'no'}>
          {m.consents.aiCoach ? 'Oui' : 'Non'}
        </Fact>
        <Fact term="Onboarding" state={m.onboardingCompleted ? 'yes' : 'pending'}>
          {m.onboardingCompleted ? 'Terminé' : 'En cours'}
        </Fact>
      </dl>
    </article>
  );
}

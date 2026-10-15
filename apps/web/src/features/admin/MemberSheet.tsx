import type { MemberSummary } from '@rune/contracts';
import { useId } from 'react';
import { BottomSheet, ListGroup, ListRow, plural } from '../../ui';
import styles from './admin.module.css';
import {
  CalendarIcon,
  CloseIcon,
  KeyIcon,
  LogoutIcon,
  ShieldIcon,
  TrashIcon,
  UserCheckIcon,
  UserOffIcon,
} from './icons';

export type MemberAction = 'reset' | 'sessions' | 'status' | 'role' | 'birthDate' | 'delete';

function sessionsSummary(n: number): string {
  return n === 0 ? 'aucune session ouverte' : `${n} ${plural(n, 'session ouverte', 'sessions ouvertes')}`;
}

/**
 * Feuille « Actions pour <pseudo> » (maquette E02, spec refonte §10.5), nommée par le pseudo : rôle, statut et
 * sessions ouvertes, puis les actions courantes, et en dernier, à part et en danger, le groupe « Actions
 * sensibles » (Désactiver, Supprimer le compte). Un membre désactivé garde « Réactiver », en tête des actions.
 * Choisir une action ferme la feuille : sa confirmation (dialogue existant) prend la place.
 */
export function MemberSheet(p: {
  member: MemberSummary;
  onChoose(kind: MemberAction): void;
  onClose(): void;
}) {
  const m = p.member;
  const sensitiveId = useId();
  const active = m.status === 'active';
  const summary = [
    m.role === 'admin' ? 'Admin' : 'Membre',
    active ? 'Actif' : 'Désactivé',
    sessionsSummary(m.activeSessions),
  ].join(' · ');
  return (
    // Pas de barre d'actions : « Fermer » est en haut, et rien ne suit les actions sensibles.
    <BottomSheet open title={m.username} onClose={p.onClose} actions={null}>
      <div className={styles.sheetContent}>
        <div className={styles.sheetHead}>
          <p className={styles.meta}>{summary}</p>
          <button type="button" className={styles.closeButton} aria-label="Fermer" onClick={p.onClose}>
            <CloseIcon />
          </button>
        </div>
        <ListGroup>
          {active ? null : (
            <ListRow icon={<UserCheckIcon />} label="Réactiver" onClick={() => p.onChoose('status')} />
          )}
          <ListRow icon={<KeyIcon />} label="Lien de réinitialisation" onClick={() => p.onChoose('reset')} />
          <ListRow
            icon={<LogoutIcon />}
            label="Fermer les sessions"
            badge={
              // Le nombre seul à l'écran ; son unité pour le lecteur d'écran (« 2 sessions ouvertes »).
              <span className={styles.count}>
                {m.activeSessions}
                <span className={styles.srOnly}>
                  {` ${plural(m.activeSessions, 'session ouverte', 'sessions ouvertes')}`}
                </span>
              </span>
            }
            onClick={() => p.onChoose('sessions')}
          />
          <ListRow
            icon={<ShieldIcon />}
            label={m.role === 'admin' ? 'Rétrograder' : 'Promouvoir administrateur'}
            onClick={() => p.onChoose('role')}
          />
          <ListRow
            icon={<CalendarIcon />}
            label="Corriger la date de naissance"
            onClick={() => p.onChoose('birthDate')}
          />
        </ListGroup>
        <section aria-labelledby={sensitiveId} className={styles.sensitive}>
          <h3 id={sensitiveId}>Actions sensibles</h3>
          <ListGroup>
            {active ? (
              <ListRow
                tone="danger"
                icon={<UserOffIcon />}
                label="Désactiver"
                value="Plus de connexion, données conservées"
                onClick={() => p.onChoose('status')}
              />
            ) : null}
            <ListRow
              tone="danger"
              icon={<TrashIcon />}
              label="Supprimer le compte"
              value="Définitif, seulement à sa demande"
              onClick={() => p.onChoose('delete')}
            />
          </ListGroup>
        </section>
      </div>
    </BottomSheet>
  );
}

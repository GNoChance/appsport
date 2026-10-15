import { useCallback, useRef, useState } from 'react';
import { useLive, useMe, useSyncState } from '../../app-services';
import { useRepos } from '../../repos';
import { Badge, COACH_NAMES, CoachAvatar, ListGroup, ListRow, Page, plural, RankBadge } from '../../ui';
import { LogoutDialog } from '../auth/LogoutDialog';
import {
  HeartIcon,
  HelpIcon,
  LogoutIcon,
  PinIcon,
  ShieldIcon,
  SlidersIcon,
  TargetIcon,
  UsersIcon,
} from './icons';
import styles from './profile.module.css';
import { profileSummary } from './profile-summary';
import { useFocusAfterClose } from './use-focus-after-close';

/**
 * Espace Profil (spec refonte §5, maquette C01), qui remplace « Plus » : l'en-tête du compte (initiale,
 * pseudo, rôle, rang), puis les lignes groupées (Entraînement ; Compte et appli, avec un badge sur Réglages
 * quand la synchro a des refus ; Cercle pour l'admin seulement), et « Se déconnecter » à part, en bas, qui
 * ouvre la feuille où se choisit cet appareil ou tous. Les valeurs des lignes sont lues sur l'appareil, jamais
 * inventées : une valeur pas encore connue n'est pas affichée.
 */
export function ProfileHub() {
  const me = useMe();
  const repos = useRepos();
  const { rejected } = useSyncState();
  const profile = useLive(() => repos.profile.get(), [repos]);
  const places = useLive(() => repos.places.list(), [repos]);
  const limitations = useLive(() => repos.consent.limitations(), [repos]);
  const [logout, setLogout] = useState(false);
  const logoutRow = useRef<HTMLDivElement>(null);
  const closeLogout = useCallback(() => setLogout(false), []);
  useFocusAfterClose(logout, () => logoutRow.current?.querySelector('button'));
  if (!me) return null;

  const coach = profile?.coach ?? null;
  const primary = places?.find((p) => p.isPrimary)?.name;
  const activeLimitations = limitations?.filter((l) => l.active).length ?? 0;
  const health = me.consents.health.active
    ? `Accord donné${activeLimitations > 0 ? ` · ${activeLimitations} ${plural(activeLimitations, 'limitation', 'limitations')}` : ''}`
    : 'Accord non donné';

  return (
    <Page title="Profil">
      <div className={`${styles.hub} stagger`}>
        <section aria-label="Ton compte" className={styles.account}>
          <span className={styles.initial} aria-hidden="true">
            {me.username.charAt(0).toUpperCase()}
          </span>
          <span className={styles.who}>
            <span className={styles.username}>{me.username}</span>
            <Badge tone="accent">{me.role === 'admin' ? 'Admin' : 'Membre'}</Badge>
          </span>
          <RankBadge rank="E" size={40} mini />
        </section>
        <nav aria-label="Pages du profil" className={styles.groups}>
          <ListGroup title="Entraînement">
            <ListRow
              icon={<TargetIcon />}
              label="Mon profil"
              value={profileSummary(profile ?? null)}
              href="/profile/edit"
            />
            <ListRow
              icon={
                coach ? (
                  <span className={styles.coachIcon}>
                    <CoachAvatar coach={coach} size={36} decorative />
                  </span>
                ) : (
                  <TargetIcon />
                )
              }
              label="Mon coach"
              value={coach ? `${COACH_NAMES[coach]} · entraînement et nutrition` : undefined}
              href="/profile/coach"
            />
            <ListRow icon={<PinIcon />} label="Mes lieux" value={primary} href="/places" />
            <ListRow
              icon={<HeartIcon />}
              label="Santé"
              value={limitations === undefined ? undefined : health}
              href="/profile/health"
            />
          </ListGroup>
          <ListGroup title="Compte et appli">
            <ListRow
              icon={<ShieldIcon />}
              label="Confidentialité et données"
              value="Accords, export, suppression"
              href="/profile/privacy"
            />
            <ListRow
              icon={<SlidersIcon />}
              label="Réglages"
              value="Apparence, synchronisation"
              href="/settings"
              badge={
                rejected > 0 ? (
                  <Badge tone="warning">{`${rejected} ${plural(rejected, 'refusé', 'refusés')}`}</Badge>
                ) : undefined
              }
            />
            <ListRow icon={<HelpIcon />} label="Aide" value="En cas d'urgence : 15 ou 112" href="/help" />
          </ListGroup>
          {me.role === 'admin' ? (
            <ListGroup title="Cercle">
              <ListRow
                icon={<UsersIcon />}
                label="Administration"
                value="Membres, invitations, salles"
                href="/admin/members"
              />
            </ListGroup>
          ) : null}
        </nav>
        <div ref={logoutRow}>
          <ListGroup>
            <ListRow
              icon={<LogoutIcon />}
              label="Se déconnecter"
              tone="danger"
              onClick={() => setLogout(true)}
            />
          </ListGroup>
        </div>
      </div>
      <LogoutDialog open={logout} onClose={closeLogout} />
    </Page>
  );
}

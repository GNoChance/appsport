import type { MemberSummary } from '@rune/contracts';
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useServices } from '../../app-services';
import { useRepos } from '../../repos';
import { plural } from '../../ui';
import { AdminPage } from './AdminPage';
import styles from './admin.module.css';
import { LoadFailure, Loading, useServerData } from './admin-ui';
import { MemberCard } from './MemberCard';
import { MemberDialog } from './MemberDialogs';
import { type MemberAction, MemberSheet } from './MemberSheet';

/** « 4 membres · 1 désactivé » : le compte du cercle, et des comptes désactivés s'il y en a. */
export function membersCountText(members: readonly MemberSummary[]): string {
  const n = members.length;
  const disabled = members.filter((m) => m.status === 'disabled').length;
  const count = `${n} ${plural(n, 'membre', 'membres')}`;
  return disabled === 0 ? count : `${count} · ${disabled} ${plural(disabled, 'désactivé', 'désactivés')}`;
}

/**
 * Admin › Membres (02 §6, spec refonte §10.5, maquettes E01 et E02) : une carte par membre, avec seulement ce que
 * renvoie /api/admin (P-ADM-1). « Actions pour <pseudo> » ouvre sa feuille ; l'action choisie ouvre sa
 * confirmation, en ligne seulement, et la liste est relue après chaque réussite. À la fermeture, le focus revient
 * au bouton « Actions pour <pseudo> », ou au titre de la liste si le membre a disparu (supprimé).
 */
export function MembersPage() {
  const repos = useRepos();
  const { now } = useServices();
  const load = useCallback(() => repos.admin.members(), [repos]);
  const { data: members, error, loading, reload } = useServerData(load);
  const [sheet, setSheet] = useState<MemberSummary | null>(null);
  const [action, setAction] = useState<{ kind: MemberAction; member: MemberSummary } | null>(null);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Lu à la fermeture d'un dialogue : le déclencheur dans la feuille n'existe plus, son bouton d'origine oui.
  const [returnFocus] = useState<RefObject<HTMLElement | null>>(() => ({
    get current() {
      return opener.current?.isConnected ? opener.current : headingRef.current;
    },
  }));
  // Feuille fermée sans action choisie (« Fermer », Échap) : la feuille rend le focus à l'élément qui l'avait à
  // l'ouverture, mais sous Safari un bouton touché ne le prend pas, et c'était la page. Après son démontage (la
  // page n'est plus inerte), le focus resté sur la page revient au bouton « Actions pour <pseudo> ».
  const sheetShown = useRef(false);
  useEffect(() => {
    if (sheet) {
      sheetShown.current = true;
      return;
    }
    if (!sheetShown.current) return;
    sheetShown.current = false;
    const active = document.activeElement;
    if (!action && (!active || active === document.body)) returnFocus.current?.focus();
  }, [sheet, action, returnFocus]);

  return (
    <AdminPage>
      {loading ? <Loading /> : null}
      {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
      {members ? (
        <section aria-labelledby={headingId} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id={headingId} ref={headingRef} tabIndex={-1}>
              Membres du cercle
            </h2>
            <span className={styles.meta}>{membersCountText(members)}</span>
          </div>
          <ul aria-labelledby={headingId} className={`stagger ${styles.memberList}`}>
            {members.map((m) => (
              <li key={m.id}>
                <MemberCard
                  member={m}
                  nowMs={now()}
                  onActions={(e) => {
                    opener.current = e.currentTarget;
                    setSheet(m);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sheet ? (
        <MemberSheet
          key={sheet.id}
          member={sheet}
          onClose={() => setSheet(null)}
          onChoose={(kind) => {
            setSheet(null);
            setAction({ kind, member: sheet });
          }}
        />
      ) : null}
      {action ? (
        <MemberDialog
          // Une autre action ou un autre membre : dialogue neuf (rien de la saisie précédente).
          key={`${action.kind}:${action.member.id}`}
          kind={action.kind}
          member={action.member}
          reload={reload}
          onClose={() => setAction(null)}
          fallbackFocus={returnFocus}
        />
      ) : null}
    </AdminPage>
  );
}

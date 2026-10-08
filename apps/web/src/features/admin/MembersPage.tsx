import {
  type MemberSummary,
  MIN_AGE,
  PASSWORD_MIN_ADMIN,
  RESET_TTL_HOURS,
  type ResetLinkResponse,
} from '@appsport/contracts';
import { usernameKey } from '@appsport/domain';
import { type RefObject, useCallback, useId, useRef, useState } from 'react';
import { useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { Banner, Button, CopyButton, Dialog, Field, formatDateTime, Page, plural, useAction } from '../../ui';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';
import {
  ActionDialog,
  isStaleError,
  LoadFailure,
  SECRET_SHOWN_ONCE,
  useRestoreFocus,
  useServerData,
  WRONG_PASSWORD_MESSAGE,
} from './admin-ui';

export const RESET_SELF_MESSAGE = 'Pour toi-même, utilise la commande admin:reset sur le serveur.';
const COPY_LINK_FAILED = 'Copie impossible : sélectionne le lien et copie-le.';

const PASSWORD_OVERRIDES = { invalid_credentials: WRONG_PASSWORD_MESSAGE } as const;

type MemberAction = 'reset' | 'sessions' | 'status' | 'role' | 'birthDate' | 'delete';

type DialogProps = {
  member: MemberSummary;
  /** Relit la liste après une réussite ; le dialogue se ferme ensuite. */
  reload(): Promise<void>;
  onClose(): void;
  /** Focus à la fermeture quand le bouton d'origine a disparu (membre supprimé). */
  fallbackFocus: RefObject<HTMLElement | null>;
};

const yesNo = (v: boolean) => (v ? 'oui' : 'non');

/**
 * Admin › Membres (02 §6) : un tableau, une ligne par membre nommée par son pseudo, avec
 * seulement ce que renvoie /api/admin (P-ADM-1) : rôle, statut, badge « mineur », dernière
 * connexion, onboarding, accords santé et coach (oui ou non, jamais de donnée C2). Chaque action
 * passe par un dialogue de confirmation, en ligne seulement ; la liste est relue après chaque
 * réussite.
 */
export function MembersPage() {
  const repos = useRepos();
  const load = useCallback(() => repos.admin.members(), [repos]);
  const { data: members, error, reload } = useServerData(load);
  const [action, setAction] = useState<{ kind: MemberAction; member: MemberSummary } | null>(null);
  const tableRef = useRef<HTMLElement>(null);
  const captionId = useId();

  return (
    <Page title="Membres">
      <AdminNav />
      {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
      {members ? (
        <section
          ref={tableRef}
          className={styles.tableWrap}
          aria-labelledby={captionId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: zone qui défile sur petit écran, atteignable au clavier
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption id={captionId} className={styles.visuallyHidden}>
              Membres du cercle
            </caption>
            <thead>
              <tr>
                <th scope="col">Pseudo</th>
                <th scope="col">Rôle</th>
                <th scope="col">Statut</th>
                <th scope="col">Dernière connexion</th>
                <th scope="col">Onboarding</th>
                <th scope="col">Accord santé</th>
                <th scope="col">Accord coach</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onAction={(kind) => setAction({ kind, member: m })} />
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {action ? (
        <MemberDialog
          kind={action.kind}
          member={action.member}
          reload={reload}
          onClose={() => setAction(null)}
          fallbackFocus={tableRef}
        />
      ) : null}
    </Page>
  );
}

function MemberRow(p: { member: MemberSummary; onAction(kind: MemberAction): void }) {
  const m = p.member;
  const nameId = useId();
  const act = (kind: MemberAction, label: string, danger = false) => (
    <Button variant={danger ? 'danger' : 'secondary'} onClick={() => p.onAction(kind)}>
      {label}
    </Button>
  );
  return (
    <tr aria-labelledby={nameId}>
      <th scope="row">
        <span id={nameId}>{m.username}</span>
        {m.isMinor ? <span className={styles.badge}>mineur</span> : null}
      </th>
      <td>{m.role === 'admin' ? 'admin' : 'membre'}</td>
      <td>{m.status === 'active' ? 'actif' : 'désactivé'}</td>
      <td>{m.lastLoginAt ? formatDateTime(m.lastLoginAt) : 'Jamais connecté'}</td>
      <td>{m.onboardingCompleted ? 'Onboarding terminé' : 'Onboarding en cours'}</td>
      <td>{yesNo(m.consents.health)}</td>
      <td>{yesNo(m.consents.aiCoach)}</td>
      <td>
        <div className={styles.rowActions}>
          {act('reset', 'Lien de réinitialisation')}
          {act('sessions', 'Fermer les sessions')}
          {act('status', m.status === 'active' ? 'Désactiver' : 'Réactiver')}
          {act('role', m.role === 'admin' ? 'Rétrograder' : 'Promouvoir administrateur')}
          {act('birthDate', 'Corriger la date de naissance')}
          {act('delete', 'Supprimer', true)}
        </div>
      </td>
    </tr>
  );
}

function MemberDialog(p: DialogProps & { kind: MemberAction }) {
  switch (p.kind) {
    case 'reset':
      return <ResetLinkDialog {...p} />;
    case 'sessions':
      return <SessionsDialog {...p} />;
    case 'status':
      return <StatusDialog {...p} />;
    case 'role':
      return <RoleDialog {...p} />;
    case 'birthDate':
      return <BirthDateDialog {...p} />;
    case 'delete':
      return <DeleteDialog {...p} />;
  }
}

/** Mot de passe de l'admin, ressaisi au moment de l'action (P-AUT-5). */
function AdminPasswordField(p: { value: string; onChange(v: string): void }) {
  return (
    <Field label="Ton mot de passe">
      <input
        type="password"
        autoComplete="current-password"
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </Field>
  );
}

/**
 * Lien de réinitialisation (R-RST-1 à R-RST-4) : généré à la demande, puis lien et code affichés
 * une seule fois. Ils ne vivent que dans ce dialogue : « J'ai transmis le lien », Échap ou la
 * fermeture les effacent. L'admin ne voit ni ne choisit jamais le mot de passe.
 */
function ResetLinkDialog(p: DialogProps) {
  const repos = useRepos();
  const name = p.member.username;
  const [created, setCreated] = useState<ResetLinkResponse | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const generate = useAction(
    async () => {
      const r = await repos.admin.resetLink(p.member.id).catch((e: unknown) => {
        // Membre supprimé entre-temps : la liste est relue, le message reste.
        if (isStaleError(e)) void p.reload();
        throw e;
      });
      setCreated(r);
      void p.reload();
    },
    { reset_self_forbidden: RESET_SELF_MESSAGE },
  );
  useRestoreFocus(p.fallbackFocus);
  const busy = useRef(false);
  busy.current = generate.pending;
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  const close = useCallback(() => {
    if (!busy.current) onClose.current();
  }, []);
  // « Générer » disparaît avec la réponse : le focus passe au lien et au code.
  const focusOnMount = useCallback((el: HTMLDivElement | null) => el?.focus(), []);

  return (
    <Dialog
      open
      title="Générer un lien de réinitialisation"
      onClose={close}
      actions={
        created ? (
          <Button onClick={close}>J'ai transmis le lien</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={generate.pending}>
              Annuler
            </Button>
            <Button onClick={() => void generate.run()} disabled={generate.pending}>
              Générer
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div ref={focusOnMount} tabIndex={-1} className={styles.secretPanel}>
          <p>
            Lien pour {name} : <span className={styles.secret}>{created.link}</span>
          </p>
          <p>
            Code : <span className={styles.secret}>{created.code}</span>
          </p>
          <p>Valable jusqu'au {formatDateTime(created.expiresAt)}.</p>
          <CopyButton text={created.link} onResult={(copied) => setCopyFailed(!copied)} />
          {copyFailed ? <Banner tone="error">{COPY_LINK_FAILED}</Banner> : null}
          <p className={styles.once}>{SECRET_SHOWN_ONCE}</p>
        </div>
      ) : (
        <div className={styles.dialogForm}>
          <p>
            Pour {name}. Le lien et le code ne s'affichent qu'une fois : transmets-les hors de l'appli. Ils
            sont valables {RESET_TTL_HOURS} h ; un nouveau lien annule le précédent.
          </p>
          {generate.error ? <Banner tone="error">{generate.error}</Banner> : null}
        </div>
      )}
    </Dialog>
  );
}

function sessionsText(name: string, n: number): string {
  if (n === 0) return `${name} n'a aucune session ouverte.`;
  const closed = n === 1 ? 'elle sera fermée' : 'elles seront toutes fermées';
  return `${name} a ${n} ${plural(n, 'session ouverte', 'sessions ouvertes')} : ${closed}, il faudra se reconnecter sur chaque appareil.`;
}

/** Fermeture de toutes les sessions d'un membre (R-AUTH-7 : téléphone perdu). */
function SessionsDialog(p: DialogProps) {
  const repos = useRepos();
  const name = p.member.username;
  return (
    <ActionDialog
      title={`Fermer les sessions de ${name}`}
      confirmLabel="Fermer les sessions"
      fallbackFocus={p.fallbackFocus}
      reload={p.reload}
      onClose={p.onClose}
      onConfirm={async () => {
        await repos.admin.revokeSessions(p.member.id);
        await p.reload();
      }}
    >
      <p>{sessionsText(name, p.member.activeSessions)}</p>
      <p>Ce qui n'était pas encore envoyé reste sur l'appareil et partira à la reconnexion.</p>
    </ActionDialog>
  );
}

/** Désactivation et réactivation (R-ADM-1) ; le dernier admin actif reste (R-ROLE-2). */
function StatusDialog(p: DialogProps) {
  const repos = useRepos();
  const name = p.member.username;
  const disabling = p.member.status === 'active';
  return (
    <ActionDialog
      title={disabling ? `Désactiver ${name}` : `Réactiver ${name}`}
      confirmLabel={disabling ? 'Désactiver' : 'Réactiver'}
      danger={disabling}
      fallbackFocus={p.fallbackFocus}
      reload={p.reload}
      onClose={p.onClose}
      onConfirm={async () => {
        await repos.admin.setStatus(p.member.id, disabling ? 'disabled' : 'active');
        await p.reload();
      }}
    >
      {disabling ? (
        <p>
          {name} ne pourra plus se connecter et ses sessions seront fermées. Ses données sont conservées : tu
          pourras réactiver le compte. Pour un départ, retire aussi son partage Tailscale.
        </p>
      ) : (
        <p>{name} pourra de nouveau se connecter.</p>
      )}
    </ActionDialog>
  );
}

/**
 * Promotion et rétrogradation : mot de passe de l'admin ressaisi (P-AUT-5), dernier admin gardé
 * (R-ROLE-2). Se rétrograder soi-même retire tout droit d'administration : le profil est relu (la
 * liste serait refusée) et la garde des routes répond « Page introuvable ».
 */
function RoleDialog(p: DialogProps) {
  const repos = useRepos();
  const me = useMe();
  const [password, setPassword] = useState('');
  const name = p.member.username;
  const promoting = p.member.role === 'member';
  const self = p.member.id === me?.id;
  return (
    <ActionDialog
      title={promoting ? `Promouvoir ${name} administrateur` : `Rétrograder ${name}`}
      confirmLabel={promoting ? 'Promouvoir administrateur' : 'Rétrograder'}
      canConfirm={password !== ''}
      overrides={PASSWORD_OVERRIDES}
      fallbackFocus={p.fallbackFocus}
      reload={p.reload}
      onClose={p.onClose}
      onConfirm={async () => {
        await repos.admin.setRole(p.member.id, promoting ? 'admin' : 'member', password);
        if (self) await repos.me.refresh();
        else await p.reload();
      }}
    >
      {promoting ? (
        <p>
          {name} aura tous les droits d'administration. Un administrateur a un mot de passe de{' '}
          {PASSWORD_MIN_ADMIN} caractères au moins : s'il est plus court, il faudra le changer à la prochaine
          connexion.
        </p>
      ) : (
        <p>{name} perdra les droits d'administration et redeviendra membre.</p>
      )}
      <AdminPasswordField value={password} onChange={setPassword} />
    </ActionDialog>
  );
}

/** Correction de la date de naissance (R-AGE-4) : refusée sous l'âge minimal. */
function BirthDateDialog(p: DialogProps) {
  const repos = useRepos();
  const [birthDate, setBirthDate] = useState('');
  const name = p.member.username;
  return (
    <ActionDialog
      title={`Corriger la date de naissance de ${name}`}
      confirmLabel="Enregistrer"
      canConfirm={birthDate !== ''}
      fallbackFocus={p.fallbackFocus}
      reload={p.reload}
      onClose={p.onClose}
      onConfirm={async () => {
        await repos.admin.setBirthDate(p.member.id, birthDate);
        await p.reload();
      }}
    >
      <p>
        Refusée si {name} a moins de {MIN_AGE} ans : désactive ou supprime alors le compte.
      </p>
      <Field label="Date de naissance">
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}

/**
 * Suppression d'un compte à la demande du membre (R-SUP-2, P-DRT-3) : pseudo tapé pour confirmer
 * (comparé comme le serveur : NFKC puis minuscules) et mot de passe de l'admin.
 */
function DeleteDialog(p: DialogProps) {
  const repos = useRepos();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const name = p.member.username;
  const confirmed = usernameKey(typed.trim()) === usernameKey(name);
  return (
    <ActionDialog
      title={`Supprimer le compte de ${name}`}
      confirmLabel="Supprimer définitivement"
      danger
      canConfirm={confirmed && password !== ''}
      overrides={PASSWORD_OVERRIDES}
      fallbackFocus={p.fallbackFocus}
      reload={p.reload}
      onClose={p.onClose}
      onConfirm={async () => {
        await repos.admin.deleteMember(p.member.id, typed.trim(), password);
        await p.reload();
      }}
    >
      <p>
        À faire seulement à la demande de {name}. Tout son compte est effacé tout de suite et définitivement :
        profil, lieux, accords et données de santé. Les salles restent.
      </p>
      <Field label="Tape le pseudo pour confirmer">
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Field>
      <AdminPasswordField value={password} onChange={setPassword} />
    </ActionDialog>
  );
}

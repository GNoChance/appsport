import { type CreateInvitationResponse, INVITATION_NOTE_MAX, type InvitationSummary } from '@rune/contracts';
import { type FormEvent, Fragment, useCallback, useId, useRef, useState } from 'react';
import { useRepos } from '../../repos';
import {
  Badge,
  Banner,
  Button,
  CopyButton,
  EmptyState,
  Field,
  formatDate,
  formatDateTime,
  SystemPanel,
  useAction,
} from '../../ui';
import { AdminPage } from './AdminPage';
import styles from './admin.module.css';
import { ActionDialog, LoadFailure, Loading, SECRET_SHOWN_ONCE, useServerData } from './admin-ui';
import { MailIcon, WarningIcon } from './icons';
import { buildInvitationShareMessage } from './share-message';

const BIRTH_DATE_REQUIRED = 'Saisis la date de naissance.';
const SHARE_FAILED = 'Partage impossible : copie le message.';
const COPY_FAILED = 'Copie impossible : sélectionne le message et copie-le.';

const STATE_BADGES = {
  pending: { tone: 'warning', label: 'En attente' },
  used: { tone: 'success', label: 'Utilisée' },
  revoked: { tone: 'muted', label: 'Révoquée' },
  expired: { tone: 'muted', label: 'Expirée' },
} as const satisfies Record<
  InvitationSummary['state'],
  { tone: 'warning' | 'success' | 'muted'; label: string }
>;

/** Ligne sous la date de création (R-INV-7) : l'échéance d'une invitation en attente, le pseudo créé d'une utilisée. */
function invitationDetail(i: InvitationSummary): string | null {
  if (i.state === 'pending') return `Expire le ${formatDate(i.expiresAt)}`;
  if (i.state === 'used') return `Utilisée par ${i.usedByUsername ?? 'un ancien membre'}`;
  return null;
}

/**
 * Admin › Invitations (02 §6, R-INV-1 à R-INV-9, maquettes E03 et E04) : création (date de naissance obligatoire,
 * note facultative), puis liste en cartes : note, badge d'état, dates et pseudo créé ; une invitation en attente
 * se révoque. Une fois créée, l'invitation (code et message de partage) prend la place du formulaire, affichée
 * une seule fois : « J'ai noté le code » l'efface, et rien ne la garde quand on quitte la page. En ligne seulement.
 */
export function InvitationsPage() {
  const repos = useRepos();
  const load = useCallback(() => repos.admin.invitations(), [repos]);
  const { data: invitations, error, loading, reload } = useServerData(load);
  const [created, setCreated] = useState<CreateInvitationResponse | null>(null);
  const [revoking, setRevoking] = useState<InvitationSummary | null>(null);
  const newHeadingId = useId();
  const listHeadingId = useId();
  const listRef = useRef<HTMLHeadingElement>(null);
  // Le formulaire revient après « J'ai noté le code » : son titre prend alors le focus (le bouton est parti).
  const refocusForm = useRef(false);
  const newHeadingRef = useCallback((el: HTMLHeadingElement | null) => {
    if (!el || !refocusForm.current) return;
    refocusForm.current = false;
    el.focus();
  }, []);
  const pending = invitations?.filter((i) => i.state === 'pending').length ?? 0;

  return (
    <AdminPage>
      {created ? (
        <CreatedInvitation
          key={created.code}
          created={created}
          onDone={() => {
            refocusForm.current = true;
            setCreated(null);
          }}
        />
      ) : (
        <section aria-labelledby={newHeadingId} className={styles.section}>
          <h2 id={newHeadingId} ref={newHeadingRef} tabIndex={-1}>
            Nouvelle invitation
          </h2>
          <InvitationForm
            onCreated={(r) => {
              setCreated(r);
              void reload();
            }}
          />
        </section>
      )}
      <section aria-labelledby={listHeadingId} className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id={listHeadingId} ref={listRef} tabIndex={-1}>
            Invitations envoyées
          </h2>
          {pending > 0 ? <span className={styles.meta}>{pending} en attente</span> : null}
        </div>
        {loading ? <Loading /> : null}
        {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
        {invitations && invitations.length === 0 ? (
          <EmptyState
            icon={<MailIcon />}
            title="Aucune invitation pour l'instant."
            text="Chaque invitation créée apparaît ici, avec son état."
          />
        ) : null}
        {invitations && invitations.length > 0 ? (
          <ul aria-labelledby={listHeadingId} className={`stagger ${styles.cards}`}>
            {invitations.map((i) => (
              <InvitationCard key={i.id} invitation={i} onRevoke={() => setRevoking(i)} />
            ))}
          </ul>
        ) : null}
      </section>
      {revoking ? (
        <ActionDialog
          title="Révoquer l'invitation"
          confirmLabel="Révoquer"
          danger
          fallbackFocus={listRef}
          reload={reload}
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await repos.admin.revokeInvitation(revoking.id);
            await reload();
          }}
        >
          <p>
            L'invitation {revoking.note ? `« ${revoking.note} »` : 'sans note'} ne pourra plus servir, et la
            date de naissance qu'elle portait est effacée.
          </p>
        </ActionDialog>
      ) : null}
    </AdminPage>
  );
}

/**
 * Carte d'une invitation (maquette E03) ; « Révoquer » est décrit par la note et les dates, pour dire laquelle
 * (deux invitations « Sans note » se distinguent par leurs dates).
 */
function InvitationCard(p: { invitation: InvitationSummary; onRevoke(): void }) {
  const i = p.invitation;
  const id = useId();
  const [titleId, createdId, detailId] = [`${id}-note`, `${id}-created`, `${id}-detail`];
  const badge = STATE_BADGES[i.state];
  const detail = invitationDetail(i);
  return (
    <li className={`${styles.card} ${styles.invitationCard}`}>
      <div className={styles.cardText}>
        <div className={styles.cardHead}>
          <span id={titleId} className={styles.cardTitle}>
            {i.note ?? 'Sans note'}
          </span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <span id={createdId} className={styles.meta}>
          Créée le {formatDate(i.createdAt)}
        </span>
        {detail ? (
          <span id={detailId} className={styles.meta}>
            {detail}
          </span>
        ) : null}
      </div>
      {i.state === 'pending' ? (
        <Button
          variant="danger"
          className={styles.compact}
          aria-describedby={[titleId, createdId, detail ? detailId : null].filter(Boolean).join(' ')}
          onClick={p.onRevoke}
        >
          Révoquer
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Date de naissance complète (obligatoire) et note libre de 60 caractères au plus (R-INV-1). Le formulaire
 * disparaît tant que le code de l'invitation créée est affiché : une nouvelle création ne peut pas l'écraser
 * (affiché une seule fois, R-INV-3).
 */
function InvitationForm(p: { onCreated(r: CreateInvitationResponse): void }) {
  const repos = useRepos();
  const [birthDate, setBirthDate] = useState('');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const birthDateRef = useRef<HTMLInputElement>(null);
  const create = useAction(async () => {
    const trimmed = note.trim();
    const r = await repos.admin.createInvitation({ birthDate, ...(trimmed ? { note: trimmed } : {}) });
    setBirthDate('');
    setNote('');
    p.onCreated(r);
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (create.pending) return;
    if (birthDate === '') {
      setFieldError(BIRTH_DATE_REQUIRED);
      birthDateRef.current?.focus();
      return;
    }
    setFieldError(null);
    void create.run();
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <Field label="Date de naissance" hint="Seul un administrateur pourra la corriger." error={fieldError}>
        <input
          ref={birthDateRef}
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </Field>
      <Field
        label="Note (facultative)"
        hint={`${INVITATION_NOTE_MAX} caractères au plus, par exemple « pour Léa ».`}
      >
        <input
          type="text"
          maxLength={INVITATION_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {create.error ? <Banner tone="error">{create.error}</Banner> : null}
      <Button type="submit" block disabled={create.pending}>
        Créer l'invitation
      </Button>
    </form>
  );
}

/**
 * Invitation créée (R-INV-3, R-INV-9, maquette E04), dans une fenêtre du Système : note et échéance, code, puis le
 * message de partage (le lien seul sur sa dernière ligne, le code jamais coupé en fin de ligne), affichés une seule
 * fois ; « Partager » si l'appareil sait partager, « Copier le message » toujours. Partage ou copie impossible : un
 * message le dit, le message reste affiché et se sélectionne d'un geste. Le focus passe au titre de la fenêtre :
 * le lecteur d'écran dit ce qui s'est passé, puis lit l'échéance et le code. « J'ai noté le code » efface tout
 * de l'écran.
 */
function CreatedInvitation(p: { created: CreateInvitationResponse; onDone(): void }) {
  const { code, link, invitation } = p.created;
  const message = buildInvitationShareMessage(window.location.origin, link, code);
  const canShare = typeof navigator.share === 'function';
  const [failure, setFailure] = useState<string | null>(null);
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);
  const messageId = useId();
  const validity = `jusqu'au ${formatDateTime(invitation.expiresAt)}.`;

  async function share() {
    setFailure(null);
    try {
      await navigator.share({ text: message });
    } catch (e) {
      // Partage annulé par l'utilisateur : rien à signaler.
      if (!(e instanceof Error && e.name === 'AbortError')) setFailure(SHARE_FAILED);
    }
  }

  return (
    <div className="enter-up">
      <SystemPanel title="Invitation créée." titleRef={focusOnMount}>
        <div className={styles.createdBody}>
          <p>{invitation.note ? `${invitation.note} · valable ${validity}` : `Valable ${validity}`}</p>
          <div className={styles.codeBox}>
            <span className={styles.codeLabel}>Code</span>
            <span className={styles.code}>{code}</span>
            <span className={styles.codeWarning}>
              <WarningIcon />
              {SECRET_SHOWN_ONCE}
            </span>
          </div>
          <figure aria-labelledby={messageId} className={styles.messageBlock}>
            <figcaption id={messageId} className={styles.codeLabel}>
              Message à envoyer
            </figcaption>
            <pre data-testid="share-message" className={styles.message}>
              {message.split(code).map((part, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: morceaux d'un message fixe, toujours dans le même ordre
                <Fragment key={i}>
                  {i > 0 ? <span className={styles.messageCode}>{code}</span> : null}
                  {part}
                </Fragment>
              ))}
            </pre>
          </figure>
          <div className={styles.shareActions}>
            {canShare ? <Button onClick={() => void share()}>Partager</Button> : null}
            <CopyButton
              text={message}
              label="Copier le message"
              onResult={(copied) => setFailure(copied ? null : COPY_FAILED)}
            />
          </div>
          {failure ? <Banner tone="error">{failure}</Banner> : null}
          <Button variant="secondary" block onClick={p.onDone}>
            J'ai noté le code
          </Button>
        </div>
      </SystemPanel>
    </div>
  );
}

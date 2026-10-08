import {
  type CreateInvitationResponse,
  INVITATION_NOTE_MAX,
  type InvitationSummary,
} from '@appsport/contracts';
import { type FormEvent, useCallback, useId, useRef, useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, CopyButton, Field, formatDate, formatDateTime, Page, useAction } from '../../ui';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';
import { ActionDialog, LoadFailure, SECRET_SHOWN_ONCE, useServerData } from './admin-ui';
import { buildInvitationShareMessage } from './share-message';

const BIRTH_DATE_REQUIRED = 'Saisis la date de naissance.';
const SHARE_FAILED = 'Partage impossible : copie le message.';

/** État affiché d'une invitation (R-INV-7). */
export function invitationStateText(i: InvitationSummary): string {
  switch (i.state) {
    case 'pending':
      return `En attente (expire le ${formatDate(i.expiresAt)})`;
    case 'used':
      return `Utilisée par ${i.usedByUsername ?? 'un ancien membre'}`;
    case 'revoked':
      return 'Révoquée';
    case 'expired':
      return 'Expirée';
  }
}

/**
 * Admin › Invitations (02 §6, R-INV-1 à R-INV-9) : création (date de naissance obligatoire, note
 * facultative), code et lien affichés une seule fois avec le message de partage, puis liste avec
 * note, dates, état et pseudo créé ; une invitation en attente se révoque. En ligne seulement.
 */
export function InvitationsPage() {
  const repos = useRepos();
  const load = useCallback(() => repos.admin.invitations(), [repos]);
  const { data: invitations, error, reload } = useServerData(load);
  const [created, setCreated] = useState<CreateInvitationResponse | null>(null);
  const [revoking, setRevoking] = useState<InvitationSummary | null>(null);
  const newHeadingId = useId();
  const listHeadingId = useId();
  const newRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLHeadingElement>(null);

  return (
    <Page title="Invitations">
      <AdminNav />
      <section aria-labelledby={newHeadingId} className={styles.section}>
        <h2 id={newHeadingId} ref={newRef} tabIndex={-1}>
          Nouvelle invitation
        </h2>
        <InvitationForm
          onCreated={(r) => {
            setCreated(r);
            void reload();
          }}
        />
      </section>
      {created ? (
        <CreatedInvitation
          key={created.code}
          created={created}
          onDone={() => {
            // Le panneau disparaît : le focus revient au formulaire.
            newRef.current?.focus();
            setCreated(null);
          }}
        />
      ) : null}
      <section aria-labelledby={listHeadingId} className={styles.section}>
        <h2 id={listHeadingId} ref={listRef} tabIndex={-1}>
          Invitations envoyées
        </h2>
        {error ? <LoadFailure message={error} onRetry={() => void reload()} /> : null}
        {invitations && invitations.length === 0 ? <p>Aucune invitation pour l'instant.</p> : null}
        {invitations && invitations.length > 0 ? (
          <ul aria-labelledby={listHeadingId} className={styles.cards}>
            {invitations.map((i) => (
              <li key={i.id} className={styles.card}>
                <span className={styles.cardTitle}>{i.note ?? 'Sans note'}</span>
                <span className={styles.meta}>Créée le {formatDate(i.createdAt)}</span>
                <span>{invitationStateText(i)}</span>
                {i.state === 'pending' ? (
                  <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => setRevoking(i)}>
                      Révoquer
                    </Button>
                  </div>
                ) : null}
              </li>
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
    </Page>
  );
}

/** Date de naissance complète (obligatoire) et note libre de 60 caractères au plus (R-INV-1). */
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
      <Button type="submit" disabled={create.pending}>
        Créer l'invitation
      </Button>
    </form>
  );
}

/**
 * Invitation créée (R-INV-3, R-INV-9) : code, lien et message de partage, affichés une seule fois ;
 * « Partager » si l'appareil sait partager, « Copier le message » toujours (le message reste
 * sélectionnable si la copie échoue). « J'ai noté le code » les efface de l'écran.
 */
function CreatedInvitation(p: { created: CreateInvitationResponse; onDone(): void }) {
  const { code, link, invitation } = p.created;
  const message = buildInvitationShareMessage(window.location.origin, link, code);
  const canShare = typeof navigator.share === 'function';
  const [shareError, setShareError] = useState<string | null>(null);
  const headingId = useId();
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);

  async function share() {
    setShareError(null);
    try {
      await navigator.share({ text: message });
    } catch (e) {
      // Partage annulé par l'utilisateur : rien à signaler.
      if (!(e instanceof Error && e.name === 'AbortError')) setShareError(SHARE_FAILED);
    }
  }

  return (
    <section aria-labelledby={headingId} className={`${styles.section} ${styles.secretPanel}`}>
      <h2 id={headingId} ref={focusOnMount} tabIndex={-1}>
        Invitation créée
      </h2>
      <p>
        Code : <span className={styles.secret}>{code}</span>
      </p>
      <p>
        Lien : <span className={styles.secret}>{link}</span>
      </p>
      <p>Valable jusqu'au {formatDateTime(invitation.expiresAt)}.</p>
      <p>Message à envoyer :</p>
      <pre data-testid="share-message" className={styles.message}>
        {message}
      </pre>
      <div className={styles.actions}>
        {canShare ? <Button onClick={() => void share()}>Partager</Button> : null}
        <CopyButton text={message} label="Copier le message" />
      </div>
      {shareError ? <Banner tone="error">{shareError}</Banner> : null}
      <p className={styles.once}>{SECRET_SHOWN_ONCE}</p>
      <Button variant="secondary" onClick={p.onDone}>
        J'ai noté le code
      </Button>
    </section>
  );
}

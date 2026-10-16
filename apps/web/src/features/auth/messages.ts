import {
  type ApiErrorCode,
  PASSWORD_MAX,
  PASSWORD_MIN_ADMIN,
  PASSWORD_MIN_MEMBER,
  type Role,
  SECRET_CODE_LENGTH,
  USERNAME_MAX,
  USERNAME_MIN,
} from '@rune/contracts';
import { type PasswordRejection, validatePassword } from '@rune/domain';
import { ApiError } from '../../api/client';
import { ERROR_MESSAGES, errorMessage } from '../../ui';

/** Un message par motif de rejet (R-MDP-1, R-MDP-3) ; le minimum d'un admin passe par `passwordMessage`. */
export const PASSWORD_MESSAGES: Record<PasswordRejection, string> = {
  too_short: `${PASSWORD_MIN_MEMBER} caractères au moins.`,
  too_long: `${PASSWORD_MAX} caractères au plus.`,
  common: 'Ce mot de passe est trop courant. Choisis-en un autre.',
  contains_username: 'Le mot de passe ne doit pas contenir ton pseudo.',
  contains_app_name: 'Le mot de passe ne doit pas contenir « rune ».',
  single_char: 'Le mot de passe ne peut pas répéter un seul caractère.',
};

export const PASSWORD_MISMATCH_MESSAGE = 'Les deux mots de passe ne correspondent pas.';

export function passwordMessage(reason: PasswordRejection, role: Role): string {
  return reason === 'too_short' && role === 'admin'
    ? `${PASSWORD_MIN_ADMIN} caractères au moins.`
    : PASSWORD_MESSAGES[reason];
}

/** La liste des mots de passe courants reste au serveur : `common` revient en `password_rejected`. */
const NO_COMMON_PASSWORDS: ReadonlySet<string> = new Set();

/**
 * Contrôle local d'un nouveau mot de passe avant tout envoi : message à afficher, ou null.
 * Les règles du mot de passe passent avant la confirmation.
 */
export function checkNewPassword(i: {
  password: string;
  confirm: string;
  username: string;
  role: Role;
}): string | null {
  const verdict = validatePassword(i.password, {
    username: i.username,
    role: i.role,
    commonPasswords: NO_COMMON_PASSWORDS,
  });
  if (!verdict.ok) return passwordMessage(verdict.reason, i.role);
  return i.password.normalize('NFC') === i.confirm.normalize('NFC') ? null : PASSWORD_MISMATCH_MESSAGE;
}

/** Refus local d'un nouveau mot de passe, rattaché à son champ : la confirmation, ou le mot de passe. */
export interface NewPasswordErrors {
  password?: string;
  confirm?: string;
}

/** Le message de `checkNewPassword` sous le champ en cause ; rien quand tout va bien. */
export function newPasswordErrors(problem: string | null): NewPasswordErrors {
  if (problem === null) return {};
  return problem === PASSWORD_MISMATCH_MESSAGE ? { confirm: problem } : { password: problem };
}

/**
 * Champs dont l'erreur part à la saisie : le mot de passe repris peut lever les deux erreurs, la
 * confirmation reprise seulement la sienne.
 */
export function editedPasswordFields(
  before: { password: string },
  after: { password: string },
): (keyof NewPasswordErrors)[] {
  return after.password !== before.password ? ['password', 'confirm'] : ['confirm'];
}

export const USERNAME_MESSAGES: Record<'length' | 'characters' | 'reserved', string> = {
  length: `${USERNAME_MIN} à ${USERNAME_MAX} caractères.`,
  characters: 'Lettres (accents admis), chiffres, « . », « _ » et « - » seulement.',
  reserved: 'Ce pseudo est réservé.',
};

/** Nom de repli quand l'appareil garde une file sans nom de propriétaire (jamais en usage normal). */
export const FORMER_ACCOUNT_NAME = "l'ancien compte";

export const INCOMPLETE_CODE_MESSAGE = `Code incomplet : il faut ${SECRET_CODE_LENGTH} caractères.`;

/** Aide du champ du code (maquette A02) : lien ou code, tirets facultatifs (R-INV-5). */
export const CODE_HELP = `Colle le lien reçu, ou tape les ${SECRET_CODE_LENGTH} caractères du code. Les tirets sont facultatifs.`;

const ASK_ADMIN = "Demande un nouveau code à l'administrateur.";
const INVITATION_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  invitation_expired: `Cette invitation a expiré. ${ASK_ADMIN}`,
  invitation_used: `Cette invitation a déjà été utilisée. ${ASK_ADMIN}`,
  invitation_revoked: `Cette invitation a été révoquée. ${ASK_ADMIN}`,
  invitation_unknown: `Ce code est inconnu. ${ASK_ADMIN}`,
  rate_limited: "Trop d'essais depuis cet appareil.",
};

/** Message d'une erreur de l'API sur un code d'invitation (R-INV-8) ; les autres codes gardent le message commun. */
export function invitationErrorMessage(code: ApiErrorCode): string {
  return INVITATION_MESSAGES[code] ?? ERROR_MESSAGES[code];
}

export const RESET_INVALID_MESSAGE =
  "Ce lien n'est plus valable. Demande un nouveau lien à l'administrateur.";

const isKey = <T extends object>(record: T, key: unknown): key is keyof T =>
  typeof key === 'string' && Object.hasOwn(record, key);

/**
 * Erreur d'un parcours d'arrivée (invitation, création du compte, réinitialisation) : motif lu
 * dans `body.reason` pour `password_rejected` et `username_invalid`, `role` fixant le minimum.
 */
export function accessErrorMessage(e: unknown, role: Role): string {
  if (!(e instanceof ApiError)) return errorMessage(e);
  const reason = e.body.reason;
  if (e.code === 'password_rejected' && isKey(PASSWORD_MESSAGES, reason))
    return passwordMessage(reason, role);
  if (e.code === 'username_invalid' && isKey(USERNAME_MESSAGES, reason)) return USERNAME_MESSAGES[reason];
  if (e.code === 'reset_invalid') return RESET_INVALID_MESSAGE;
  return invitationErrorMessage(e.code);
}

/** Refus rattachés aux champs d'un compte : pseudo, mot de passe ou confirmation. */
export type AccountFieldErrors = NewPasswordErrors & { username?: string };

/**
 * Refus du serveur propre à un champ, à rattacher à ce champ comme un refus local (spec refonte §6) :
 * `password_rejected` sous le mot de passe, `username_taken` et `username_invalid` sous le pseudo, avec le
 * message d'`accessErrorMessage`. Null pour les autres erreurs (réseau, invitation, lien), qui restent en alerte.
 */
export function accessFieldError(e: unknown, role: Role): AccountFieldErrors | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code === 'password_rejected') return { password: accessErrorMessage(e, role) };
  if (e.code === 'username_taken' || e.code === 'username_invalid')
    return { username: accessErrorMessage(e, role) };
  return null;
}

/** Connexion : `rate_limited` annonce l'attente en minutes, arrondie au supérieur (R-AUTH-2). */
export function loginErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === 'rate_limited') {
    const seconds = e.body.retryAfterS;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds))
      return 'Trop de tentatives. Réessaie plus tard.';
    return `Trop de tentatives. Réessaie dans ${Math.max(1, Math.ceil(seconds / 60))} min.`;
  }
  return errorMessage(e);
}

/** Avertissement avant d'effacer la file d'envoi de l'appareil (R-AUTH-8, R-AUTH-9, P-AUT-6). */
export function pendingWarning(n: number, username: string): string {
  return n === 1
    ? `1 élément non envoyé de ${username} sera effacé de cet appareil`
    : `${n} éléments non envoyés de ${username} seront effacés de cet appareil`;
}

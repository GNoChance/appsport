import { describe, expect, it } from 'vitest';
import { ApiError, NetworkRequiredError } from '../../src/api/client';
import { detectPlatform, installHelp, isStandalone } from '../../src/features/auth/install-help';
import {
  accessErrorMessage,
  checkNewPassword,
  INCOMPLETE_CODE_MESSAGE,
  invitationErrorMessage,
  loginErrorMessage,
  PASSWORD_MESSAGES,
  PASSWORD_MISMATCH_MESSAGE,
  passwordMessage,
  pendingWarning,
  USERNAME_MESSAGES,
} from '../../src/features/auth/messages';
import { ANDROID_UA, IPHONE_UA, WINDOWS_UA } from '../support/auth';

describe('pendingWarning (R-AUTH-8, R-AUTH-9)', () => {
  it('singulier et pluriel accordés', () => {
    expect(pendingWarning(1, 'lea')).toBe('1 élément non envoyé de lea sera effacé de cet appareil');
    expect(pendingWarning(2, 'lea')).toBe('2 éléments non envoyés de lea seront effacés de cet appareil');
  });
});

describe('plateforme et mode installé (R-ARR-2)', () => {
  it('detectPlatform', () => {
    expect(detectPlatform(IPHONE_UA)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
    expect(detectPlatform(ANDROID_UA)).toBe('android');
    expect(detectPlatform(WINDOWS_UA)).toBe('other');
    expect(detectPlatform('')).toBe('other');
  });

  it("installHelp : une consigne par système, les deux sinon (texte d'origine)", () => {
    expect(installHelp('ios')).toEqual([
      "Sur iPhone : touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite appsport depuis l'écran d'accueil et colle le code.",
    ]);
    expect(installHelp('android')).toEqual([
      "Sur Android : ouvre le menu ⋮ puis « Installer l'application ».",
    ]);
    expect(installHelp('other')).toHaveLength(2);
  });

  const win = (standalone: boolean | undefined, displayMode: boolean) =>
    ({
      matchMedia: (q: string) => ({ matches: displayMode && q === '(display-mode: standalone)' }),
      navigator: { standalone },
    }) as unknown as Window;

  it('isStandalone : display-mode ou navigator.standalone (iOS)', () => {
    expect(isStandalone(win(undefined, true))).toBe(true);
    expect(isStandalone(win(true, false))).toBe(true);
    expect(isStandalone(win(false, false))).toBe(false);
    expect(isStandalone(win(undefined, false))).toBe(false);
  });

  it('isStandalone : sans matchMedia, seul navigator.standalone compte', () => {
    expect(isStandalone({ navigator: { standalone: true } } as unknown as Window)).toBe(true);
    expect(isStandalone({ navigator: {} } as unknown as Window)).toBe(false);
  });
});

describe('mots de passe (R-MDP-1, R-MDP-3)', () => {
  it('passwordMessage : le minimum suit le rôle', () => {
    expect(passwordMessage('too_short', 'admin')).toBe('14 caractères au moins.');
    expect(passwordMessage('too_short', 'member')).toBe('12 caractères au moins.');
    expect(passwordMessage('contains_username', 'admin')).toBe(PASSWORD_MESSAGES.contains_username);
  });

  it('un message par motif de rejet', () => {
    expect(Object.keys(PASSWORD_MESSAGES).sort()).toEqual([
      'common',
      'contains_appsport',
      'contains_username',
      'single_char',
      'too_long',
      'too_short',
    ]);
    for (const text of Object.values(PASSWORD_MESSAGES)) expect(text).not.toBe('');
  });

  const base = {
    password: 'cheval agrafe batterie correcte',
    confirm: '',
    username: 'lea',
    role: 'member',
  } as const;

  it('checkNewPassword : un seul caractère répété', () => {
    expect(
      checkNewPassword({
        password: 'a'.repeat(12),
        confirm: 'a'.repeat(12),
        username: 'lea',
        role: 'member',
      }),
    ).toBe(PASSWORD_MESSAGES.single_char);
  });

  it('checkNewPassword : longueur selon le rôle, avant la confirmation', () => {
    expect(checkNewPassword({ ...base, password: 'a1b2c3d4e5f', confirm: '' })).toBe(
      '12 caractères au moins.',
    );
    const thirteen = 'abcdefghijklm';
    expect(checkNewPassword({ ...base, password: thirteen, confirm: thirteen, role: 'admin' })).toBe(
      '14 caractères au moins.',
    );
    expect(checkNewPassword({ ...base, password: thirteen, confirm: thirteen })).toBeNull();
  });

  it('checkNewPassword : pseudo contenu, confirmation différente, tout bon', () => {
    expect(checkNewPassword({ ...base, password: 'bonjour lea 12345', confirm: 'bonjour lea 12345' })).toBe(
      PASSWORD_MESSAGES.contains_username,
    );
    expect(checkNewPassword({ ...base, confirm: 'cheval agrafe batterie' })).toBe(PASSWORD_MISMATCH_MESSAGE);
    expect(PASSWORD_MISMATCH_MESSAGE).toBe('Les deux mots de passe ne correspondent pas.');
    expect(checkNewPassword({ ...base, confirm: base.password })).toBeNull();
  });

  it('checkNewPassword : pseudo encore vide : aucun rejet sur le pseudo', () => {
    expect(checkNewPassword({ ...base, username: '', confirm: base.password })).toBeNull();
  });
});

describe('pseudo (R-CPT-3)', () => {
  it('un message par motif', () => {
    expect(USERNAME_MESSAGES).toEqual({
      length: '3 à 24 caractères.',
      characters: 'Lettres (accents admis), chiffres, « . », « _ » et « - » seulement.',
      reserved: 'Ce pseudo est réservé.',
    });
  });
});

describe('codes (R-INV-8, R-RST-1)', () => {
  it("invitationErrorMessage : cause puis « Demande un nouveau code à l'administrateur. »", () => {
    const ask = " Demande un nouveau code à l'administrateur.";
    expect(invitationErrorMessage('invitation_expired')).toBe(`Cette invitation a expiré.${ask}`);
    expect(invitationErrorMessage('invitation_used')).toBe(`Cette invitation a déjà été utilisée.${ask}`);
    expect(invitationErrorMessage('invitation_revoked')).toBe(`Cette invitation a été révoquée.${ask}`);
    expect(invitationErrorMessage('invitation_unknown')).toBe(`Ce code est inconnu.${ask}`);
    expect(invitationErrorMessage('rate_limited')).toBe("Trop d'essais depuis cet appareil.");
    expect(invitationErrorMessage('internal')).toBe('Le serveur a rencontré une erreur.');
  });

  it('code illisible', () => {
    expect(INCOMPLETE_CODE_MESSAGE).toBe('Code incomplet : il faut 16 caractères.');
  });

  it('accessErrorMessage : motif du corps, rôle, lien de réinitialisation, réseau', () => {
    const api = (status: number, error: string, extra: object = {}) =>
      new ApiError(status, error as ApiError['code'], { error, ...extra });
    expect(accessErrorMessage(api(400, 'password_rejected', { reason: 'too_short' }), 'admin')).toBe(
      '14 caractères au moins.',
    );
    expect(accessErrorMessage(api(400, 'password_rejected', { reason: 'common' }), 'member')).toBe(
      PASSWORD_MESSAGES.common,
    );
    expect(accessErrorMessage(api(400, 'password_rejected', { reason: '???' }), 'member')).toBe(
      'Ce mot de passe ne convient pas.',
    );
    expect(accessErrorMessage(api(400, 'username_invalid', { reason: 'reserved' }), 'member')).toBe(
      USERNAME_MESSAGES.reserved,
    );
    expect(accessErrorMessage(api(400, 'username_invalid'), 'member')).toBe("Ce pseudo n'est pas valide.");
    expect(accessErrorMessage(api(409, 'username_taken'), 'member')).toBe('Ce pseudo est déjà pris.');
    expect(accessErrorMessage(api(400, 'reset_invalid'), 'member')).toBe(
      "Ce lien n'est plus valable. Demande un nouveau lien à l'administrateur.",
    );
    expect(accessErrorMessage(api(429, 'rate_limited', { retryAfterS: 30 }), 'member')).toBe(
      "Trop d'essais depuis cet appareil.",
    );
    expect(accessErrorMessage(new NetworkRequiredError(), 'member')).toBe('Nécessite le réseau');
    expect(accessErrorMessage(new Error('boom'), 'member')).toBe('Une erreur inattendue est survenue.');
  });
});

describe('connexion (R-AUTH-1, R-AUTH-2, R-AUTH-5)', () => {
  const api = (status: number, error: string, extra: object = {}) =>
    new ApiError(status, error as ApiError['code'], { error, ...extra });

  it('429 : minutes arrondies au supérieur, au moins une', () => {
    const wait = (s: number) => loginErrorMessage(api(429, 'rate_limited', { retryAfterS: s }));
    expect(wait(61)).toBe('Trop de tentatives. Réessaie dans 2 min.');
    expect(wait(60)).toBe('Trop de tentatives. Réessaie dans 1 min.');
    expect(wait(1)).toBe('Trop de tentatives. Réessaie dans 1 min.');
    expect(wait(0)).toBe('Trop de tentatives. Réessaie dans 1 min.');
    expect(wait(3600)).toBe('Trop de tentatives. Réessaie dans 60 min.');
  });

  it('429 sans durée lisible', () => {
    expect(loginErrorMessage(api(429, 'rate_limited'))).toBe('Trop de tentatives. Réessaie plus tard.');
    expect(loginErrorMessage(api(429, 'rate_limited', { retryAfterS: 'bientôt' }))).toBe(
      'Trop de tentatives. Réessaie plus tard.',
    );
  });

  it('autres erreurs : messages communs', () => {
    expect(loginErrorMessage(api(401, 'invalid_credentials'))).toBe('Pseudo ou mot de passe incorrect');
    expect(loginErrorMessage(api(403, 'account_disabled'))).toBe(
      "Compte désactivé, contacte l'administrateur",
    );
    expect(loginErrorMessage(new NetworkRequiredError())).toBe('Nécessite le réseau');
  });
});

import type { Role } from '@appsport/contracts';
import { Field } from '../../ui';

export const PASSWORD_HINT =
  'Astuce : une phrase de 4 mots ou plus, par exemple « cheval agrafe batterie correcte », est facile à retenir et solide. Les espaces sont acceptés.';

/**
 * Mot de passe et confirmation (R-MDP-2). Les règles se contrôlent à l'envoi, par le formulaire
 * (`checkNewPassword` avec le même `username` et le même `role`) : un seul message à la fois,
 * pas d'erreur en double. `errors` : message lié au champ en cause (aria-invalid, description).
 */
export function PasswordFields(p: {
  username: string;
  role: Role;
  password: string;
  confirm: string;
  onChange(v: { password: string; confirm: string }): void;
  label?: string;
  errors?: { password?: string | null; confirm?: string | null };
}) {
  return (
    <>
      <Field label={p.label ?? 'Mot de passe'} hint={PASSWORD_HINT} error={p.errors?.password}>
        <input
          type="password"
          autoComplete="new-password"
          value={p.password}
          onChange={(e) => p.onChange({ password: e.target.value, confirm: p.confirm })}
        />
      </Field>
      <Field label="Confirmation" error={p.errors?.confirm}>
        <input
          type="password"
          autoComplete="new-password"
          value={p.confirm}
          onChange={(e) => p.onChange({ password: p.password, confirm: e.target.value })}
        />
      </Field>
    </>
  );
}

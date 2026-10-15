import styles from './places.module.css';

const TONES = ['accent-2', 'success', 'accent'] as const;

/** Teinte d'un pseudo, toujours la même pour lui d'un écran à l'autre. */
function toneOf(name: string): (typeof TONES)[number] {
  let sum = 0;
  for (const char of name) sum += char.codePointAt(0) ?? 0;
  return TONES[sum % TONES.length] ?? 'accent';
}

/**
 * « Qui va à cette salle » en une phrase (R-VIS-1) : les pseudos visibles, l'utilisateur en « toi » à la
 * fin quand il est visible lui-même. « max et toi », « max, nora et sam », « Toi ».
 */
export function membersText(members: readonly string[], me: string | null): string {
  const withMe = me !== null && members.includes(me);
  const others = members.filter((m) => m !== me);
  if (others.length === 0) return withMe ? 'Toi' : '';
  const names = withMe ? [...others, 'toi'] : others;
  const last = names.at(-1) ?? '';
  return names.length === 1 ? last : `${names.slice(0, -1).join(', ')} et ${last}`;
}

/** Les autres d'abord, l'utilisateur en dernier : l'ordre de la phrase, pour les initiales. */
export function membersOrder(members: readonly string[], me: string | null): string[] {
  return [...members.filter((m) => m !== me), ...members.filter((m) => m === me)];
}

/** Rond de l'initiale d'un pseudo, décoratif (le pseudo est écrit à côté). */
export function MemberAvatar(p: { name: string; size?: 'tiny' | 'small' | 'medium' }) {
  return (
    <span
      className={styles.avatar}
      data-size={p.size ?? 'small'}
      data-tone={toneOf(p.name)}
      aria-hidden="true"
    >
      {p.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Jusqu'à trois initiales qui se chevauchent. */
export function MemberAvatars(p: { names: readonly string[]; size?: 'small' | 'medium' }) {
  if (p.names.length === 0) return null;
  return (
    <span className={styles.avatars} aria-hidden="true">
      {p.names.slice(0, 3).map((name) => (
        <MemberAvatar key={name} name={name} size={p.size} />
      ))}
    </span>
  );
}

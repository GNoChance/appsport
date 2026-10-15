import type { ComponentProps } from 'react';
import styles from './ui.module.css';

/**
 * Bouton de 52 px : principal, secondaire (contour accent), discret ou danger (contour danger) ;
 * `block` : pleine largeur. Une action dangereuse reste isolée en bas, jamais à côté d'un principal.
 * `ref` va au bouton lui-même (React 19), pour lui rendre le focus.
 */
export function Button({
  variant = 'primary',
  block = false,
  className,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
}) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], block ? styles.block : null, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

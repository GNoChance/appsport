import type { OnboardingStep, TrainingProfilePatch } from '@rune/contracts';
import { type RefObject, useEffect, useRef } from 'react';
import { type Repos, useRepos } from '../../repos';
import { Banner, Button, useAction } from '../../ui';
import { useFocusAboveBar } from '../../ui/TabBar';
import styles from './onboarding.module.css';

/** Écran partagé par l'onboarding et le Profil (R-ONB-3). */
export interface StepProps {
  mode: 'onboarding' | 'edit';
  onNext(): void;
  onBack?: () => void;
}

/** Bouton d'avancée de l'onboarding (spec refonte §10.1), aussi celui d'un écran qui en ouvre un autre. */
export const CONTINUE_LABEL = 'Continuer';

/** Bouton qui enregistre l'écran : « Continuer » pendant l'onboarding, « Enregistrer » dans le Profil. */
export const saveLabel = (mode: StepProps['mode']) =>
  mode === 'onboarding' ? CONTINUE_LABEL : 'Enregistrer';

/**
 * Enregistrement d'un écran au clic (R-ONB-2) : PATCH du profil, avec `onboardingStep` pendant
 * l'onboarding (rien n'est envoyé en édition si rien n'a changé), puis `onNext`.
 */
export async function saveStep(
  repos: Repos,
  p: StepProps,
  step: OnboardingStep,
  patch: TrainingProfilePatch = {},
): Promise<void> {
  const body = p.mode === 'onboarding' ? { ...patch, onboardingStep: step } : patch;
  if (Object.keys(body).length > 0) await repos.profile.update(body);
  p.onNext();
}

/** `saveStep` en action d'écran (en cours, erreur traduite). */
export function useSaveStep(p: StepProps, step: OnboardingStep) {
  const repos = useRepos();
  return useAction((patch: TrainingProfilePatch = {}) => saveStep(repos, p, step, patch));
}

/**
 * Barre collée de l'onboarding : sa hauteur réelle, erreur comprise (84 px sans erreur, près du double avec une
 * erreur de deux lignes), devient `--onb-bar` sur la page, que lit scroll-padding-bottom (onboarding.module.css) :
 * un champ qui prend le focus finit au-dessus d'elle (WCAG 2.2, 2.4.11). Écrite par le CSSOM, que la CSP laisse
 * passer, et retirée au démontage. Hors de l'onboarding (Profil), la barre n'est pas collée : rien n'est écrit.
 */
function useBarHeight(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = bar.current;
    if (!el || !styles.flow || !el.closest(`.${CSS.escape(styles.flow)}`)) return;
    if (typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--onb-bar', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--onb-bar');
    };
  }, [bar]);
}

/**
 * Barre d'actions des maquettes B01–B08 : l'erreur de l'écran, puis « Retour » (118 px, contour) à gauche du
 * bouton principal, qui prend le reste de la largeur ; seul, le principal prend toute la largeur. Dans
 * l'onboarding, la barre reste collée en bas de l'écran, erreur comprise (onboarding.module.css) ; le focus ne
 * finit jamais dessous : marge de défilement à sa hauteur réelle, et défilement au plus près quand WebKit
 * l'ignore pour focus() (`useFocusAboveBar`, comme la barre d'onglets).
 * `className` : décor de la barre (apparition de « Commencer » sur « Éveil terminé »), `primary.className` :
 * celui du bouton principal.
 */
export function StepActions(p: {
  onBack?: () => void;
  primary?: { label: string; disabled?: boolean; onClick(): void; className?: string };
  pending?: boolean;
  error?: string | null;
  className?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useBarHeight(bar);
  useFocusAboveBar(bar);
  return (
    <div ref={bar} className={[styles.bar, p.className].filter(Boolean).join(' ')}>
      {p.error ? <Banner tone="error">{p.error}</Banner> : null}
      <div className={styles.actions}>
        {p.onBack ? (
          <Button variant="secondary" className={styles.back} onClick={p.onBack} disabled={p.pending}>
            Retour
          </Button>
        ) : null}
        {p.primary ? (
          <Button
            className={[styles.primary, p.primary.className].filter(Boolean).join(' ')}
            onClick={p.primary.onClick}
            disabled={p.primary.disabled || p.pending}
          >
            {p.primary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

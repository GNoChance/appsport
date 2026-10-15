import type { OnboardingStep, TrainingProfilePatch } from '@rune/contracts';
import { type Repos, useRepos } from '../../repos';
import { Banner, Button, useAction } from '../../ui';
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
 * Erreur de l'écran, puis la barre d'actions des maquettes B01–B08 : « Retour » (118 px, contour) à gauche du
 * bouton principal, qui prend le reste de la largeur ; seul, le principal prend toute la largeur.
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
  return (
    <>
      {p.error ? <Banner tone="error">{p.error}</Banner> : null}
      <div className={[styles.actions, p.className].filter(Boolean).join(' ')}>
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
    </>
  );
}

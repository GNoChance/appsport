import type { OnboardingStep, TrainingProfilePatch } from '@appsport/contracts';
import { type Repos, useRepos } from '../../repos';
import { Banner, Button, useAction } from '../../ui';
import styles from './onboarding.module.css';

/** Écran partagé par l'onboarding et le Profil (R-ONB-3). */
export interface StepProps {
  mode: 'onboarding' | 'edit';
  onNext(): void;
  onBack?: () => void;
}

/** Bouton qui enregistre l'écran : « Suivant » pendant l'onboarding, « Enregistrer » dans le Profil. */
export const saveLabel = (mode: StepProps['mode']) => (mode === 'onboarding' ? 'Suivant' : 'Enregistrer');

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

/** Erreur de l'écran, « Retour » et bouton principal. */
export function StepActions(p: {
  onBack?: () => void;
  primary?: { label: string; disabled?: boolean; onClick(): void };
  pending?: boolean;
  error?: string | null;
}) {
  return (
    <>
      {p.error ? <Banner tone="error">{p.error}</Banner> : null}
      <div className={styles.actions}>
        {p.onBack ? (
          <Button variant="secondary" onClick={p.onBack} disabled={p.pending}>
            Retour
          </Button>
        ) : null}
        {p.primary ? (
          <Button onClick={p.primary.onClick} disabled={p.primary.disabled || p.pending}>
            {p.primary.label}
          </Button>
        ) : null}
      </div>
    </>
  );
}

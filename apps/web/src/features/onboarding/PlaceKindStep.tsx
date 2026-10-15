import type { PlaceKind } from '@rune/contracts';
import { ChoiceCard, ChoiceGroup } from '../../ui';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { InfoGlyph, PLACE_KIND_ICONS } from './StepIcons';
import { StepTitle } from './StepTitle';

/** Les deux types de lieu (maquette B03) : titre, et ce que l'écran suivant demandera. */
const KINDS: readonly { kind: PlaceKind; title: string; description: string }[] = [
  { kind: 'gym', title: 'À la salle', description: "Tu choisiras ta salle à l'étape suivante." },
  { kind: 'home', title: 'À la maison', description: "Tu indiqueras ton matériel à l'étape suivante." },
];

/** Où se gèrent les lieux après l'onboarding (Profil › Mes lieux, spec refonte §5). */
export const PLACES_LATER_NOTE = 'Tu pourras ajouter ou changer de lieu dans Profil › Mes lieux.';

/**
 * E3 Lieu principal (maquette B03 : deux cartes avec icône et description). Le type n'est pas stocké (c'est
 * celui du lieu principal, créé à l'écran suivant) : seule l'étape est enregistrée.
 */
export function PlaceKindStep(p: StepProps & { value: PlaceKind | null; onChange(k: PlaceKind): void }) {
  const save = useSaveStep(p, 'place_kind');
  return (
    <>
      <StepTitle>Lieu principal</StepTitle>
      <div className={styles.question}>
        <ChoiceGroup legend="Où t'entraîneras-tu le plus souvent ?">
          {KINDS.map((k) => (
            <ChoiceCard
              key={k.kind}
              type="radio"
              name="place-kind"
              value={k.kind}
              checked={p.value === k.kind}
              onChange={() => p.onChange(k.kind)}
              title={k.title}
              description={k.description}
              icon={PLACE_KIND_ICONS[k.kind]}
            />
          ))}
        </ChoiceGroup>
      </div>
      <p className={styles.infoNote}>
        <InfoGlyph />
        <span>{PLACES_LATER_NOTE}</span>
      </p>
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{ label: saveLabel(p.mode), disabled: p.value === null, onClick: () => void save.run() }}
      />
    </>
  );
}

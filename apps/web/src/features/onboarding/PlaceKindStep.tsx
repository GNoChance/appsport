import type { PlaceKind } from '@appsport/contracts';
import { ChoiceList } from '../../ui';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { StepTitle } from './StepTitle';

/**
 * E3 Lieu principal. Le type n'est pas stocké (c'est celui du lieu principal, créé à l'écran
 * suivant) : seule l'étape est enregistrée.
 */
export function PlaceKindStep(p: StepProps & { value: PlaceKind | null; onChange(k: PlaceKind): void }) {
  const save = useSaveStep(p, 'place_kind');
  return (
    <>
      <StepTitle>Lieu principal</StepTitle>
      <ChoiceList<PlaceKind>
        name="place-kind"
        legend="Où t'entraîneras-tu le plus souvent ?"
        value={p.value}
        onChange={p.onChange}
        options={[
          { value: 'gym', label: 'À la salle' },
          { value: 'home', label: 'À la maison' },
        ]}
      />
      <StepActions
        onBack={p.onBack}
        pending={save.pending}
        error={save.error}
        primary={{ label: saveLabel(p.mode), disabled: p.value === null, onClick: () => void save.run() }}
      />
    </>
  );
}

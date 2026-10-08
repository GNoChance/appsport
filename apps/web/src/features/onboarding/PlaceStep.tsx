import {
  type EquipmentCode,
  HOME_DEFAULT_PRESET,
  HOME_PLACE_DEFAULT_NAME,
  PLACE_NAME_MAX,
  type PlaceKind,
  PRESET_IDS,
  PRESETS,
  type PresetId,
} from '@appsport/contracts';
import { useState } from 'react';
import { useLive, useMe } from '../../app-services';
import { useRepos } from '../../repos';
import { ChoiceList, Field, useAction } from '../../ui';
import { EquipmentChecklist, sortEquipment } from '../places/EquipmentChecklist';
import { GymPicker } from '../places/GymPicker';
import styles from './onboarding.module.css';
import { StepActions, type StepProps, saveLabel, useSaveStep } from './StepActions';
import { StepTitle } from './StepTitle';

const HOME_PRESETS = PRESET_IDS.filter((id) => PRESETS[id].kind === 'home');

/**
 * E4 Ma salle ou Ma maison : l'onboarding crée un seul lieu, principal (02 §8, E3/E4). Un lieu
 * principal déjà là (retour arrière) est affiché sans rien recréer ; les autres lieux se gèrent
 * dans Profil › Lieux.
 */
export function PlaceStep(p: StepProps & { kind: PlaceKind }) {
  const repos = useRepos();
  const me = useMe();
  const places = useLive(() => repos.places.list(), [repos]);
  // Lieu créé par cet écran : un nouvel essai n'envoie plus que l'étape.
  const [created, setCreated] = useState(false);
  const [name, setName] = useState(HOME_PLACE_DEFAULT_NAME);
  const [nameError, setNameError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetId>(HOME_DEFAULT_PRESET);
  const [equipment, setEquipment] = useState<EquipmentCode[]>(() =>
    sortEquipment(PRESETS[HOME_DEFAULT_PRESET].equipment),
  );
  const save = useSaveStep(p, 'place');
  const createHome = useAction(async () => {
    await repos.places.create({ kind: 'home', name: name.trim(), equipment, isPrimary: true });
    setCreated(true);
    await save.run();
  });
  if (!me || places === undefined) return null;

  const primary = places.find((pl) => pl.isPrimary);
  const title = <StepTitle>{(primary?.kind ?? p.kind) === 'gym' ? 'Ma salle' : 'Ma maison'}</StepTitle>;

  if (primary || created) {
    return (
      <>
        {title}
        <p>{primary ? `Ton lieu principal : ${primary.name}` : 'Ton lieu principal est enregistré.'}</p>
        <p className={styles.note}>Tu pourras ajouter ou changer de lieu dans Profil › Lieux.</p>
        <StepActions
          onBack={p.onBack}
          pending={save.pending}
          error={save.error}
          primary={{ label: saveLabel(p.mode), onClick: () => void save.run() }}
        />
      </>
    );
  }

  if (p.kind === 'gym') {
    return (
      <>
        {title}
        <GymPicker
          isPrimary
          defaultVisible={me.ageBand !== 'minor'}
          onDone={() => {
            setCreated(true);
            void save.run();
          }}
        />
        <StepActions onBack={p.onBack} pending={save.pending} error={save.error} />
      </>
    );
  }

  function choosePreset(id: PresetId) {
    setPreset(id);
    setEquipment(sortEquipment(PRESETS[id].equipment));
  }

  function submitHome() {
    if (name.trim() === '') {
      setNameError('Donne un nom à ce lieu.');
      return;
    }
    setNameError(null);
    void createHome.run();
  }

  return (
    <>
      {title}
      <Field label="Nom du lieu" error={nameError}>
        <input
          type="text"
          maxLength={PLACE_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <ChoiceList<PresetId>
        name="home-preset"
        legend="Ton matériel"
        value={preset}
        onChange={choosePreset}
        options={HOME_PRESETS.map((id) => ({ value: id, label: PRESETS[id].label }))}
      />
      <EquipmentChecklist kind="home" value={equipment} onChange={setEquipment} />
      <StepActions
        onBack={p.onBack}
        pending={createHome.pending || save.pending}
        error={createHome.error ?? save.error}
        primary={{ label: saveLabel(p.mode), onClick: submitHome }}
      />
    </>
  );
}

import {
  type EquipmentCode,
  HOME_DEFAULT_PRESET,
  HOME_PLACE_DEFAULT_NAME,
  PLACE_NAME_MAX,
  PRESET_IDS,
  PRESETS,
  type PresetId,
} from '@rune/contracts';
import { useState } from 'react';
import { useRepos } from '../../repos';
import { Banner, Button, ChoiceList, Field, useAction } from '../../ui';
import { EquipmentChecklist, sortEquipment } from './EquipmentChecklist';
import { NAME_REQUIRED } from './PlaceActions';
import styles from './places.module.css';
import { useSubScreenBusy } from './SubScreen';

const HOME_PRESETS = PRESET_IDS.filter((id) => PRESETS[id].kind === 'home');

/**
 * Ajout d'une maison (R-LIEU-3) : nom (« Maison » par défaut), préréglage, puis la liste pré-cochée. Le lieu
 * est créé, non principal, puis `onDone` ; Retour attend la fin de l'envoi.
 */
export function HomeCreate(p: { onDone(): void }) {
  const repos = useRepos();
  const [name, setName] = useState(HOME_PLACE_DEFAULT_NAME);
  const [nameError, setNameError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetId>(HOME_DEFAULT_PRESET);
  const [equipment, setEquipment] = useState<EquipmentCode[]>(() =>
    sortEquipment(PRESETS[HOME_DEFAULT_PRESET].equipment),
  );
  const create = useAction(async () => {
    await repos.places.create({ kind: 'home', name: name.trim(), equipment, isPrimary: false });
    p.onDone();
  });
  useSubScreenBusy(create.pending);

  function choosePreset(id: PresetId) {
    setPreset(id);
    setEquipment(sortEquipment(PRESETS[id].equipment));
  }

  function submit() {
    if (name.trim() === '') {
      setNameError(NAME_REQUIRED);
      return;
    }
    setNameError(null);
    void create.run();
  }

  return (
    <div className={styles.form}>
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
      {create.error ? <Banner tone="error">{create.error}</Banner> : null}
      <Button block onClick={submit} disabled={create.pending}>
        Ajouter la maison
      </Button>
    </div>
  );
}

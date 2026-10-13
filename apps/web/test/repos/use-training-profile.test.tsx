import { screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import { useTrainingProfile } from '../../src/repos/use-training-profile';
import { renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';

function Probe() {
  const { loaded, profile, coach } = useTrainingProfile();
  return <p>{loaded ? `${profile?.goal ?? 'sans profil'} / ${coach ?? 'sans coach'}` : 'lecture'}</p>;
}

describe('useTrainingProfile', () => {
  it('suit le miroir : sans profil, puis sans coach, puis le coach choisi', async () => {
    const { db } = await renderWithServices(<Probe />);
    await screen.findByText('sans profil / sans coach');
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', coach: null }]);
    await screen.findByText('muscle / sans coach');
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', coach: 'skald' }]);
    await screen.findByText('muscle / skald');
  });
});

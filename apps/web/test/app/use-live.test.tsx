import { screen } from '@testing-library/react';
import { describe, it } from 'vitest';
import { useLive } from '../../src/app-services';
import { useRepos } from '../../src/repos';
import { renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';

/** Requêtes de dépôt (fonctions non async qui rendent la promesse d'un `await` imbriqué). */
function Counts() {
  const repos = useRepos();
  const limitations = useLive(() => repos.consent.limitations(), [repos]);
  const places = useLive(() => repos.places.list(), [repos]);
  const profile = useLive(() => repos.profile.get(), [repos]);
  return <p>{`${limitations?.length ?? '-'} ${places?.length ?? '-'} ${profile?.goal ?? '-'}`}</p>;
}

describe('useLive', () => {
  it('une écriture de miroir après un await natif relance la requête du dépôt', async () => {
    const { db } = await renderWithServices(<Counts />);
    await screen.findByText('0 0 -');
    await seedMirror(db, 'limitation', [
      {
        id: 'l-1',
        ownerId: 'u-1',
        bodyArea: 'knee',
        side: 'left',
        severity: 'mild',
        note: null,
        active: true,
      },
    ]);
    await seedMirror(db, 'place', [
      { id: 'p-1', ownerId: 'u-1', kind: 'home', gymId: null, name: 'Maison', isPrimary: true },
    ]);
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle' }]);
    await screen.findByText('1 1 muscle');
  });
});

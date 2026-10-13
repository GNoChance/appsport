import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '../../src/app-services';
import { reposFor, type TrainingProfileView } from '../../src/repos';
import { useTrainingProfile } from '../../src/repos/use-training-profile';
import { createFakeSyncEngine } from '../support/fake-api';
import { createTestServices, renderWithServices } from '../support/render';
import { seedMirror } from '../support/seed';

function Probe() {
  const { loaded, known, profile, coach } = useTrainingProfile();
  const read = loaded ? 'lu' : 'lecture';
  const pulled = known ? 'connu' : 'inconnu';
  return <p>{`${read} · ${pulled} · ${profile?.goal ?? 'sans profil'} / ${coach ?? 'sans coach'}`}</p>;
}

const VIEW: TrainingProfileView = {
  goal: 'muscle',
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  sportCode: null,
  sportOtherLabel: null,
  cautiousMode: false,
  coach: 'skald',
};

describe('useTrainingProfile', () => {
  it("rien n'est lu tant que le miroir n'a pas répondu, puis le profil lu", async () => {
    const { services } = await createTestServices();
    let answer: (v: TrainingProfileView | null) => void = () => {};
    const pending = new Promise<TrainingProfileView | null>((resolve) => {
      answer = resolve;
    });
    const get = vi.spyOn(reposFor(services).profile, 'get').mockReturnValueOnce(pending);

    render(
      <ServicesProvider services={services}>
        <Probe />
      </ServicesProvider>,
    );
    // Lecture du miroir demandée, réponse pas encore arrivée.
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.getByText('lecture · inconnu · sans profil / sans coach')).toBeTruthy();

    await act(async () => answer(VIEW));
    await screen.findByText('lu · connu · muscle / skald');
  });

  it('suit le miroir : sans profil, puis sans coach, puis le coach choisi', async () => {
    const sync = createFakeSyncEngine({ lastPullOkAt: '2026-10-06T11:59:00.000Z' });
    const { db } = await renderWithServices(<Probe />, { sync });
    await screen.findByText('lu · connu · sans profil / sans coach');
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', coach: null }]);
    await screen.findByText('lu · connu · muscle / sans coach');
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', coach: 'skald' }]);
    await screen.findByText('lu · connu · muscle / skald');
  });

  it('miroir vide avant le premier pull (nouvel appareil) : coach inconnu, connu après le pull', async () => {
    const sync = createFakeSyncEngine({ lastPullOkAt: null });
    await renderWithServices(<Probe />, { sync });
    await screen.findByText('lu · inconnu · sans profil / sans coach');
    act(() => sync.set({ lastPullOkAt: '2026-10-06T12:00:00.000Z' }));
    await screen.findByText('lu · connu · sans profil / sans coach');
  });

  it("un profil du miroir vient d'un pull : connu même avant que le moteur ait relu meta", async () => {
    const sync = createFakeSyncEngine({ lastPullOkAt: null });
    const { db } = await renderWithServices(<Probe />, { sync });
    await screen.findByText('lu · inconnu · sans profil / sans coach');
    await seedMirror(db, 'training_profile', [{ id: 'u-1', ownerId: 'u-1', goal: 'muscle', coach: null }]);
    await screen.findByText('lu · connu · muscle / sans coach');
  });
});

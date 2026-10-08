import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMe, whenSignedOut } from '../../src/app-services';
import { setMeta } from '../../src/local-db/meta';
import { wipeUserData } from '../../src/local-db/wipe';
import { settle } from '../support/auth';
import { createTestLocalDb } from '../support/local-db';
import { makeMe, renderWithServices } from '../support/render';

function Who() {
  const me = useMe();
  return <p>{me?.username ?? 'personne'}</p>;
}

describe('whenSignedOut', () => {
  it('personne n’observe meta.me : résolu tout de suite', async () => {
    const db = createTestLocalDb();
    await setMeta(db, 'me', makeMe());
    await expect(whenSignedOut(db, 10_000)).resolves.toBeUndefined();
  });

  it('observé : résolu quand la requête ne voit plus l’utilisateur, après l’effacement', async () => {
    const { db } = await renderWithServices(<Who />);
    await screen.findByText('lea');
    let resolved = false;
    const waiting = whenSignedOut(db, 10_000).then(() => {
      resolved = true;
    });
    await settle();
    expect(resolved).toBe(false);
    await wipeUserData(db, { keepOutbox: false });
    await waiting;
    expect(screen.getByText('personne')).toBeTruthy();
  });

  it('observé et jamais effacé : résolu au bout du délai', async () => {
    const { db } = await renderWithServices(<Who />);
    await screen.findByText('lea');
    await expect(whenSignedOut(db, 20)).resolves.toBeUndefined();
    expect(screen.getByText('lea')).toBeTruthy();
  });
});

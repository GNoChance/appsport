import { expect, test } from './support/fixtures';

// Spec refonte §7 (le logo se dessine au démarrage) : le voile se pose par-dessus l'écran sans jamais le
// retarder ni prendre le toucher, puis se retire. Navigateur réel : toBeVisible ignore ce qui recouvre un
// élément, d'où le test de toucher au centre du bouton.

test('démarrage : le voile laisse toucher l’écran dessous, puis se retire', async ({ server, page }) => {
  // Dès la réponse : le voile ne dure qu'une seconde et demie, l'événement `load` peut venir après.
  await page.goto(`${server.url}/login`, { waitUntil: 'commit' });

  await test.step('voile monté : le centre du bouton « Se connecter » touche le bouton', async () => {
    // Premier affichage de la session : le voile est posé dès le premier rendu.
    await expect(page.getByTestId('boot-splash')).toBeAttached();
    const hit = await page.waitForFunction(
      () => {
        const veil = document.querySelector('[data-testid="boot-splash"]');
        const button = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'Se connecter',
        );
        if (!veil) return { veil: false, hitsButton: false };
        if (!button) return null;
        const box = button.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { veil: true, hitsButton: top !== null && button.contains(top) };
      },
      undefined,
      { polling: 'raf' },
    );
    // `veil: false` : le voile a disparu (ou n'a jamais été monté) avant que le bouton s'affiche.
    expect(await hit.jsonValue()).toEqual({ veil: true, hitsButton: true });
  });

  await test.step('puis retiré du document en moins de 2,5 s', async () => {
    await expect(page.getByTestId('boot-splash')).toHaveCount(0, { timeout: 2500 });
  });
});

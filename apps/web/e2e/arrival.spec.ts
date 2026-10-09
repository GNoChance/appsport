import type { Locator, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { completeOnboardingViaUi, createAccountViaUi } from './support/flows';
import {
  emulateStandalone,
  idbPut,
  metaValue,
  requireServiceWorker,
  swStatus,
  waitForController,
} from './support/pwa';
import { bootstrapAdmin } from './support/server';

/** Valeur témoin de meta.persistGranted : seule une nouvelle demande de stockage persistant la remplace. */
const PERSIST_SENTINEL = 'témoin e2e';

/**
 * Paysage (WCAG 2.1 SC 1.3.4) : ni la page ni un conteneur ne défile à l'horizontale, et l'action principale
 * tient entière dans la largeur, mesurée sur place (sans la faire défiler jusqu'à la vue).
 */
async function expectUsableInLandscape(page: Page, action: Locator): Promise<void> {
  // Largeur de l'appareil, pas `innerWidth` : en émulation mobile, Chromium élargit la vue de mise en page
  // au contenu qui déborde.
  const width = page.viewportSize()?.width ?? 0;
  const scrollWidth = await page.evaluate(
    () => (document.scrollingElement ?? document.documentElement).scrollWidth,
  );
  expect(scrollWidth, 'largeur du document').toBeLessThanOrEqual(width);
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  const box = await action.boundingBox();
  if (!box) throw new Error('action principale sans boîte en paysage');
  expect(box.x, "bord gauche de l'action").toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, "bord droit de l'action").toBeLessThanOrEqual(width);
  // Un conteneur déjà décalé (par la saisie, par exemple) masquerait un défilement horizontal imposé.
  const shifted = await action.evaluate((el) => {
    const out = window.scrollX === 0 ? [] : [`window: ${window.scrollX}`];
    for (let node = el.parentElement; node; node = node.parentElement)
      if (node.scrollLeft !== 0) out.push(`${node.tagName.toLowerCase()}: ${node.scrollLeft}`);
    return out;
  });
  expect(shifted, "ancêtres de l'action défilés à l'horizontale").toEqual([]);
}

// 01 §9.1.6 scénario 1 (sans séance, brique 3) ; 02 §3 (R-ARR-1, R-INV-4, R-INV-5, R-CPT-2), §8 E8 ;
// R-SYN-31, R-SYN-33 ; Review Focus 5 (cookie et Origin sous WebKit).
test('arrivée : admin installé, session protégée, puis un membre invité par code', async ({
  server,
  context,
  page,
  newContext,
  browserName,
}) => {
  await test.step("admin : lien d'amorçage dans l'appli installée, compte puis onboarding", async () => {
    await emulateStandalone(context);
    const { link } = await bootstrapAdmin(server);
    await page.goto(link);
    await requireServiceWorker(page);
    // R-INV-4 : le fragment qui porte le code quitte l'adresse dès la lecture.
    await expect(page).toHaveURL(`${server.url}/invite`);
    // R-ARR-1 : dans l'appli installée, le lien mène directement à la création du compte.
    await createAccountViaUi(page, 'camille');
    await expect(page.getByTestId('onboarding-step')).toHaveAttribute('data-step', 'goal');
    // R-CPT-2 : stockage persistant demandé à la création du compte, résultat noté (accordé ou non).
    await expect.poll(async () => typeof (await metaValue(page, 'persistGranted'))).toBe('boolean');
    // Témoin : seule la demande de fin d'onboarding (R-SYN-31) peut encore le remplacer par un booléen.
    await idbPut(page, 'meta', { key: 'persistGranted', value: PERSIST_SENTINEL });
    expect(await metaValue(page, 'persistGranted')).toBe(PERSIST_SENTINEL);
    await completeOnboardingViaUi(page, {
      place: { kind: 'gym', name: 'Fitness Park Nation', city: 'Paris' },
    });
    await expect(page).toHaveURL(`${server.url}/`);
    await waitForController(page);
    // Réponse du SW attendue sans délai fixe : un runner chargé peut dépasser la fenêtre d'1 s de swStatus.
    await expect.poll(async () => (await swStatus(page))?.shellCached).toBe(true);
    // R-SYN-31 : nouvelle demande à la fin de l'onboarding, dans l'appli installée.
    await expect.poll(async () => typeof (await metaValue(page, 'persistGranted'))).toBe('boolean');
  });

  await test.step("session : cookie dev-session et contrôle de l'Origin", async () => {
    const cookies = await context.cookies(server.url);
    expect(cookies.find((c) => c.name === '__Host-session')).toBeUndefined();
    // WebKit sous Windows (WinCairo) ne garde pas SameSite (lu « None ») : la CI Linux fait foi.
    const sameSiteKept = !(browserName === 'webkit' && process.platform === 'win32');
    expect(cookies.find((c) => c.name === 'dev-session')).toMatchObject({
      httpOnly: true,
      secure: false,
      path: '/',
      ...(sameSiteKept ? { sameSite: 'Lax' } : {}),
    });
    const sameOrigin = await page.evaluate(async () => {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'camille' }),
      });
      return res.status;
    });
    expect(sameOrigin).toBe(200);
    const forged = await page.request.patch(`${server.url}/api/me`, {
      headers: { Origin: 'http://evil.example' },
      data: { username: 'camille' },
    });
    expect(forged.status()).toBe(403);
    expect(await forged.json()).toEqual({ error: 'origin_mismatch' });
  });

  await test.step('membre : code saisi en minuscules avec espaces, puis onboarding maison', async () => {
    const created = await page.request.post(`${server.url}/api/admin/invitations`, {
      headers: { Origin: server.url },
      data: { birthDate: '1995-03-14' },
    });
    expect(created.status()).toBe(201);
    const { code } = (await created.json()) as { code: string };

    const memberContext = await newContext();
    await emulateStandalone(memberContext);
    const member = await memberContext.newPage();
    await member.goto(`${server.url}/invite`);
    await requireServiceWorker(member);
    await expect(member.getByText('hébergé chez Alex')).toBeVisible();

    await test.step('paysage : action principale utilisable (WCAG 1.3.4)', async () => {
      // L'écran reste utilisable une fois le téléphone tourné.
      const portrait = member.viewportSize();
      if (!portrait) throw new Error('viewport du projet absent');
      await member.setViewportSize({ width: portrait.height, height: portrait.width });
      // R-INV-5 : saisie tolérante (casse, espaces à la place des tirets).
      await member
        .getByLabel("Lien ou code d'invitation", { exact: true })
        .fill(code.toLowerCase().replaceAll('-', ' '));
      const next = member.getByRole('button', { name: 'Suivant', exact: true });
      await expectUsableInLandscape(member, next);
      await next.click();
      await member.setViewportSize(portrait);
    });

    await createAccountViaUi(member, 'lea');
    await completeOnboardingViaUi(member, { place: { kind: 'home' } });
    await expect(member).toHaveURL(`${server.url}/`);
  });
});

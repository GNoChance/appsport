/**
 * Attend une condition en laissant tourner la boucle réelle (setImmediate, que fake-indexeddb
 * utilise et que les tests ne simulent pas), sans avancer l'horloge simulée — contrairement à
 * `vi.waitFor`, qui l'avance sous `vi.useFakeTimers`.
 */
export async function until(cond: () => boolean, maxTurns = 5000): Promise<void> {
  for (let i = 0; i < maxTurns; i++) {
    if (cond()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('until: condition jamais remplie');
}

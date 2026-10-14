/** Un processus enfant suivi : `exited` donne son code de sortie (null s'il a été tué par un signal). */
export interface SupervisedChild {
  label: string;
  exited: Promise<number | null>;
}

export interface SuperviseOptions<C extends SupervisedChild> {
  /** Résolue à la demande d'arrêt (Ctrl+C, fermeture de la console). */
  stop: Promise<void>;
  /** Délai laissé aux enfants pour sortir seuls, puis après un arrêt forcé. */
  graceMs: number;
  /** Demande polie (SIGINT au groupe) ; sous Windows, Ctrl+C a déjà atteint toute la console. */
  interrupt(child: C): void;
  /** Arrêt forcé de l'enfant et de ses sous-processus. */
  killTree(child: C): Promise<void>;
  log(line: string): void;
}

const within = (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms).unref?.()),
  ]);

/**
 * Attend la demande d'arrêt ou la sortie d'un enfant, puis arrête tous les autres (arbre compris).
 * Code : 0 après un arrêt demandé ; sinon celui de l'enfant sorti, ou 1 s'il est sorti sans erreur ou par signal.
 */
export async function supervise<C extends SupervisedChild>(
  children: readonly C[],
  opts: SuperviseOptions<C>,
): Promise<number> {
  const alive = new Set(children);
  for (const child of children) void child.exited.then(() => alive.delete(child));
  const first = await Promise.race([
    opts.stop.then(() => null),
    ...children.map((child) => child.exited.then((code) => ({ child, code }))),
  ]);

  let code = 0;
  if (first === null) {
    for (const child of alive) opts.interrupt(child);
    await within(Promise.all([...alive].map((c) => c.exited)), opts.graceMs);
  } else {
    code = first.code === null || first.code === 0 ? 1 : first.code;
    alive.delete(first.child);
    opts.log(`Le ${first.child.label} s'est arrêté (code ${String(first.code)}) : arrêt du reste.`);
  }
  const remaining = [...alive];
  await Promise.all(remaining.map((child) => opts.killTree(child)));
  for (const child of remaining) {
    if (!(await within(child.exited, opts.graceMs))) opts.log(`Le ${child.label} ne répond pas à l'arrêt.`);
  }
  return code;
}

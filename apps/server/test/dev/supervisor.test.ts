import { describe, expect, it } from 'vitest';
import { createEmergencyStop, type SupervisedChild, supervise } from '../../scripts/dev/supervisor';

interface FakeChild extends SupervisedChild {
  exit(code: number | null): void;
}

function fakeChild(label: string): FakeChild {
  const { promise, resolve } = Promise.withResolvers<number | null>();
  return { label, exited: promise, exit: resolve };
}

function harness(
  children: FakeChild[],
  opts: { exitOnInterrupt?: boolean; exitOnKill?: boolean; graceMs?: number } = {},
) {
  const calls: string[] = [];
  const logs: string[] = [];
  const { promise: stop, resolve: requestStop } = Promise.withResolvers<void>();
  const { promise: force, resolve: requestForce } = Promise.withResolvers<void>();
  const run = supervise(children, {
    stop,
    force,
    graceMs: opts.graceMs ?? 30,
    interrupt: (child) => {
      calls.push(`interrupt ${child.label}`);
      if (opts.exitOnInterrupt) (child as FakeChild).exit(0);
    },
    killTree: async (child) => {
      calls.push(`kill ${child.label}`);
      if (opts.exitOnKill ?? true) (child as FakeChild).exit(null);
    },
    log: (line) => logs.push(line),
  });
  return { calls, logs, requestStop, requestForce, run };
}

describe('supervise', () => {
  it("si l'un s'arrête en erreur, l'autre est arrêté et le code est celui de l'enfant", async () => {
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    const h = harness([server, web]);
    web.exit(2);
    expect(await h.run).toBe(2);
    expect(h.calls).toEqual(['kill serveur']);
    expect(h.logs.join('\n')).toMatch(/web.*code 2/);
  });

  it('un arrêt inattendu sans erreur ou par signal donne quand même un code non nul', async () => {
    const a = fakeChild('serveur');
    const b = fakeChild('web');
    const h = harness([a, b]);
    a.exit(0);
    expect(await h.run).toBe(1);

    const c = fakeChild('serveur');
    const d = fakeChild('web');
    const h2 = harness([c, d]);
    c.exit(null);
    expect(await h2.run).toBe(1);
    expect(h2.calls).toEqual(['kill web']);
  });

  it("à l'arrêt demandé, les enfants qui sortent seuls ne sont pas tués, et le code est 0", async () => {
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    const h = harness([server, web], { exitOnInterrupt: true });
    h.requestStop();
    expect(await h.run).toBe(0);
    expect(h.calls).toEqual(['interrupt serveur', 'interrupt web']);
  });

  it("à l'arrêt demandé, un enfant encore là après le délai est tué avec ses sous-processus", async () => {
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    const h = harness([server, web]);
    h.requestStop();
    expect(await h.run).toBe(0);
    expect(h.calls).toEqual(['interrupt serveur', 'interrupt web', 'kill serveur', 'kill web']);
  });

  it('ne reste pas bloqué si un enfant survit même au kill', async () => {
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    const h = harness([server, web], { exitOnKill: false });
    web.exit(1);
    expect(await h.run).toBe(1);
    expect(h.logs.join('\n')).toMatch(/serveur/);
  });

  it('un second Ctrl+C pendant le délai tue tout de suite les enfants avec leurs sous-processus', async () => {
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    const h = harness([server, web], { graceMs: 60_000 });
    h.requestStop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    h.requestForce();
    const started = Date.now();
    expect(await h.run).toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(h.calls).toEqual(['interrupt serveur', 'interrupt web', 'kill serveur', 'kill web']);
  });
});

describe('createEmergencyStop', () => {
  it('à une sortie anormale, tue tout de suite les enfants encore en vie, pas ceux déjà sortis', async () => {
    const killed: string[] = [];
    const emergency = createEmergencyStop<FakeChild>((child) => killed.push(child.label));
    const server = fakeChild('serveur');
    const web = fakeChild('web');
    emergency.track(server);
    emergency.track(web);
    web.exit(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    emergency.killAll();
    expect(killed).toEqual(['serveur']);
  });

  it("ne tue chaque enfant qu'une fois, même appelé de nouveau (exception puis sortie du processus)", () => {
    const killed: string[] = [];
    const emergency = createEmergencyStop<FakeChild>((child) => killed.push(child.label));
    emergency.track(fakeChild('serveur'));
    emergency.killAll();
    emergency.killAll();
    expect(killed).toEqual(['serveur']);
  });

  it("un arrêt qui échoue n'empêche pas d'arrêter les autres", () => {
    const killed: string[] = [];
    const emergency = createEmergencyStop<FakeChild>((child) => {
      if (child.label === 'serveur') throw new Error('taskkill introuvable');
      killed.push(child.label);
    });
    emergency.track(fakeChild('serveur'));
    emergency.track(fakeChild('web'));
    expect(() => emergency.killAll()).not.toThrow();
    expect(killed).toEqual(['web']);
  });
});

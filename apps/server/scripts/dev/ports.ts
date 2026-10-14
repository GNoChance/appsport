import { connect } from 'node:net';

/** Vite écoute sur `localhost`, qui vaut 127.0.0.1 ou ::1 selon la machine : les deux sont sondés. */
const LOCAL_HOSTS = ['127.0.0.1', '::1'] as const;

function accepts(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (busy: boolean): void => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** Vrai si un programme accepte déjà des connexions sur ce port en local. */
export async function isPortBusy(port: number, timeoutMs = 1000): Promise<boolean> {
  const results = await Promise.all(LOCAL_HOSTS.map((host) => accepts(host, port, timeoutMs)));
  return results.some(Boolean);
}

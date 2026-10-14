import { writeSync } from 'node:fs';
import { serverExitLine, serverReadyLine } from './server-status';

// Entrée du serveur sous `tsx watch` pour `pnpm dev` : le même `main` que `src/main.ts`, plus deux lignes de
// service (prêt, sortie en erreur) que le script lit. Écriture synchrone : la ligne de sortie part avant la fin.
// Le serveur est importé après la pose de l'écouteur, pour qu'une erreur au chargement du code soit aussi signalée.

const mark = (line: string): void => {
  writeSync(1, `${line}\n`);
};

process.on('exit', (code) => {
  if (code !== 0) mark(serverExitLine(code));
});

const { main, startServer } = await import('../../src/main');
main([], async (env) => {
  const running = await startServer(env);
  mark(serverReadyLine());
  return running;
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);

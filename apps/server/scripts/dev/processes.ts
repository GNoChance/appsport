import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { createLinePrefixer } from './output';
import type { SupervisedChild } from './supervisor';

// Processus de `pnpm dev`, toujours sans shell : `process.execPath` et des chemins de scripts résolus
// (sous Windows, `pnpm`, `vite` et `tsx` sont des `.cmd` qu'il faudrait passer par cmd.exe).

const WINDOWS = process.platform === 'win32';

export interface Command {
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface DevChild extends SupervisedChild {
  pid: number | undefined;
}

function exitOf(proc: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    proc.once('error', () => resolve(1));
    proc.once('close', (code) => resolve(code));
  });
}

/** Lance `node <args>` et rend sa sortie complète, sans rien afficher. */
export function runCapture(cmd: Command): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const proc = spawn(process.execPath, cmd.args, {
    cwd: cmd.cwd,
    env: cmd.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d: Buffer) => {
    stdout += d.toString();
  });
  proc.stderr.on('data', (d: Buffer) => {
    stderr += d.toString();
  });
  return exitOf(proc).then((code) => ({ code, stdout, stderr }));
}

/**
 * Lance `node <args>` en continu, sorties préfixées par `[label]`. Sous POSIX, l'enfant a son propre groupe
 * pour qu'un signal atteigne tous ses sous-processus ; sous Windows, il reste dans la console (Ctrl+C l'atteint).
 */
export function spawnPrefixed(label: string, cmd: Command): DevChild {
  const proc = spawn(process.execPath, cmd.args, {
    cwd: cmd.cwd,
    env: cmd.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS,
  });
  const out = createLinePrefixer(`[${label}]`, (text) => process.stdout.write(text));
  const err = createLinePrefixer(`[${label}]`, (text) => process.stderr.write(text));
  proc.stdout.on('data', (d: Buffer) => out.push(d.toString()));
  proc.stderr.on('data', (d: Buffer) => err.push(d.toString()));
  const exited = exitOf(proc).then((code) => {
    out.end();
    err.end();
    return code;
  });
  return { label, pid: proc.pid, exited };
}

/** Demande polie : SIGINT au groupe sous POSIX ; rien sous Windows, où Ctrl+C a déjà atteint toute la console. */
export function interruptTree(child: DevChild): void {
  if (WINDOWS || child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGINT');
  } catch {
    // Déjà arrêté.
  }
}

/** Arrêt forcé de l'enfant et de tous ses sous-processus (`taskkill /T /F` sous Windows). */
export function killTree(child: DevChild): Promise<void> {
  const pid = child.pid;
  if (pid === undefined) return Promise.resolve();
  if (!WINDOWS) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Déjà arrêté.
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
}

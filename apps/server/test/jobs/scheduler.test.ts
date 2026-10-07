import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppDeps } from '../../src/deps';
import { startDailyJobs } from '../../src/jobs/scheduler';
import { createLogger } from '../../src/logger';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const depsWith = (lines: string[]): AppDeps => ({ logger: createLogger((l) => lines.push(l)) }) as AppDeps;

it('chaque job au démarrage puis toutes les 24 h ; stop() arrête', async () => {
  let calls = 0;
  const handle = startDailyJobs(depsWith([]), [
    {
      name: 'j',
      run: async () => {
        calls += 1;
      },
    },
  ]);
  await vi.advanceTimersByTimeAsync(0);
  expect(calls).toBe(1);
  await vi.advanceTimersByTimeAsync(DAY);
  expect(calls).toBe(2);
  handle.stop();
  await vi.advanceTimersByTimeAsync(DAY * 3);
  expect(calls).toBe(2);
});

it("isole l'échec d'un job et le journalise sans son message", async () => {
  const lines: string[] = [];
  let next = 0;
  startDailyJobs(depsWith(lines), [
    {
      name: 'boom',
      run: async () => {
        throw new Error('TEMOIN');
      },
    },
    {
      name: 'after',
      run: async () => {
        next += 1;
      },
    },
  ]);
  await vi.advanceTimersByTimeAsync(0);
  expect(next).toBe(1);
  expect(lines.map((l) => JSON.parse(l))).toContainEqual(
    expect.objectContaining({ level: 'error', job: 'boom' }),
  );
  expect(lines.join('\n')).not.toContain('TEMOIN');
});

/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: variables shell, pas de JavaScript */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { run?: string };

const releaseText = readFileSync(
  fileURLToPath(new URL('../../../../.github/workflows/release.yml', import.meta.url)),
  'utf8',
);
const ciGuard = (parse(releaseText).jobs.publish.steps as Step[]).find((step) =>
  step.run?.includes('gh api'),
)?.run;

/** Bash de Git pour Windows en local, celui du runner ailleurs. */
const BASH =
  process.platform === 'win32'
    ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
    : 'bash';

const SHA = 'abc123';
const REFUSAL = `La CI du commit ${SHA} n'est pas verte : publication refusée. Relancer ce job quand la CI de main sera verte.`;

/**
 * Exécute la garde CI comme le runner (`bash --noprofile --norc -eo pipefail`), avec un `gh` simulé qui
 * imprime `output` puis sort avec `status`.
 */
function runGuard(output: string, status = 0) {
  if (!ciGuard) throw new Error('garde CI absente de release.yml');
  const stub = `gh() { printf '%s' "$GH_STUB_OUTPUT"; return ${status}; }\n`;
  return spawnSync(BASH, ['--noprofile', '--norc', '-eo', 'pipefail', '-c', stub + ciGuard], {
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
    env: {
      PATH: process.env.PATH,
      GH_STUB_OUTPUT: output,
      GITHUB_REPOSITORY: 'gnochance/appsport',
      GITHUB_SHA: SHA,
    },
  });
}

describe('garde CI de release.yml exécutée (R-DEP-2 : échoue fermée)', () => {
  it('un run vert de ci.yml pour le commit : la publication continue', () => {
    const result = runGuard('1');
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain(REFUSAL);
  });

  it.each([
    ['0', 'aucun run vert'],
    ['', 'réponse vide'],
    ['null', 'total_count absent (null)'],
    ['abc', 'réponse non numérique'],
  ])('total_count %j (%s) : refus avec le message, code 1', (output) => {
    const result = runGuard(output);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain(REFUSAL);
  });

  it('gh en échec (réseau, 404) : le job s’arrête', () => {
    const result = runGuard('', 1);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
});

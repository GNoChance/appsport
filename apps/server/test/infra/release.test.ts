/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: expressions GitHub Actions et variables shell, pas de JavaScript */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};

/** Le bash du runner GitHub ; sous Windows, celui de Git for Windows (jamais le bash de WSL). */
const resolveBash = (): string => {
  if (process.platform !== 'win32') return 'bash';
  const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout.trim();
  return join(execPath, '..', '..', '..', 'bin', 'bash.exe');
};
const BASH = resolveBash();

/**
 * Faux git et gh, en fonctions shell : elles passent avant le PATH, donc aucun vrai git ni gh n'est appelé.
 * Chaque appel est tracé sur stderr ; le code de sortie et la sortie de gh viennent des variables STUB_*.
 */
const STUBS = [
  'git() { echo "git $*" >&2; case "$1" in fetch) return 0;; merge-base) return "$STUB_MERGE_BASE_EXIT";; *) return 99;; esac; }',
  'gh() { echo "gh $*" >&2; printf \'%s\\n\' "$STUB_GH_OUT"; return "$STUB_GH_EXIT"; }',
].join('\n');

const SHA = '0123456789abcdef0123456789abcdef01234567';

type GuardRun = { status: number | null; stdout: string; calls: string[] };

/** Exécute le script d'une garde comme le runner (`bash -e`), avec l'environnement d'un push de tag. */
const runGuard = (script: string, env: Record<string, string>): GuardRun => {
  const tag = env.GITHUB_REF_NAME ?? 'v1.2.3';
  const result = spawnSync(BASH, ['--noprofile', '--norc', '-e', '-c', `${STUBS}\n${script}`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_REF: `refs/tags/${tag}`,
      GITHUB_REF_NAME: tag,
      GITHUB_SHA: SHA,
      GITHUB_REPOSITORY: 'GNoChance/rune',
      STUB_MERGE_BASE_EXIT: '0',
      STUB_GH_OUT: '1',
      STUB_GH_EXIT: '0',
      ...env,
    },
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, calls: result.stderr.split('\n').filter(Boolean) };
};

describe('.github/workflows/release.yml', () => {
  const releaseText = read('.github/workflows/release.yml');
  const release = parse(releaseText);
  const steps: Step[] = release.jobs.publish.steps;
  const stepNamed = (name: string): Step => {
    const found = steps.find((step) => step.name === name);
    if (!found) throw new Error(`étape « ${name} » absente de release.yml`);
    return found;
  };
  const usesStep = (uses: string): Step => {
    const found = steps.find((step) => step.uses === uses);
    if (!found) throw new Error(`étape ${uses} absente de release.yml`);
    return found;
  };

  it('déclenché seulement par un tag vX.Y.Z (R-OPS-13 : rien ne se déploie, rien sur main)', () => {
    expect(release.on).toEqual({ push: { tags: ['v*.*.*'] } });
  });

  it('permissions minimales : lecture du dépôt et des actions, écriture des paquets', () => {
    expect(release.permissions).toEqual({ contents: 'read', packages: 'write', actions: 'read' });
    // le job n'a ni permissions, ni if, ni continue-on-error, ni env propres : rien ne remplace ces droits
    expect(Object.keys(release.jobs.publish).sort()).toEqual(['runs-on', 'steps']);
  });

  it('un seul job publish sur ubuntu-latest, étapes dans l’ordre', () => {
    expect(Object.keys(release.jobs)).toEqual(['publish']);
    expect(release.jobs.publish['runs-on']).toBe('ubuntu-latest');
    // exactement ces étapes, dans cet ordre : aucune étape de déploiement après la publication (R-OPS-13)
    expect(steps.map((step) => step.uses ?? step.name)).toEqual([
      'actions/checkout@v4',
      'Garde du tag',
      'Garde de main',
      'Garde CI',
      'docker/setup-buildx-action@v3',
      'docker/login-action@v3',
      'docker/build-push-action@v6',
    ]);
    // ni if, ni continue-on-error, ni shell sur aucune étape : une garde qui échoue arrête le job
    expect(steps.map((step) => Object.keys(step).sort())).toEqual([
      ['uses', 'with'],
      ['name', 'run'],
      ['name', 'run'],
      ['env', 'name', 'run'],
      ['uses'],
      ['uses', 'with'],
      ['uses', 'with'],
    ]);
    expect(steps[0]?.with).toEqual({ 'fetch-depth': 0 });
  });

  it('garde du tag : vX.Y.Z strict, sinon « Tag invalide »', () => {
    const run = stepNamed('Garde du tag').run ?? '';
    expect(run).toContain('^v[0-9]+\\.[0-9]+\\.[0-9]+$');
    expect(run).toContain('Tag invalide : $GITHUB_REF_NAME');
    for (const tag of ['v1.2.3', 'v10.0.27']) {
      expect(runGuard(run, { GITHUB_REF_NAME: tag }), tag).toEqual({ status: 0, stdout: '', calls: [] });
    }
    for (const tag of ['v1.2.3-rc1', 'v1.2', 'v1.2.3.4', '1.2.3', 'refs/tags/v1.2.3']) {
      expect(runGuard(run, { GITHUB_REF_NAME: tag }), tag).toEqual({
        status: 1,
        stdout: `Tag invalide : ${tag}\n`,
        calls: [],
      });
    }
  });

  it('garde de main : le commit tagué doit être un ancêtre de origin/main', () => {
    const run = stepNamed('Garde de main').run ?? '';
    expect(run).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(run).toContain("Le commit n'est pas sur main : publication refusée.");
    const calls = ['git fetch origin main', `git merge-base --is-ancestor ${SHA} origin/main`];
    expect(runGuard(run, { STUB_MERGE_BASE_EXIT: '0' })).toEqual({ status: 0, stdout: '', calls });
    expect(runGuard(run, { STUB_MERGE_BASE_EXIT: '1' })).toEqual({
      status: 1,
      stdout: "Le commit n'est pas sur main : publication refusée.\n",
      calls,
    });
  });

  it('garde CI : au moins un run vert de ci.yml pour ce commit, avant toute construction', () => {
    const ciGuard = stepNamed('Garde CI');
    expect(ciGuard.env).toEqual({ GH_TOKEN: '${{ github.token }}' });
    const run = ciGuard.run ?? '';
    expect(run).toContain(
      'gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${GITHUB_SHA}&status=success"',
    );
    expect(run).toContain("--jq '.total_count'");
    expect(run).toContain(
      "La CI du commit ${GITHUB_SHA} n'est pas verte : publication refusée. Relancer ce job quand la CI de main sera verte.",
    );
    const calls = [
      `gh api repos/GNoChance/rune/actions/workflows/ci.yml/runs?head_sha=${SHA}&status=success --jq .total_count`,
    ];
    const refused = `La CI du commit ${SHA} n'est pas verte : publication refusée. Relancer ce job quand la CI de main sera verte.\n`;
    for (const out of ['1', '3']) {
      expect(runGuard(run, { STUB_GH_OUT: out }), out).toEqual({ status: 0, stdout: '', calls });
    }
    for (const out of ['0', '']) {
      expect(runGuard(run, { STUB_GH_OUT: out }), `« ${out} »`).toEqual({
        status: 1,
        stdout: refused,
        calls,
      });
    }
    // gh en échec (réseau, 404) : le job s'arrête aussi, sur l'erreur de gh
    const failed = runGuard(run, { STUB_GH_OUT: '', STUB_GH_EXIT: '1' });
    expect(failed.status).not.toBe(0);
    expect(failed.calls).toEqual(calls);
  });

  it('connexion à ghcr.io avec le jeton du workflow, construction et publication de l’image amd64 du tag', () => {
    expect(usesStep('docker/login-action@v3').with).toEqual({
      registry: 'ghcr.io',
      username: '${{ github.actor }}',
      password: '${{ github.token }}',
    });
    // carte complète : ni cache-to, ni outputs, ni autre tag ne publient une autre référence
    const buildPush = usesStep('docker/build-push-action@v6');
    expect(buildPush.with).toEqual({
      context: '.',
      file: 'infra/Dockerfile',
      platforms: 'linux/amd64',
      push: true,
      tags: 'ghcr.io/gnochance/rune:${{ github.ref_name }}',
      'build-args':
        'VERSION=${{ github.ref_name }}\nVITE_OWNER_FIRST_NAME=${{ vars.VITE_OWNER_FIRST_NAME }}\n',
    });
    expect(String(buildPush.with?.['build-args']).split('\n').filter(Boolean)).toEqual([
      'VERSION=${{ github.ref_name }}',
      'VITE_OWNER_FIRST_NAME=${{ vars.VITE_OWNER_FIRST_NAME }}',
    ]);
  });

  it("ni ':latest', ni Anthropic dans release.yml et ci.yml (01 §4, 03 §10.9)", () => {
    expect(releaseText).not.toContain(':latest');
    expect(releaseText).not.toMatch(/anthropic/i);
    expect(read('.github/workflows/ci.yml')).not.toMatch(/anthropic/i);
  });
});

describe('.github/workflows/ci.yml', () => {
  it('tourne sur les pull requests et sur main (la garde CI de la release en dépend)', () => {
    const ci = parse(read('.github/workflows/ci.yml'));
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push']);
    expect(ci.on.push).toEqual({ branches: ['main'] });
  });
});

describe('.github/dependabot.yml', () => {
  it('version 2 : npm groupé (mineures et correctifs), image de base et actions, chaque semaine', () => {
    const dependabot = parse(read('.github/dependabot.yml'));
    expect(dependabot.version).toBe(2);
    expect(dependabot.updates).toEqual([
      {
        'package-ecosystem': 'npm',
        directory: '/',
        schedule: { interval: 'weekly' },
        groups: { 'npm-minor-patch': { patterns: ['*'], 'update-types': ['minor', 'patch'] } },
      },
      { 'package-ecosystem': 'docker', directory: '/infra', schedule: { interval: 'weekly' } },
      { 'package-ecosystem': 'github-actions', directory: '/', schedule: { interval: 'weekly' } },
    ]);
  });
});

/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: expressions GitHub Actions et variables shell, pas de JavaScript */
import { readFileSync } from 'node:fs';
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

describe('.github/workflows/release.yml', () => {
  const releaseText = read('.github/workflows/release.yml');
  const release = parse(releaseText);
  const steps: Step[] = release.jobs.publish.steps;
  const runText = steps.map((step) => step.run ?? '').join('\n');
  const usesIndex = (prefix: string): number => steps.findIndex((step) => step.uses?.startsWith(prefix));
  const runIndex = (needle: string): number => steps.findIndex((step) => step.run?.includes(needle));
  const bpIndex = usesIndex('docker/build-push-action@');
  const stepAt = (index: number): Step => {
    const found = steps[index];
    if (!found) throw new Error(`étape ${index} absente de release.yml`);
    return found;
  };

  it('déclenché seulement par un tag vX.Y.Z (R-OPS-13 : rien ne se déploie, rien sur main)', () => {
    expect(release.on).toEqual({ push: { tags: ['v*.*.*'] } });
  });

  it('permissions minimales : lecture du dépôt et des actions, écriture des paquets', () => {
    expect(release.permissions).toEqual({ contents: 'read', packages: 'write', actions: 'read' });
  });

  it('un seul job publish sur ubuntu-latest, étapes dans l’ordre', () => {
    expect(Object.keys(release.jobs)).toEqual(['publish']);
    expect(release.jobs.publish['runs-on']).toBe('ubuntu-latest');
    expect(steps[0]).toMatchObject({ uses: 'actions/checkout@v4', with: { 'fetch-depth': 0 } });
    const order = [
      runIndex('^v[0-9]+\\.[0-9]+\\.[0-9]+$'),
      runIndex('git fetch origin main'),
      runIndex('git merge-base --is-ancestor'),
      runIndex('gh api'),
      usesIndex('docker/setup-buildx-action@v3'),
      usesIndex('docker/login-action@v3'),
      usesIndex('docker/build-push-action@v6'),
    ];
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(steps).toHaveLength(7);
  });

  it('garde du tag : vX.Y.Z strict, sinon « Tag invalide »', () => {
    expect(runText).toContain('^v[0-9]+\\.[0-9]+\\.[0-9]+$');
    expect(runText).toContain('Tag invalide : $GITHUB_REF_NAME');
  });

  it('garde de main : le commit tagué doit être un ancêtre de origin/main', () => {
    const guard = stepAt(runIndex('git merge-base')).run ?? '';
    expect(guard.indexOf('git fetch origin main')).toBeLessThan(guard.indexOf('git merge-base'));
    expect(runText).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(runText).toContain("Le commit n'est pas sur main : publication refusée.");
  });

  it('garde CI : au moins un run vert de ci.yml pour ce commit, avant toute construction', () => {
    const ciGuardIndex = runIndex('gh api');
    const ciGuard = stepAt(ciGuardIndex);
    expect(ciGuard.env).toEqual({ GH_TOKEN: '${{ github.token }}' });
    expect(ciGuard.run).toContain(
      'gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${GITHUB_SHA}&status=success"',
    );
    expect(ciGuard.run).toContain("--jq '.total_count'");
    expect(ciGuard.run).toContain(
      "La CI du commit ${GITHUB_SHA} n'est pas verte : publication refusée. Relancer ce job quand la CI de main sera verte.",
    );
    // les trois gardes précèdent docker/build-push-action
    for (const needle of ['Tag invalide', 'git merge-base', 'gh api']) {
      expect(runIndex(needle)).toBeLessThan(bpIndex);
    }
  });

  it('connexion à ghcr.io avec le jeton du workflow, construction et publication de l’image amd64 du tag', () => {
    expect(stepAt(usesIndex('docker/login-action@v3')).with).toEqual({
      registry: 'ghcr.io',
      username: '${{ github.actor }}',
      password: '${{ github.token }}',
    });
    expect(stepAt(bpIndex).with).toMatchObject({
      context: '.',
      file: 'infra/Dockerfile',
      platforms: 'linux/amd64',
      push: true,
      tags: 'ghcr.io/gnochance/appsport:${{ github.ref_name }}',
    });
    expect(String(stepAt(bpIndex).with?.['build-args']).split('\n').filter(Boolean)).toEqual([
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

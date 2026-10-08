import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');

/** Sonde de santé de l'image et du service : node:24-slim n'a pas curl. */
const HEALTH_PROBE =
  "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))";

describe('infra/compose.yaml', () => {
  const compose = parse(read('infra/compose.yaml'));
  const app = compose.services.app;

  it('projet appsport, un seul service app', () => {
    expect(compose.name).toBe('appsport');
    expect(Object.keys(compose.services)).toEqual(['app']);
  });

  it('image de deploy.env, port sur la boucle locale seulement, volume et secrets', () => {
    expect(app.image).toBe('ghcr.io/gnochance/appsport:${APPSPORT_VERSION:?APPSPORT_VERSION absent de deploy.env}');
    expect(app.ports).toEqual(['127.0.0.1:3000:3000']);
    expect(app.volumes).toEqual(['/srv/appsport/data:/data']);
    expect(app.env_file).toBe('/srv/appsport/secrets/app.env');
  });

  it('racine en lecture seule, utilisateur 1000, mémoire bornée, arrêt en 10 s', () => {
    expect(app).toMatchObject({
      read_only: true,
      tmpfs: ['/tmp'],
      user: '1000',
      mem_limit: '512m',
      restart: 'unless-stopped',
      stop_grace_period: '10s',
    });
  });

  it("healthcheck sur /api/health, le même que celui de l'image", () => {
    expect(app.healthcheck).toEqual({
      test: ['CMD', 'node', '-e', HEALTH_PROBE],
      interval: '30s',
      timeout: '5s',
      start_period: '30s',
      retries: 3,
    });
    expect(HEALTH_PROBE).toContain('http://127.0.0.1:3000/api/health');
  });

  it('ni privilège, ni réseau hôte, ni capacité ajoutée, ni build, ni port exposé', () => {
    for (const key of ['privileged', 'network_mode', 'cap_add', 'build', 'expose']) {
      expect(app).not.toHaveProperty(key);
    }
  });
});

describe('infra/Dockerfile', () => {
  const dockerfile = read('infra/Dockerfile');
  const finalStage = dockerfile.slice(dockerfile.lastIndexOf('FROM node:24-slim'));

  it('étape de build : pnpm install --frozen-lockfile, prénom du porteur passé avant pnpm build', () => {
    expect(dockerfile).toMatch(/^# syntax=docker\/dockerfile:1$/m);
    const buildStage = dockerfile.indexOf('FROM node:24 AS build');
    const pnpmBuild = dockerfile.indexOf('pnpm build');
    const ownerArg = dockerfile.search(/^ARG VITE_OWNER_FIRST_NAME$/m);
    expect(buildStage).toBeGreaterThanOrEqual(0);
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(ownerArg).toBeGreaterThan(buildStage);
    expect(pnpmBuild).toBeGreaterThan(ownerArg);
  });

  it('étape finale node:24-slim : server.mjs, public/ et data/ seulement, sans node_modules', () => {
    expect(finalStage.match(/^FROM .*$/gm)).toEqual(['FROM node:24-slim']);
    expect(finalStage).not.toContain('node_modules');
    expect(finalStage.match(/^COPY .*$/gm)).toEqual([
      'COPY --from=build /src/apps/server/dist/server.mjs /app/server.mjs',
      'COPY --from=build /src/apps/web/dist /app/public',
      'COPY --from=build /src/data /app/data',
    ]);
  });

  it('version et configuration par variables, utilisateur 1000, port 3000, santé et commande', () => {
    expect(finalStage).toMatch(/^ARG VERSION=dev$/m);
    const env =
      'ENV NODE_ENV=production APP_VERSION=${VERSION} PORT=3000 HOST=0.0.0.0 APPSPORT_DATA_DIR=/data APPSPORT_PUBLIC_DIR=/app/public APPSPORT_CONTENT_DIR=/app/data';
    expect(finalStage).toContain(env);
    expect(finalStage.indexOf(env)).toBeGreaterThan(finalStage.indexOf('ARG VERSION=dev'));
    expect(finalStage).toMatch(/^USER 1000$/m);
    expect(finalStage).toMatch(/^EXPOSE 3000$/m);
    expect(finalStage).toContain(
      `HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ${JSON.stringify(['node', '-e', HEALTH_PROBE])}`,
    );
    expect(finalStage).toContain('CMD ["node","/app/server.mjs"]');
  });
});

it('.dockerignore écarte node_modules, .git, les builds, les rapports et docs du contexte', () => {
  const patterns = read('.dockerignore')
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'));
  expect(patterns).toEqual([
    '**/node_modules',
    '.git',
    '**/dist',
    '.e2e-data',
    'test-results',
    'playwright-report',
    'docs',
  ]);
});

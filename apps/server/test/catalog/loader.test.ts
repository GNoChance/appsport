import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOG_STARTUP_TASK,
  CatalogLoadError,
  getLoadedCatalog,
  loadCatalog,
} from '../../src/catalog/loader';
import { getServerMeta } from '../../src/db/server-meta';
import { createLogger } from '../../src/logger';
import { STARTUP_TASKS } from '../../src/startup';
import { createTestContext, type TestContext } from '../support';

const REPO_DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../data');
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

let ctx: TestContext;
const dirs: string[] = [];
afterEach(() => {
  ctx?.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function contentDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'appsport-catalog-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe('data/', () => {
  it('data/LICENSE existe', () => {
    expect(existsSync(join(REPO_DATA, 'LICENSE'))).toBe(true);
  });
});

describe('loadCatalog', () => {
  it('le dossier data/ du dépôt donne un catalogue vide et pose la version', async () => {
    ctx = await createTestContext({ config: { contentDir: REPO_DATA } });
    const b = await loadCatalog(ctx.deps);
    expect(b).toMatchObject({ exercises: [], illustrations: [], programTemplates: [], adviceSheets: [] });
    expect(b.version).toBe(
      sha('{"adviceSheets":[],"exercises":[],"illustrations":[],"programTemplates":[]}'),
    );
    expect((await getServerMeta(ctx.deps.db)).catalogVersion).toBe(b.version);
    expect(getLoadedCatalog(ctx.deps)).toEqual(b);
  });

  it('manifeste absent : illustrations vides', async () => {
    ctx = await createTestContext({ config: { contentDir: contentDir({}) } });
    expect((await loadCatalog(ctx.deps)).illustrations).toEqual([]);
  });

  it('programs/*.json triés par nom ; l ordre des clés ne change pas la version', async () => {
    const manifest = JSON.stringify([{ id: 'squat', file: 'squat.0a1b2c3d.svg' }]);
    const a = contentDir({
      'illustrations/manifest.json': manifest,
      'programs/b.json': '{"id":"b","title":"B"}',
      'programs/a.json': '{"id":"a"}',
    });
    const b = contentDir({
      'illustrations/manifest.json': manifest,
      'programs/b.json': '{"title":"B","id":"b"}',
      'programs/a.json': '{"id":"a"}',
    });
    ctx = await createTestContext({ config: { contentDir: a } });
    const first = await loadCatalog(ctx.deps);
    expect(first.programTemplates.map((p) => (p as { id: string }).id)).toEqual(['a', 'b']);
    expect(first.illustrations).toEqual([{ id: 'squat', file: 'squat.0a1b2c3d.svg' }]);
    ctx.close();
    ctx = await createTestContext({ config: { contentDir: b } });
    expect((await loadCatalog(ctx.deps)).version).toBe(first.version);
  });

  it('contenu modifié : nouvelle version et catalogUpdatedAt ; identique : aucune écriture', async () => {
    const dir = contentDir({ 'programs/a.json': '{"id":"a"}' });
    ctx = await createTestContext({ config: { contentDir: dir } });
    const v1 = await loadCatalog(ctx.deps);
    const m1 = await getServerMeta(ctx.deps.db);
    ctx.clock.set('2026-10-07T08:00:00.000Z');
    await loadCatalog(ctx.deps);
    expect(await getServerMeta(ctx.deps.db)).toEqual(m1);
    writeFileSync(join(dir, 'programs/a.json'), '{"id":"a","v":2}');
    const v2 = await loadCatalog(ctx.deps);
    expect(v2.version).not.toBe(v1.version);
    expect(await getServerMeta(ctx.deps.db)).toMatchObject({
      catalogVersion: v2.version,
      catalogUpdatedAt: '2026-10-07T08:00:00.000Z',
    });
  });

  it.each([
    ['fichier invalide', { 'illustrations/manifest.json': '[{"id":"x","file":"pas-bon"}]' }],
    ['JSON illisible', { 'illustrations/manifest.json': '[' }],
    ['programme illisible', { 'programs/a.json': '{' }],
  ])('%s : CatalogLoadError, server_meta inchangé', async (_name, files) => {
    ctx = await createTestContext({ config: { contentDir: contentDir(files) } });
    const before = await getServerMeta(ctx.deps.db);
    await expect(loadCatalog(ctx.deps)).rejects.toBeInstanceOf(CatalogLoadError);
    expect(await getServerMeta(ctx.deps.db)).toEqual(before);
    expect(getLoadedCatalog(ctx.deps)).toBeNull();
  });
});

describe('CATALOG_STARTUP_TASK', () => {
  it('est enregistrée', () => {
    expect(STARTUP_TASKS).toContain(CATALOG_STARTUP_TASK);
    expect(CATALOG_STARTUP_TASK.name).toBe('catalog');
  });

  it('une erreur est journalisée sans interrompre le démarrage', async () => {
    const lines: string[] = [];
    ctx = await createTestContext({
      config: { contentDir: contentDir({ 'illustrations/manifest.json': '[' }) },
      deps: { logger: createLogger((l) => lines.push(l)) },
    });
    await expect(CATALOG_STARTUP_TASK.run(ctx.deps)).resolves.toBeUndefined();
    expect(lines.join('\n')).toContain('catalog_invalid');
  });

  it('charge le catalogue quand il est valide', async () => {
    ctx = await createTestContext({ config: { contentDir: REPO_DATA } });
    await CATALOG_STARTUP_TASK.run(ctx.deps);
    expect(getLoadedCatalog(ctx.deps)).not.toBeNull();
  });
});

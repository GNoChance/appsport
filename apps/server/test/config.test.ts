import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('exige APP_ORIGIN', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('refuse une origine avec chemin, ou http hors localhost', () => {
    expect(() => loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net/chemin' })).toThrow(ConfigError);
    expect(() => loadConfig({ APP_ORIGIN: 'http://appsport.x.ts.net' })).toThrow(ConfigError);
  });

  it('applique les valeurs par défaut en production', () => {
    const cfg = loadConfig({ APP_ORIGIN: 'https://appsport.x.ts.net' });
    expect(cfg).toMatchObject({
      appOrigin: 'https://appsport.x.ts.net',
      version: 'dev',
      port: 3000,
      host: '0.0.0.0',
      dataDir: '/data',
      publicDir: '/app/public',
      contentDir: '/app/data',
      swKillSwitch: false,
      coachModel: 'claude-opus-5-5',
      anthropicApiKey: null,
      argon2: { memoryKiB: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 },
      sessionCookieName: '__Host-session',
      secureCookie: true,
    });
    expect(cfg.dbPath).toBe(join('/data', 'appsport.db'));
    expect(cfg.sentinelPath).toBe(join('/data', '.appsport-volume'));
  });

  it('autorise http sur localhost et 127.0.0.1 avec le cookie de développement', () => {
    expect(loadConfig({ APP_ORIGIN: 'http://localhost:5173' })).toMatchObject({
      sessionCookieName: 'dev-session',
      secureCookie: false,
    });
    expect(loadConfig({ APP_ORIGIN: 'http://127.0.0.1:5173' })).toMatchObject({
      sessionCookieName: 'dev-session',
    });
  });

  it('lit les variables optionnelles', () => {
    expect(
      loadConfig({
        APP_ORIGIN: 'https://a.ts.net',
        SW_KILL_SWITCH: '1',
        PORT: '8080',
        APP_VERSION: 'v1.2.3',
        ANTHROPIC_API_KEY: '',
      }),
    ).toMatchObject({ swKillSwitch: true, port: 8080, version: 'v1.2.3', anthropicApiKey: null });
    expect(loadConfig({ APP_ORIGIN: 'https://a.ts.net', ANTHROPIC_API_KEY: 'k' }).anthropicApiKey).toBe('k');
  });

  it('accepte le port 0 (port libre)', () => {
    expect(loadConfig({ APP_ORIGIN: 'https://a.ts.net', PORT: '0' }).port).toBe(0);
  });

  it('refuse un port invalide', () => {
    expect(() => loadConfig({ APP_ORIGIN: 'https://a.ts.net', PORT: 'abc' })).toThrow(ConfigError);
    expect(() => loadConfig({ APP_ORIGIN: 'https://a.ts.net', PORT: '70000' })).toThrow(ConfigError);
  });
});

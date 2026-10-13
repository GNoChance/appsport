import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(import.meta.dirname, '../..');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const srcFiles = () => [...walk(join(WEB, 'src'))];

describe('règles statiques (P-LOG-4, R-PWA-7)', () => {
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');

  it("index.html : aucun script en ligne, aucune URL absolue, aucun style en ligne, lang='fr'", () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\ssrc="[^"]+"/);
      expect(body?.trim()).toBe('');
    }
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/style=/);
    expect(html).toMatch(/<html[^>]*\slang="fr"/);
  });

  it('aucune CSS de src/ ne charge un domaine tiers', () => {
    const css = srcFiles().filter((f) => f.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    for (const file of css) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/https?:\/\/|url\(\s*['"]?\/\//);
      expect(text, file).not.toMatch(/@import/);
    }
  });

  it('aucun fichier de src/ ne cite une origine (ts.net, localhost:port)', () => {
    for (const file of srcFiles()) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/ts\.net|localhost:\d+/);
    }
  });
});

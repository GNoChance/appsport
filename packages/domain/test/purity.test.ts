import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = join(__dirname, '..', 'src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const read = (f: string) => readFileSync(join(srcDir, f), 'utf8');

describe('pureté de packages/domain', () => {
  it('contient des fichiers à vérifier', () => expect(files.length).toBeGreaterThan(0));

  it.each(files)('%s : ni horloge, ni aléa, ni node:', (f) => {
    const src = read(f);
    expect(src).not.toMatch(/\bDate\.now\s*\(/);
    expect(src).not.toMatch(/\bMath\.random\s*\(/);
    expect(src).not.toMatch(/new Date\(\s*\)/);
    expect(src).not.toMatch(/from ['"]node:/);
  });

  it('R-AGE-3 : hors age.ts, aucune règle ne lit la date de naissance', () => {
    for (const f of files.filter((n) => n !== 'age.ts')) {
      expect(read(f), f).not.toMatch(/birth_?date/i);
    }
  });
});

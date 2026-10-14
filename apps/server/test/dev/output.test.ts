import { describe, expect, it } from 'vitest';
import { createLinePrefixer } from '../../scripts/dev/output';

const collect = (): { written: string[]; write: (text: string) => void } => {
  const written: string[] = [];
  return { written, write: (text) => written.push(text) };
};

describe('createLinePrefixer', () => {
  it('préfixe chaque ligne complète, même coupée entre deux morceaux', () => {
    const { written, write } = collect();
    const p = createLinePrefixer('[web]', write);
    p.push('VITE prêt\nLocal: http://loc');
    expect(written).toEqual(['[web] VITE prêt\n']);
    p.push('alhost:5173/\r\n');
    expect(written).toEqual(['[web] VITE prêt\n', '[web] Local: http://localhost:5173/\n']);
  });

  it('rend la dernière ligne sans fin de ligne à la fermeture, et rien si tout est écrit', () => {
    const { written, write } = collect();
    const p = createLinePrefixer('[serveur]', write);
    p.push('a\nb');
    p.end();
    expect(written).toEqual(['[serveur] a\n', '[serveur] b\n']);
    p.end();
    expect(written).toHaveLength(2);
  });

  it('garde les lignes vides', () => {
    const { written, write } = collect();
    createLinePrefixer('[web]', write).push('\n\n');
    expect(written).toEqual(['[web] \n', '[web] \n']);
  });
});

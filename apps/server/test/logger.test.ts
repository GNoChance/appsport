import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger';

describe('createLogger', () => {
  it('écrit une ligne JSON et ignore les champs hors liste blanche', () => {
    const lines: string[] = [];
    const logger = createLogger((l) => lines.push(l));
    logger.info('x', { requestId: 'r1', secret: 'TEMOIN' } as never);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] as string);
    expect(line).toMatchObject({ level: 'info', msg: 'x', requestId: 'r1' });
    expect(typeof line.time).toBe('string');
    expect(Object.keys(line).sort()).toEqual(['level', 'msg', 'requestId', 'time']);
    expect(lines[0]).not.toContain('secret');
    expect(lines[0]).not.toContain('TEMOIN');
  });

  it('porte les niveaux warn et error', () => {
    const lines: string[] = [];
    const logger = createLogger((l) => lines.push(l));
    logger.warn('w');
    logger.error('e', { code: 'internal' });
    expect(lines.map((l) => JSON.parse(l).level)).toEqual(['warn', 'error']);
  });
});

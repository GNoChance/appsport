import { describe, expect, it } from 'vitest';
import {
  createServerWatch,
  parseServerStatus,
  serverExitLine,
  serverReadyLine,
} from '../../scripts/dev/server-status';

describe('lignes de service du serveur de dev', () => {
  it("s'écrivent et se relisent", () => {
    expect(parseServerStatus(serverReadyLine())).toEqual({ kind: 'ready' });
    expect(parseServerStatus(serverExitLine(1))).toEqual({ kind: 'exit', code: 1 });
    expect(parseServerStatus(serverExitLine(7))).toEqual({ kind: 'exit', code: 7 });
  });

  it('ignorent toute autre ligne, même proche', () => {
    expect(parseServerStatus('')).toBeNull();
    expect(parseServerStatus('{"level":"info","msg":"pret"}')).toBeNull();
    expect(parseServerStatus(`texte ${serverReadyLine()}`)).toBeNull();
    expect(parseServerStatus(`${serverReadyLine()} suite`)).toBeNull();
    expect(parseServerStatus(serverExitLine(1).replace('1', 'x'))).toBeNull();
  });
});

describe('createServerWatch', () => {
  it('une sortie avant le premier démarrage est un échec au démarrage : il faut tout arrêter', () => {
    const watch = createServerWatch();
    expect(watch({ kind: 'exit', code: 1 })).toBe('failed-at-start');
  });

  it('une sortie après un démarrage réussi attend la prochaine modification, puis le serveur repart', () => {
    const watch = createServerWatch();
    expect(watch({ kind: 'ready' })).toBe('started');
    expect(watch({ kind: 'exit', code: 1 })).toBe('crashed');
    expect(watch({ kind: 'exit', code: 1 })).toBe('crashed');
    expect(watch({ kind: 'ready' })).toBe('restarted');
    expect(watch({ kind: 'ready' })).toBe('started');
    expect(watch({ kind: 'exit', code: 2 })).toBe('crashed');
  });
});

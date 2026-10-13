import { afterEach, describe, expect, it } from 'vitest';
import type { PageToSw, SwStatus } from '../../src/sw/protocol';
import { getSwStatus, postToSw } from '../../src/sw/sw-client';

const STATUS: SwStatus = { type: 'STATUS', buildHash: 'b1', shellCached: true, illustrationsMissing: 2 };

function setController(controller: { postMessage(msg: PageToSw, transfer?: Transferable[]): void } | null) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller },
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('getSwStatus', () => {
  it('répond par le MessageChannel au message GET_STATUS', async () => {
    const received: PageToSw[] = [];
    setController({
      postMessage(msg, transfer) {
        received.push(msg);
        const port = transfer?.[0] as MessagePort;
        port.postMessage(STATUS);
      },
    });
    expect(await getSwStatus()).toEqual(STATUS);
    expect(received).toEqual([{ type: 'GET_STATUS' }]);
  });

  it('illustrationsReferenced : nombre ou null accepté, autre valeur refusée', async () => {
    let reply: unknown = null;
    setController({
      postMessage(_, transfer) {
        const port = transfer?.[0] as MessagePort;
        port.postMessage(reply);
      },
    });
    for (const referenced of [3, null]) {
      reply = { ...STATUS, illustrationsReferenced: referenced };
      expect(await getSwStatus()).toEqual(reply);
    }
    reply = { ...STATUS, illustrationsReferenced: '3' };
    expect(await getSwStatus()).toBeNull();
  });

  it('sans contrôleur : null, et postToSw rend false', async () => {
    setController(null);
    expect(await getSwStatus()).toBeNull();
    expect(postToSw({ type: 'SKIP_WAITING' })).toBe(false);
  });

  it('contrôleur muet : null après le délai', async () => {
    setController({ postMessage() {} });
    expect(await getSwStatus(50)).toBeNull();
  });
});

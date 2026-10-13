import { LOCAL_DB_VERSION } from '../../src/local-db/db';
import type { PageToSw, SwStatus } from '../../src/sw/protocol';
import type { SwContainerLike, SwRegistrationLike, SwWorkerLike } from '../../src/sw/register';

// `navigator.serviceWorker` factice, vu de la page : enregistrement, SW en attente, contrôleur et
// désenregistrements. Les SW factices répondent à GET_STATUS par le port du MessageChannel, comme T36.

export interface FakeSwWorker extends SwWorkerLike {
  /** Messages reçus de la page, dans l'ordre. */
  messages: PageToSw[];
  /** Vrai : ne répond pas à GET_STATUS (SW lent à réveiller ou en panne) ; modifiable en cours de test. */
  silent: boolean;
}

export interface FakeSwContainer {
  container: SwContainerLike;
  registration: SwRegistrationLike & { updateCalls: number };
  /**
   * Contrôleur présent (`true`, un nouvel objet à chaque appel) ou absent ; ses messages vont dans
   * `controllerMessages` (tous contrôleurs confondus) et dans sa propre entrée de `controllerHistory`.
   */
  setController(on: boolean): void;
  controllerMessages: PageToSw[];
  /** Messages reçus par chaque contrôleur, dans l'ordre où ils ont été installés. */
  controllerHistory: PageToSw[][];
  /**
   * Nouvelle version trouvée : `updatefound` avec le SW en `installing`, puis le SW passe en attente
   * (`installed`, `statechange`) ; l'ancien SW en attente devient `redundant`.
   * `localDbVersion` : LOCAL_DB_VERSION par défaut, `null` pour un SW antérieur au champ (réponse à
   * GET_STATUS sans `localDbVersion`) ; `silent` : ne répond pas à GET_STATUS (voir `FakeSwWorker.silent`).
   */
  installUpdate(o?: FakeWorkerOptions): FakeSwWorker;
  fireControllerChange(): void;
  /**
   * Le SW en attente est activé par une autre fenêtre (clic sur « Mettre à jour ») : il quitte l'attente
   * (`activating`) et prend le contrôle de la page (`controllerchange`).
   */
  activateWaiting(): void;
  /** Appels à `unregister()` sur les enregistrements rendus par `getRegistrations()`. */
  unregisterCalls: number;
}

interface FakeWorkerOptions {
  localDbVersion?: number | null;
  silent?: boolean;
}

function createWorker(state: string, o: FakeWorkerOptions = {}) {
  const listeners: (() => void)[] = [];
  const worker: FakeSwWorker & { setState(s: string): void } = {
    state,
    messages: [],
    silent: o.silent ?? false,
    postMessage(m, transfer) {
      worker.messages.push(m);
      if (m.type !== 'GET_STATUS' || worker.silent) return;
      const port = transfer?.[0] as MessagePort | undefined;
      const status: SwStatus = {
        type: 'STATUS',
        buildHash: 'bbbbbbbbbbbb',
        shellCached: true,
        illustrationsMissing: 0,
        illustrationsReferenced: null,
      };
      if (o.localDbVersion !== null) status.localDbVersion = o.localDbVersion ?? LOCAL_DB_VERSION;
      port?.postMessage(status);
    },
    addEventListener(_type, fn) {
      listeners.push(fn);
    },
    setState(s) {
      worker.state = s;
      for (const fn of listeners) fn();
    },
  };
  return worker;
}

/**
 * `controller` : la page est contrôlée (faux par défaut) ; `waiting` : un SW de LOCAL_DB_VERSION attend
 * déjà ; `registrations` : enregistrements vus par `getRegistrations()` (1 par défaut), retirés une fois
 * désenregistrés.
 */
export function createFakeSwContainer(
  o: { controller?: boolean; waiting?: boolean; registrations?: number } = {},
): FakeSwContainer {
  const controllerChange: (() => void)[] = [];
  const updateFound: (() => void)[] = [];
  let waiting: ReturnType<typeof createWorker> | null = o.waiting ? createWorker('installed') : null;
  let controller: { postMessage(m: PageToSw): void } | null = null;

  const registration: FakeSwContainer['registration'] = {
    get waiting() {
      return waiting;
    },
    installing: null,
    updateCalls: 0,
    async update() {
      registration.updateCalls++;
    },
    addEventListener(_type, fn) {
      updateFound.push(fn);
    },
  };

  let registrations = Array.from({ length: o.registrations ?? 1 }, () => {
    const entry = {
      async unregister() {
        fake.unregisterCalls++;
        registrations = registrations.filter((r) => r !== entry);
        return true;
      },
    };
    return entry;
  });

  const fake: FakeSwContainer = {
    container: {
      get controller() {
        return controller;
      },
      register: async () => registration,
      getRegistrations: async () => [...registrations],
      addEventListener(_type, fn) {
        controllerChange.push(fn);
      },
    },
    registration,
    controllerMessages: [],
    controllerHistory: [],
    setController(on) {
      if (!on) {
        controller = null;
        return;
      }
      const own: PageToSw[] = [];
      fake.controllerHistory.push(own);
      controller = {
        postMessage: (m) => {
          own.push(m);
          fake.controllerMessages.push(m);
        },
      };
    },
    installUpdate(opts = {}) {
      const worker = createWorker('installing', opts);
      registration.installing = worker;
      for (const fn of updateFound) fn();
      const previous = waiting;
      registration.installing = null;
      waiting = worker;
      worker.setState('installed');
      previous?.setState('redundant');
      return worker;
    },
    fireControllerChange() {
      for (const fn of controllerChange) fn();
    },
    activateWaiting() {
      const worker = waiting;
      if (!worker) return;
      waiting = null;
      worker.setState('activating');
      fake.setController(true);
      fake.fireControllerChange();
    },
    unregisterCalls: 0,
  };
  fake.setController(o.controller ?? false);
  return fake;
}

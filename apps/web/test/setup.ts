import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false` : Testing Library ne peut pas enregistrer son nettoyage lui-même.
afterEach(() => {
  cleanup();
});

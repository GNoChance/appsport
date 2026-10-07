import { MIN_AGE } from '@appsport/contracts';
import { expect, it } from 'vitest';

it('résout @appsport/contracts depuis le serveur', () => {
  expect(MIN_AGE).toBe(16);
});

import { MIN_AGE } from '@rune/contracts';
import { expect, it } from 'vitest';

it('résout @rune/contracts depuis le serveur', () => {
  expect(MIN_AGE).toBe(16);
});

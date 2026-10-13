import { MIN_AGE } from '@rune/contracts';
import { expect, it } from 'vitest';

it('résout @rune/contracts depuis le web et fournit un DOM', () => {
  expect(MIN_AGE).toBe(16);
  expect(typeof document.createElement).toBe('function');
});

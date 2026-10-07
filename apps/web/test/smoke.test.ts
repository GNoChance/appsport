import { MIN_AGE } from '@appsport/contracts';
import { expect, it } from 'vitest';

it('résout @appsport/contracts depuis le web et fournit un DOM', () => {
  expect(MIN_AGE).toBe(16);
  expect(typeof document.createElement).toBe('function');
});

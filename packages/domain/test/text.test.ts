import { describe, expect, it } from 'vitest';
import { normalize } from '../src/text';

describe('normalize (R-SAL-3)', () => {
  it.each([
    ['Basic-Fit  Lyon Part-Dieu', 'basic fit lyon part dieu'],
    ['Salle Énergie', 'salle energie'],
    ["L'Orange Bleue — Saint-Étienne", 'l orange bleue saint etienne'],
    ['  Fitness   Park!! ', 'fitness park'],
    ['Crossfit 69', 'crossfit 69'],
    ['', ''],
  ])('%s → %s', (i, o) => expect(normalize(i)).toBe(o));
});

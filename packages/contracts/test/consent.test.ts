import { describe, expect, it } from 'vitest';
import { HealthScreeningRequest, LimitationInput, LimitationPatch } from '../src/api/consent';
import { HEALTH_QUESTIONNAIRE } from '../src/texts';

describe('HealthScreeningRequest', () => {
  it('attend exactement une réponse par question de HEALTH_QUESTIONNAIRE', () => {
    const n = HEALTH_QUESTIONNAIRE.questions.length;
    const answers = (k: number) => Array.from({ length: k }, () => false);
    const parse = (k: number) =>
      HealthScreeningRequest.safeParse({ answers: answers(k), questionnaireVersion: '1.0' }).success;
    expect(parse(n)).toBe(true);
    expect(parse(n - 1)).toBe(false);
    expect(parse(n + 1)).toBe(false);
  });
});

describe('note de limitation', () => {
  it('une note vide ou faite d’espaces devient null', () => {
    const base = { bodyArea: 'knee', side: 'left', severity: 'mild' } as const;
    expect(LimitationInput.parse({ ...base, note: '   ' }).note).toBeNull();
    expect(LimitationInput.parse({ ...base, note: '' }).note).toBeNull();
    expect(LimitationInput.parse({ ...base, note: '  gêne  ' }).note).toBe('gêne');
    expect(LimitationPatch.parse({ note: ' \t ' }).note).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  SPORT_CODES,
  SPORT_OTHER_LABEL_MAX,
  SPORTS,
  SPORTS_LIST_VERSION,
  SportCodeSchema,
} from '../src/sports';
import { HEALTH_CONSENT_TEXT, HEALTH_QUESTIONNAIRE, majorOf } from '../src/texts';

describe('sports', () => {
  it('liste 15 sports figés', () => {
    expect(SPORTS).toHaveLength(15);
    expect(SPORTS.map((s) => s.code)).toEqual([...SPORT_CODES]);
    expect(SPORTS.map((s) => [s.code, s.label])).toEqual([
      ['running', 'Course à pied'],
      ['cycling', 'Vélo'],
      ['swimming', 'Natation'],
      ['football', 'Football'],
      ['rugby', 'Rugby'],
      ['basketball', 'Basket'],
      ['handball', 'Handball'],
      ['tennis', 'Tennis'],
      ['padel', 'Padel'],
      ['badminton', 'Badminton'],
      ['combat_sports', 'Sports de combat'],
      ['climbing', 'Escalade'],
      ['skiing', 'Ski'],
      ['dance', 'Danse'],
      ['other', 'Autre'],
    ]);
    expect(SPORTS_LIST_VERSION).toBe(1);
    expect(SPORT_OTHER_LABEL_MAX).toBe(40);
    expect(SportCodeSchema.safeParse('golf').success).toBe(false);
    expect(SportCodeSchema.safeParse('padel').success).toBe(true);
  });
});

describe('textes versionnés', () => {
  it('consentement santé', () => {
    expect(HEALTH_CONSENT_TEXT.version).toBe('1.0');
    expect(HEALTH_CONSENT_TEXT.text).toBe(
      "J'accepte qu'appsport enregistre mes données de santé : limitations et zones sensibles, réponses de prudence, douleurs signalées pendant les séances, taille, poids, profil et suivi nutritionnels. Elles servent uniquement à adapter mes séances et mes repères. Elles restent sur le serveur du cercle et l'administrateur ne les consulte pas dans l'appli. Je peux retirer cet accord à tout moment : elles seront alors supprimées.",
    );
    expect(HEALTH_CONSENT_TEXT.text).toMatch(/^J'accepte qu'appsport enregistre mes données de santé/);
    expect(HEALTH_CONSENT_TEXT.text).toMatch(/elles seront alors supprimées\.$/);
    expect(HEALTH_CONSENT_TEXT.text).not.toContain('’');
  });

  it('questionnaire de prudence', () => {
    expect(HEALTH_QUESTIONNAIRE.version).toBe('1.0');
    expect(HEALTH_QUESTIONNAIRE.questions).toHaveLength(4);
    expect([...HEALTH_QUESTIONNAIRE.questions]).toEqual([
      'As-tu un problème cardiaque connu, ou pratiques-tu une activité physique sous surveillance médicale ?',
      'As-tu ressenti une douleur à la poitrine pendant un effort, ou perdu connaissance, au cours des 12 derniers mois ?',
      'As-tu une maladie ou un traitement qui limite ton activité physique ?',
      "As-tu un problème d'os, d'articulation ou de muscle qui s'aggrave à l'effort ?",
    ]);
    for (const q of HEALTH_QUESTIONNAIRE.questions) {
      expect(q.endsWith('?')).toBe(true);
      expect(q).not.toContain('’');
    }
  });

  it('majorOf extrait la version majeure', () => {
    expect(majorOf('1.2')).toBe(1);
    expect(majorOf('12.0')).toBe(12);
    expect(() => majorOf('abc')).toThrow();
    expect(() => majorOf('1')).toThrow();
  });
});

export interface VersionedText {
  readonly version: string;
  readonly text: string;
}

export const HEALTH_CONSENT_TEXT: VersionedText = {
  version: '1.0',
  text: "J'accepte qu'appsport enregistre mes données de santé : limitations et zones sensibles, réponses de prudence, douleurs signalées pendant les séances, taille, poids, profil et suivi nutritionnels. Elles servent uniquement à adapter mes séances et mes repères. Elles restent sur le serveur du cercle et l'administrateur ne les consulte pas dans l'appli. Je peux retirer cet accord à tout moment : elles seront alors supprimées.",
};

// À faire relire par l'admin avant la mise en service (ce qui changera la version).
export const HEALTH_QUESTIONNAIRE = {
  version: '1.0',
  questions: [
    'As-tu un problème cardiaque connu, ou pratiques-tu une activité physique sous surveillance médicale ?',
    'As-tu ressenti une douleur à la poitrine pendant un effort, ou perdu connaissance, au cours des 12 derniers mois ?',
    'As-tu une maladie ou un traitement qui limite ton activité physique ?',
    "As-tu un problème d'os, d'articulation ou de muscle qui s'aggrave à l'effort ?",
  ],
} as const;

const VERSION = /^\d+\.\d+$/;

export function majorOf(version: string): number {
  if (!VERSION.test(version)) throw new RangeError(`version invalide : ${version}`);
  return Number(version.split('.')[0]);
}

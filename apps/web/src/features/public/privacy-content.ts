import { HEALTH_WARNING_TEXT } from '../../ui/HealthWarning';

/** Prénom du porteur (variable de build), sinon « l'administrateur ». */
export const OWNER_FIRST_NAME: string = import.meta.env.VITE_OWNER_FIRST_NAME?.trim() || "l'administrateur";

export interface PrivacySection {
  title: string;
  items: readonly string[];
}

/**
 * Page « Confidentialité et règles » (03 §13.5), tirée de la fiche de traitement. Toute
 * modification de fond change `PRIVACY_POLICY_VERSION`.
 */
export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    title: 'Qui est responsable',
    items: [
      `appsport est un outil de suivi entre proches, hébergé chez ${OWNER_FIRST_NAME}. Ce n'est pas un service médical.`,
      "Le responsable des données est l'administrateur du cercle, qui héberge le serveur chez lui, à titre personnel et sans but lucratif. Toute question ou demande lui est adressée directement.",
    ],
  },
  {
    title: 'Données collectées et pourquoi',
    items: [
      "Compte : pseudo, rôle, date de naissance saisie par l'administrateur (c'est la vérification de l'âge), état de tes accords. Ils servent à te connecter et à appliquer les règles d'âge.",
      "Données personnelles : profil d'entraînement, lieux et matériel, mode prudent, séances et réglages, historique de tes accords. Elles servent à construire et suivre ton entraînement, et toi seul y accèdes.",
      'Données de santé, seulement avec ton accord santé : indicateur de prudence issu du questionnaire, limitations et zones sensibles, douleurs signalées, mesures et nutrition. Elles servent uniquement à adapter tes séances et tes repères.',
      'Échanges avec le coach, seulement avec ton accord coach (brique 4) : conversations et signalements.',
      "Commun au cercle : salles partagées et leur historique, pseudos rendus visibles, fiches d'exercices.",
      "Aucune statistique, aucun traceur ni service tiers dans l'appli : pas de bandeau cookies.",
    ],
  },
  {
    title: 'Où sont les données',
    items: [
      'Sur un serveur à domicile en France, chiffré au repos, joignable seulement par le réseau privé Tailscale du cercle, jamais depuis Internet.',
      "Aux États-Unis pour le coach (brique 4) : avec ton accord coach seulement, tes messages et les informations utiles sont envoyés à Anthropic, qui fournit l'IA Claude.",
      "Dans des sauvegardes chiffrées hors du domicile (Backblaze), chiffrées avant de quitter le serveur ; seul l'administrateur en détient les clés.",
      "Sur ton téléphone : une copie de tes données, pour utiliser l'appli sans réseau.",
    ],
  },
  {
    title: 'Durées de conservation',
    items: [
      'Compte et données personnelles : tant que le compte existe.',
      "Données de santé : tant que le compte existe et que l'accord santé est actif ; elles sont supprimées dès le retrait de l'accord.",
      'Conversations du coach : 90 jours après le dernier message, et suppression possible à tout moment ; signalements : 90 jours au plus.',
      "Journal d'usage du coach, sans contenu : 12 mois. Côté Anthropic : 30 jours au plus, 2 ans au plus si un échange est signalé par ses filtres.",
      'Sessions de connexion : 90 jours sans usage, 365 jours au maximum ; les sessions fermées sont purgées 30 jours après.',
      'Invitations et liens de réinitialisation : 7 jours et 24 h, usage unique ; purgés 30 jours après.',
      'Journal de sécurité : 12 mois. Journaux techniques : 90 jours au plus.',
      'Marques de suppression de la synchronisation : 90 jours.',
      'Sauvegardes : 30 jours au plus.',
      "Données du téléphone : jusqu'à la déconnexion, au retrait d'un accord pour les données concernées, ou à la suppression du compte.",
    ],
  },
  {
    title: "Ce que l'administrateur voit et ne voit pas",
    items: [
      'Il voit les informations de compte : pseudo, rôle, statut, date de naissance, mineur ou non, création et dernière connexion, état des accords, nombre de sessions actives. Il gère les invitations, les salles et le journal de sécurité.',
      "Il ne voit pas dans l'appli ton profil, tes séances, tes lieux, tes données de santé ni tes conversations avec le coach. Il ne peut ni se connecter à ta place, ni exporter tes données, ni connaître ton mot de passe.",
      'Il lit un échange avec le coach seulement si tu le signales toi-même.',
      "L'administrateur a la main sur le serveur et peut techniquement lire la base. Il s'engage à ne faire aucune requête manuelle sur les données d'une personne sans son accord.",
      "L'administrateur voit l'adresse de ton compte Tailscale, une information gérée par Tailscale.",
    ],
  },
  {
    title: 'Tes droits et comment les exercer',
    items: [
      'Export : Profil, puis Confidentialité, puis « Télécharger mes données » (fichier JSON).',
      "Rectification : tout ce que tu saisis est modifiable, sauf ta date de naissance, que l'administrateur corrige à ta demande.",
      "Retrait d'un accord : à tout moment, depuis ton profil ; les données concernées sont effacées immédiatement.",
      "Suppression du compte : depuis ton profil, ou par l'administrateur à ta demande ; tout est effacé en une fois.",
      "Pour toute autre demande, adresse-toi à l'administrateur.",
    ],
  },
  {
    title: 'Règles pour les 16-17 ans',
    items: [
      "appsport est réservé aux 16 ans et plus. Ta date de naissance est saisie par l'administrateur et tu ne peux pas la modifier.",
      "Dès 15 ans, tu donnes seul tes accords : aucun accord parental n'est demandé.",
      "La progression prudente s'applique jusqu'à 18 ans.",
      'Ta présence dans « qui va à cette salle » est désactivée par défaut, lieu par lieu.',
      'Nutrition : ni cible chiffrée, ni déficit, ni pesée.',
      "À 18 ans, rien ne s'active tout seul : un message t'indique ce que tu peux activer.",
    ],
  },
  {
    title: 'Pas un avis médical',
    items: [
      HEALTH_WARNING_TEXT,
      "En cas d'urgence, appelle le 15 ou le 112. Les numéros utiles sont sur la page Aide.",
    ],
  },
  {
    title: 'Coach et mineurs',
    items: [
      "Le coach (brique 4) est une IA, annoncée au début de chaque conversation. Il est ouvert aux 16-17 ans avec des garde-fous : le mode mineur est décidé par le serveur d'après ta tranche d'âge.",
      "Envoyés : ta tranche d'âge (jamais ton âge exact), ton niveau, ton objectif, ton matériel, ton programme et ton historique récent ; tes données de santé seulement si les accords santé et coach sont actifs.",
      'Jamais envoyés : ton pseudo, ta date de naissance, ton identifiant, le nom de ta salle, les autres membres.',
      "Pour un mineur : consignes dédiées, aucun chiffre nutritionnel, réponses contrôlées par l'appli.",
      "Un bouton « Signaler » accompagne chaque réponse : l'échange signalé devient lisible par l'administrateur, puis il est supprimé à son classement ou au plus tard après 90 jours.",
    ],
  },
];

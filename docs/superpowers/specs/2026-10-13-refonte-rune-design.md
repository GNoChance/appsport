# Refonte Rune du socle (design)

> Spec de la refonte du front du socle et de la revue finale qui l'accompagne. Elle complète la spec principale (`2026-10-06-appsport-design.md`) sans la remplacer : en cas de conflit sur le front du socle, cette spec l'emporte ; partout ailleurs, la spec principale fait foi. Les décisions datées viennent du propriétaire (2026-10-12 et 2026-10-13) ; les arbitrages marqués *(technique)* sont pris par Claude selon la règle convenue.
>
> Maquettes de référence : canvas « Refonte Rune » (https://claude.ai/artifact/BYHuxNYMxju2KK7p2onvPk), copie locale `C:\Users\eliott.colin\appsport-local\maquettes`. Prototype animé : `appsport-local\prototype\rune-proto.html`. Logos, avatars et rangs : `docs/brand/` et `appsport-local\brand\`.

## 1. But

Faire du socle une vraie appli, avec du caractère et de la vie, prête pour la mise en production : identité Rune, thèmes, navigation d'appli, composants cohérents, animations utiles, choix du coach dès le début, onglet Progression en avant-goût. En parallèle, finir la revue du socle pour qu'une seule PR `socle` → `main` soit prête pour la prod.

Réussi = en ouvrant Rune sur son téléphone, on a l'impression d'une appli soignée et cohérente avec le logo, et un proche s'y retrouve sans explication.

## 2. Périmètre

**Dans la refonte :** tous les écrans existants du socle (accès, onboarding, accueil, profil, lieux et salles, santé, confidentialité, réglages, administration, pages publiques, états hors ligne et erreurs), plus :

- l'étape « Choisis ton coach » au début de l'onboarding et la bulle de présentation ;
- l'onglet Progression en avant-goût ;
- l'espace Profil, qui remplace l'ancien menu ;
- l'écran « Mon coach » ;
- le choix de l'apparence.

**Hors refonte (briques suivantes) :** séances, XP réelle, rangs calculés, quêtes réelles, carte de partage, photos de progression, coach IA (conversation), module nutrition, bouton central « Séance ». La navigation et le style leur gardent la place, sans écran factice.

## 3. Identité

- Nom affiché : **Rune** partout (titre, manifeste PWA `name` et `short_name`, pages, textes). Le code, les paquets (`@appsport/…`), le dépôt et les chemins serveur gardent le nom de code `appsport`.
- Slogan : « Grave ta progression. »
- Logo « Rang brisé » : `docs/brand/rune-mark.svg`, `rune-mark-mono.svg`, `rune-icon.svg`, `rune-wordmark.svg`, `rune-wordmark-ink.svg`. Icônes PWA (192, 512, maskable 512, apple-touch 180) et favicon régénérées depuis `rune-icon.svg`, en PNG versionnés dans `apps/web/public/icons/`. `theme-color` suit le thème.
- Texte du consentement santé : « appsport » devient « Rune » sans changer de version (1.0), car l'appli n'est utilisée par personne avant la mise en production *(technique)*.

## 4. Thèmes et typographie (décision 2026-10-12)

| Choix (Profil › Réglages › Apparence) | Rendu |
|---|---|
| Auto (défaut) | Le mélange, clair ou sombre selon le réglage du téléphone (`prefers-color-scheme`) |
| Clair | Le mélange en clair |
| Sombre | Le mélange en sombre |
| Carnet (bonus) | Papier crème, lignes de cahier, marge rouge, encre ; titres en Newsreader |
| Salle de nuit (bonus) | Néon pur, cadres HUD, fond nuit du logo |

- **Le mélange** est la direction validée : cartes arrondies aérées, barre d'onglets flottante en pilule, Chakra Petch pour titres, chiffres, rangs et voix du Système, Barlow pour le texte, dégradé bleu glacé → violet du logo. Les jetons de couleur sont ceux du guide des maquettes (`GUIDE.md`).
- Le choix est gardé **sur l'appareil** (pas de synchro, pas de colonne serveur). Il s'applique avant le premier rendu React ; « Auto » passe par les media queries CSS, donc sans flash *(technique)*.
- Polices **embarquées** (la CSP n'autorise que `'self'`) : Chakra Petch 600/700, Barlow 400/500/600, Newsreader 600 (Carnet seulement), en woff2 sous-ensemble latin, via les paquets Fontsource, et précachées par le service worker *(technique)*.
- Les jetons vivent dans une seule source. Un test automatique vérifie, pour chaque thème, les contrastes WCAG des paires texte/fond déclarées : 4,5:1 pour le texte et 3:1 pour les grands textes et les éléments d'interface.
- Les éléments communs à tous les thèmes ne bougent pas : logo, mot RUNE, disposition, textes. Seuls l'ambiance et les décors changent : lignes du Carnet, coins HUD de la Salle de nuit.

## 5. Coquille et navigation (décisions 2026-10-12 et 2026-10-13)

- **Barre d'onglets du socle :** Accueil · Progression · Salles · Profil. Sur téléphone, elle flotte en pilule ; la pastille de l'onglet actif glisse d'un onglet à l'autre ; l'onglet actif porte `aria-current="page"`. À la brique 5, Nutrition prend la place de Salles, qui passe dans Profil › Mes lieux. À la brique 3, un bouton central « Séance » s'ajoute.
- **Sur PC** (largeur ≥ 900 px) : navigation latérale avec les mêmes entrées, contenu centré limité à environ 960 px *(technique)*.
- **En-tête de l'accueil :** logo et RUNE, pastille d'état de connexion compacte, rond avec l'initiale vers le Profil. Les pages internes ont un bouton Retour (44 × 44) et un titre. L'état de connexion a une seule source de vérité : plus jamais « En ligne » quand la page dit « Nécessite le réseau ».
- **L'espace Profil** remplace « Plus ». Il contient l'en-tête (avatar, pseudo, rôle) et des lignes groupées :
  - Entraînement : Mon profil, Mon coach, Mes lieux, Santé ;
  - Compte et appli : Confidentialité et données, Réglages (avec un badge quand il y a des refus de synchro), Aide ;
  - Cercle : Administration, pour l'admin seulement ;
  - « Se déconnecter » à part, en bas.

  « Crédits » passe dans Aide.
- **Les compteurs de l'ancien en-tête** (en attente, refusés) passent dans Réglages › Synchronisation.
- **La bannière de mise à jour** se place sous l'en-tête. La variante forcée (426) n'a pas de « Plus tard ».

## 6. Boîte à outils (composants)

Un seul système, dans `apps/web/src/ui/`, utilisé par tous les écrans :

- **Bouton :** principal, secondaire, discret, danger. Hauteur 52, pleine largeur sur téléphone. L'état désactivé se voit. Une action dangereuse est toujours isolée en bas, jamais à côté d'un principal.
- **Champ :** libellé au-dessus, aide en dessous, erreur attachée au champ avec une icône. Texte en 16 px, pour éviter le zoom sur iOS.
- **Formes de choix :**
  - carte de choix (unique ou multiple), avec icône, titre et description ; sélectionnée, elle a un bord accent, une teinte et une coche ;
  - pastilles (chips) pour les choix courts ;
  - interrupteur.
- **Barre de progression segmentée** de l'onboarding, avec « Étape n sur 9 ».
- **Fenêtre du Système** (la voix du Système) et **bulle du coach** (avatar animé, étiquette « Aujourd'hui », « Aperçu » ou « Message d'accueil »).
- **États et listes :** état vide (icône, phrase, action), ligne de liste (icône, libellé, valeur, chevron, regroupée en carte), badges (rôle, statut, rang en pierre runique), bannière (info, avertissement, erreur).
- **Feuille du bas** (bottom sheet) pour les dialogues sur téléphone, avec poignée, fond assombri, actions empilées et focus piégé.
- **En-tête de page**, **barre d'onglets** et **navigation latérale**.

Les rôles, noms accessibles et libellés associés existants sont conservés : les tests s'appuient sur les rôles et les textes, pas sur le style.

## 7. Animations (décision 2026-10-13 : « plus de vie »)

- **Durées :**
  - 150 à 250 ms pour le retour d'un geste ;
  - 300 à 450 ms pour un changement d'écran ;
  - 600 à 1 200 ms seulement pour les célébrations.

  Une seule courbe, `cubic-bezier(.2,.8,.2,1)`.
- **Changement d'écran :** l'écran suivant entre par la droite, le retour par la gauche, et un changement d'onglet se fait en fondu.
- **Animations prévues :**
  - les cartes entrent en cascade ;
  - un choix fait un petit ressort ;
  - les compteurs défilent ;
  - les barres se remplissent ;
  - la pastille d'onglet glisse ;
  - les avatars ont une animation de repos discrète (respiration, clignement, visière) ;
  - le logo se dessine au démarrage.
- **Célébration « Éveil terminé »** en fin d'onboarding : la fenêtre du Système s'ouvre, le badge de rang E se grave, les 3 quêtes se cochent une à une avec quelques étincelles, et le coach dit un mot court.
- **Mouvement réduit :** `prefers-reduced-motion` remplace tout par des fondus simples, sans étincelles ni balayage. Aucune information ne passe uniquement par une animation.
- **Référence :** `rune-proto.html` montre le comportement attendu.

## 8. Coachs (décision 2026-10-13)

| Coach | Avatar | Tempérament |
|---|---|---|
| L'Ombre | Entité du Système (casque, visière glacée ; nutrition : visière or et épi) | Froid, laconique, exigeant, jamais humiliant |
| Le Skald | Personnage (barde encapuchonné, yeux lumineux ; nutrition : pomme d'or) | Mentor chaleureux, raconte et explique |
| Le Scribe | Emblème (plume dans le badge ; nutrition : épi de blé) | Calme, précis, aime les plans et les bilans |

- **Choix :** première étape de l'onboarding, « Choisis ton coach » (étape 1 sur 9), avant l'objectif. On le modifie ensuite dans Profil › Mon coach, via une feuille du bas.
- **Présentation :** après le choix, l'avatar grandit, une bulle tape sa présentation, puis une courte démonstration du mode nutrition s'affiche. Le bouton est « C'est parti ».
- **Où il parle :** le coach a une ligne du jour sur l'accueil et un mot à la fin de l'onboarding.
- **Les bulles sont des textes écrits à l'avance**, par coach et par moment ; ce ne sont pas des réponses d'IA. Elles portent une étiquette et ne simulent jamais une conversation : pas d'indicateur « en train d'écrire ». Mon coach précise que la vraie conversation arrivera plus tard.
- **Le texte de départ** est celui du prototype, relu et validé dans le plan.
- **Le choix est stocké sur le serveur**, pour suivre l'utilisateur sur ses appareils : nouvelle colonne `coach` (`ombre` | `skald` | `scribe`) sur le profil d'entraînement, posée par une migration, synchronisée comme le reste du profil.
- **Le choix fait partie de l'onboarding :** `ONBOARDING_STEPS` gagne `coach` en premier. Une reprise d'onboarding reprend à cette étape si le coach n'est pas choisi. C'est une donnée C0, une préférence, pas une donnée de santé.
- **Garde-fous du coach** (spec 06) : aucun chiffre nutritionnel dans une bulle, rien qui pousse à forcer sur une douleur, vocabulaire non prescriptif. Ils s'appliquent dès ces textes.
- **Avatars :** SVG des trois directions (`appsport-local\brand\skald\`), versions claire et sombre, en composants React générés au moment du développement, avec les identifiants préfixés par instance et sans `dangerouslySetInnerHTML` *(technique)*.

## 9. Rangs et onglet Progression (décisions 2026-10-12 et 2026-10-13)

- Les rangs suivent le jeu « Pierre runique » :
  - E galet griffé ;
  - D pierre taillée ;
  - C dalle bordée ;
  - B pierre levée (ocre) ;
  - A pierre runique (serpent, incrustation glacée) ;
  - S monolithe éveillé.
- SVG et versions mini (24–32 px) dans `appsport-local\brand\rangs\pierre\`.
- **Progression en avant-goût, dès le socle :**
  - rang global E avec une barre d'XP à 0, sans valeur inventée (juste un reflet) ;
  - compteurs à 0 : séances, kg soulevés, semaines d'assiduité ;
  - les 9 groupes musculaires au rang E ;
  - la fenêtre du Système : « Aucune séance gravée. Ta première séance débloque tes rangs. »
- Le calcul réel arrive avec la brique 3.

## 10. Écrans

Les maquettes du canvas font foi pour la mise en page (rangées 2 à 7 et rangée 8). Changements de comportement à appliquer, tranchés *(technique/UX)* sauf mention contraire :

1. **Onboarding :** 9 étapes : coach, objectif, sport, type de lieu, lieu, niveau, disponibilité, santé, prêt. Le bouton d'avancée devient « Continuer », et les tests sont mis à jour. L'écran Santé garde ses textes légaux mot pour mot, sans voix du Système.
2. **Accueil :** la bulle du coach, la carte « Quêtes d'éveil » (vrais états : profil complété, lieu principal choisi, prêt hors ligne), les tuiles lieu principal et rythme, la ligne objectif et niveau. Pas de fausse donnée.
3. **Salles :**
   - toucher une salle ouvre directement sa fiche, sans écran intermédiaire ;
   - sur la fiche, la case « Qui va à cette salle » porte l'interrupteur de visibilité de l'utilisateur ;
   - les actions du lieu (lieu principal, supprimer) sont en bas de la fiche ;
   - l'équipement est modifié **en brouillon** et enregistré d'un coup (« Enregistrer » / « Annuler », avec le nombre de changements) ; les appels d'ajout et de retrait partent à l'enregistrement ;
   - les pastilles d'équipement utilisent des libellés courts, via une table de libellés courts dans `packages/contracts` ;
   - l'interrupteur « Lieu principal » est verrouillé sur le lieu principal actuel, puisque l'API ne sait pas l'enlever.
4. **Profil :**
   - le mot de passe, le pseudo et les limitations s'ouvrent depuis une ligne au lieu d'être toujours affichés ;
   - le mode prudent n'est que dans Mon profil ;
   - le retrait de l'accord santé est dans Santé, et Confidentialité en montre l'état avec un lien ;
   - la déconnexion est une seule ligne, et le choix « cet appareil » ou « tous mes appareils » se fait dans la feuille.
5. **Administration :**
   - une carte par membre, avec badges de rôle, de statut et d'accord, et dernière connexion en temps relatif ;
   - toutes les actions dans une feuille « ⋯ », les actions sensibles regroupées en bas en danger ;
   - sous-navigation Membres · Invitations · Salles · Serveur ;
   - un membre désactivé reste réactivable.
6. **Aide :** l'encadré d'urgence (15 / 112) d'abord, puis le guide d'installation (aujourd'hui dans `install-help.ts`), puis les numéros utiles et les Crédits.
7. **404 et hors ligne :** voix du Système (« Zone inconnue. »). Les pages Aide, Confidentialité et Crédits restent lisibles hors ligne.

## 11. Revue finale du socle (en parallèle, décision 2026-10-13)

À appliquer dans la même branche, pour que la PR soit prête pour la prod :

1. **Décisions de confidentialité du 2026-10-12 :**
   - la fiche de traitement et la page Confidentialité mentionnent l'enveloppe de secours scellée (T45-F32) ;
   - P9 efface les sauvegardes après un dernier export (T45-F42) ;
   - `admin:reset` réactive un admin désactivé, avec un test (T45-F51).
2. **Adresse définitive** `https://rune.<tailnet>.ts.net` : machine Tailscale `rune` dans les procédures P1 à P9 et leurs tests. Les chemins `/srv/appsport` et le projet compose ne changent pas.
3. **Remarques mineures reportées** de T30 à T45 (listées dans `progress.md`) : chacune est corrigée, ou fermée avec une raison écrite.
4. **Tests instables** (profil, retrait du consentement, fiche de lieu) : ils deviennent déterministes, en attendant explicitement la fin des requêtes `liveQuery`.
5. **T38-F3 :** aucun lien ni code d'invitation dans les journaux ni les traces de la CI (masquage dans le harnais E2E).
6. **Deux points pour le propriétaire**, avec une réponse par défaut si rien n'est dit :
   - T43-F14 : un déploiement raté au téléchargement ou à la sauvegarde apparaît sur la page santé, avec `ok: false` et la même version (défaut : oui) ;
   - l'avertissement santé reste en « vous », mot pour mot (défaut).

## 12. Tests et qualité

- Tous les tests existants restent verts : les textes changés sont mis à jour dans les tests, avec leur commit.
- **Nouveaux tests :**
  - choix et application du thème ;
  - barre d'onglets (`aria-current`, navigation au clavier) ;
  - étape coach et reprise d'onboarding ;
  - migration `coach` ;
  - brouillon d'équipement ;
  - contrastes des jetons ;
  - mouvement réduit (aucune animation bloquante) ;
  - feuille du bas (piège du focus, Échap).
- **E2E :** les parcours existants sont adaptés (Chromium et WebKit), et un parcours ajouté (choix du coach jusqu'à « Éveil terminé »).
- **Captures pour la relecture :** un script Playwright prend chaque écran en clair et en sombre à 390 × 844. Les captures sont jointes au rapport de la tâche, sans assertion au pixel.
- **Performance :** le bundle initial ne grossit pas de plus de 25 % hors polices. Les polices et avatars sont précachés.

## 13. Exécution

- **Branche `socle`.** Plan découpé en tâches par zone, chaque tâche suivie du flux habituel : implémentation TDD, relecture sous plusieurs angles, contre-expertise, corrections.
- **5 agents** en parallèle au plus (demande du propriétaire). L'ordre : les fondations d'abord (jetons, polices, composants, coquille), puis les écrans en parallèle par zone, avec la revue finale dans une file à part.
- **À la fin :**
  - suite complète (unitaires, bats, E2E) ;
  - captures de tous les écrans pour une relecture visuelle par le propriétaire ;
  - puis la PR `socle` → `main` et la CI.

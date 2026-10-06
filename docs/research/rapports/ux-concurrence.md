# Applis existantes et UX de saisie en salle : benchmark (Hevy, Strong, Boostcamp, Fitbod, JEFIT, open source, nutrition, chaînes FR), périmètre MVP, onboarding et « ma salle » (données ouvertes)

# Applis existantes et UX de saisie en salle (au 06/10/2026)

Légende : [V] vérifié (source primaire, API ou code) ; [T] source tierce ; [D] déduction.

## 1. Les références

| Appli | Prix 2026 | Forces | Faiblesses |
|---|---|---|---|
| Hevy | Gratuit : séances illimitées, 4 routines, 3 mois de graphiques ([SensAI](https://www.sensai.fit/blog/hevy-review-2026)) [T] ; Pro 2,99 $/mois, 74,99 $ à vie ([Hevy](https://www.hevyapp.com/features/workout-plan-generator/)) [V] | Colonne « PREVIOUS » : un tap recopie la perf précédente ([Hevy](https://www.hevyapp.com/features/track-exercises/)) ; types de série, RPE, calculateurs disques/échauffement ([Hevy](https://www.hevyapp.com/features/exercise-programming-options/)) ; Hevy Trainer : 6 questions + double progression | Peu de coaching |
| Strong | 3 routines gratuites, ≈ 30 $/an ([RepReturn](https://repreturn.com/strong-app-review/)) [T] | Saisie la plus rapide | Ni programmation ni démos |
| Boostcamp | Pro 4,99 $/mois ([Boostcamp](https://www.boostcamp.app/features)) [V] | 11 000+ programmes gratuits, RPE/RIR, disques, records, hors-ligne | Carnet sans coaching |
| Fitbod | 15,99 $/mois ([FAQ](https://fitbod.me/faqs/)) [V] | Profils de salle multiples : matériel, durée, split ([Fitbod](https://fitbod.me/blog/your-gym-profile/)) | Cher ; onboarding ≈ 29 écrans ([Pageflows](https://pageflows.com/post/ios/onboarding/fitbod/)) |
| JEFIT | Gratuit avec pub ; Elite 12,99 $/mois ([SensAI](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit)) [T] | 1 400+ exercices | Interface datée |

Open source (GitHub, 06/10/2026) [V] :
- wger (AGPL, 7 038 étoiles) : Django, nutrition Open Food Facts, appli Flutter, auto-hébergeable.
- [workout-cool](https://github.com/Snouzy/workout-cool) (MIT, 8 549 étoiles, Next.js/PostgreSQL, en français) : parcours « matériel → muscles → exercices ». Le dépôt ne fournit qu'un échantillon d'exercices ([issue #111](https://github.com/Snouzy/workout-cool/issues/111)). Son service worker n'a pas de repli cache et les séances vivent en `localStorage` : pas un modèle de hors-ligne [D].
- [Liftosaur](https://github.com/astashov/liftosaur) (AGPL) : vraie PWA d'environ 200 Ko, IndexedDB, charges arrondies selon les disques possédés ; la notification de fin de repos ne marche qu'en natif.
- LiftLog (AGPL) : React Native, version web retirée, plans IA via Claude.
- [D] AGPL : s'inspirer, ne pas copier, sinon notre code passe en AGPL.

Nutrition : MyFitnessPal fait payer le scan de code-barres depuis fin 2022 ([Nutrola](https://nutrola.app/en/blog/why-did-myfitnesspal-remove-barcode-scanning)), Premium 79,99 $/an ([GGR](https://www.garagegymreviews.com/myfitnesspal-review)) [T] ; Yazio garde le scan gratuit, Pro 44,99 €/an ([Nutrola](https://nutrola.app/fr/blog/how-much-does-yazio-cost-now-2026), éditeur concurrent) [T].

Chaînes françaises : surtout badge QR, réservation et vidéos, souvent en marque blanche (Fitness Park « powered by Virtuagym »). Basic-Fit propose plans, tutoriels machines et affluence ; un avis App Store signale la perte de la séance hors réseau quand le minuteur arrive à zéro ([App Store](https://apps.apple.com/fr/app/basic-fit/id1588263601)). Fitness Park limite l'IA à 3 séances/semaine en formule Ultimate ([site](https://www.fitnesspark.fr/app-fitnesspark/)) et des avis regrettent la disparition de la saisie charges/reps ([App Store](https://apps.apple.com/fr/app/fitness-park-app/id1514794906)). On Air : 240 exercices filmés, 13 programmes ([page de 2023](https://onair-fitness.fr/application-mobile-onairfitness/)). Keepcool : 3,5/5 ([App Store](https://apps.apple.com/fr/app/keepcool/id1582437445)). [D] Il y a la place pour un carnet en français, fiable hors-ligne et adapté au matériel de sa salle.

## 2. MVP

Le socle attendu est ce que toutes ces applis offrent gratuitement [D].

V1 indispensable :
1. Ligne de série « préc. | kg | reps | valider », valeurs pré-remplies, tap sur « préc. » pour recopier, boutons ±2,5 kg/±1, types de série, note, remplacement d'exercice selon le matériel du lieu.
2. Minuteur de repos automatique par exercice.
3. Hors-ligne complet et reprise de séance.
4. Historique, records (charge max, 1RM estimé, volume), un graphique par exercice, poids de corps.
5. Calculateur de disques.
6. 5-6 programmes prêts (full body débutant, haut/bas, PPL, poids du corps, haltères seuls, renfo pour un sport) + routines perso + double progression : toutes les séries en haut de fourchette, donc on monte la charge.
7. Export CSV.

Plus tard : coach IA, journal alimentaire (scan : `BarcodeDetector` absent d'iOS, repli WASM, [caniuse](https://caniuse.com/mdn-api_barcodedetector)), recherche géographique de salles, supersets avancés, volume par muscle, périodisation, social, push du minuteur, import Strong/Hevy.

## 3. UX en salle

- Une main : 49 % des gens tiennent le téléphone d'une main ([Hoober](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php), étude de 2013). Actions en bas d'écran, bouton « valider » d'au moins 48 px (WCAG 2.2 : 24 px minimum, 44 px en AAA, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), clavier numérique, confirmation ou « Annuler » sur toute suppression.
- Écran allumé : Wake Lock, valable en PWA installée seulement depuis iOS 18.4 ([WebKit](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)) ; le redemander à chaque retour au premier plan.
- Minuteur : stocker l'heure de fin absolue, car le JS est bridé en arrière-plan (Chrome : 1 réveil/min après 5 min, [Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)). Pas de notification locale programmable ([Notification Triggers abandonnée](https://developer.chrome.com/docs/web-platform/notification-triggers)) ni de vibration sur iOS ([caniuse](https://caniuse.com/vibration)). Option : push envoyé par notre serveur à l'échéance (iOS 16.4+ et PWA installée, [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)), à condition d'avoir du réseau.
- Hors-ligne : app shell en cache + IndexedDB. Background Sync est absent de Safari et Firefox ([caniuse](https://caniuse.com/background-sync)), donc synchroniser au lancement et au retour du réseau. `navigator.storage.persist()` est accordé surtout aux apps installées ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)).
- Reprise : écrire chaque série dès sa validation, puis bandeau « Séance en cours : Reprendre / Terminer / Abandonner » [D]. Un identifiant unique par série évite les pertes de fusion, que Liftosaur reconnaît en multi-appareil ([blog](https://www.liftosaur.com/blog/posts/offline-mode-in-liftosaur/)).
- Limites PWA à accepter : ni Live Activity ni montre [D].

## 4. Onboarding

Ce que font les autres : Boostcamp pose 4 questions (objectif ; expérience sur 4 niveaux ; lieu « salle complète / garage / haltères seuls / maison » ; 2 à 6 jours) ([sélecteur](https://www.boostcamp.app/program-selector)). Hevy Trainer demande expérience, objectif, matériel, fréquence, durée et muscle prioritaire. Fitbod crée le compte après le questionnaire et propose des préréglages (grande/petite salle, hôtel, garage, maison, poids du corps) [T]. Freeletics demande les limitations physiques [T].

Parcours proposé (7 écrans, moins de 2 minutes) :
1. Objectif : muscle, force, perte de gras, forme/santé, compléter mon sport.
2. Où t'entraînes-tu ? Plusieurs choix possibles, un profil de lieu par choix. Salle : enseigne + ville, puis modèle de matériel pré-coché à valider. Maison : poids du corps seul, petit matériel (barre de traction, élastiques, haltères) ou home gym (inventaire de disques). Sport loisir : quel sport, combien de fois par semaine, avec la muscu en complément.
3. Expérience : jamais, moins d'1 an, 1 à 3 ans, plus de 3 ans.
4. Jours par semaine + durée de séance.
5. Douleurs et zones sensibles, plus 3-4 questions d'alerte type PAR-Q+ (facultatif).
6. Mesures (sexe, âge, taille, poids), facultatives : elles peuvent attendre la nutrition.
7. Programme recommandé + 2 alternatives, « Démarrer la séance 1 », puis création du compte.

En début de séance, « Aujourd'hui je suis à… » change de profil et remplace les exercices impossibles.
Selon la [CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante), le poids croisé avec les apports ou l'activité devient une donnée de santé (RGPD art. 9), comme les blessures [D] : il faut un consentement explicite dès que l'app sort du cercle privé.

## 5. « Ma salle » : données ouvertes

| Source | France | Licence | Limites |
|---|---|---|---|
| OSM `leisure=fitness_centre` ([taginfo](https://taginfo.geofabrik.de/europe:france/tags/leisure=fitness_centre)) | 4 436 objets au 05/10/2026 ; Basic-Fit 676, Fitness Park 199, L'Orange Bleue 195, KeepCool 140, Neoness 26, On Air 5 | ODbL | Environ 3/4 des 894 Basic-Fit français ([rapport 2025](https://annualreport.basic-fit.com/2025/mbr/business-and-financial-review/)) ; [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) interdit l'autocomplétion |
| OSM `leisure=fitness_station` | 8 762 (dont 505 barres de traction) | ODbL | Parfait pour le poids du corps |
| [Data ES](https://www.data.gouv.fr/dataservices/api-data-es) | 8 084 équipements « salle de musculation/cardiotraining », dont 3 941 privés commerciaux (784 « BASIC FIT ») ; 1 096 aires de street workout ; 7 994 géolocalisés | Licence Ouverte 2.0, mise à jour quotidienne | Noms génériques, adresse dans une autre table |
| [All The Places](https://github.com/alltheplaces/alltheplaces) | Fitness Park 558, Keepcool 243, On Air 132, L'Appart 117 (run du 26/09/2026) | CC0 | Scraping fragile : le spider Basic-Fit manque au dernier run |
| SIRENE, NAF 93.13Z | 5 875 entreprises actives ([API](https://recherche-entreprises.api.gouv.fr/search?activite_principale=93.13Z&etat_administratif=A)) | Licence Ouverte | Bruité (coachs indépendants) |

[D] Moins de 25 000 points au total : une base locale de quelques Mo suffit, interrogée sur notre serveur.

Profils par chaîne : les sites décrivent des zones, pas un inventaire. Basic-Fit liste machines guidées, cardio Matrix, poids libres et zone fonctionnelle avec cage ([page club](https://www.basic-fit.com/fr-fr/clubs/basic-fit-abbeville-rue-jean-mennesson-24-7-36cdf3ab9d1949acb96797afd45e8687.html)). [free-exercise-db](https://github.com/yuhonas/free-exercise-db) n'a que 12 types de matériel (876 exercices, dont 67 « machine » sans détail) [V]. [D] Il faut des modèles par format (chaîne low-cost, salle de quartier, box CrossFit, salle municipale, maison), corrigés par les utilisateurs, et notre propre liste de matériel.

## 6. Recommandation

V1 : le carnet du §2, l'onboarding du §4 et une « ma salle » simple (enseigne, nom libre, modèle de matériel à cocher). V1.1 : coach IA nourri par le profil et l'historique, conseils nutrition par règles simples. V2 : base locale de salles (Data ES + OSM + All The Places), profils partagés par salle, push du minuteur, journal alimentaire.

## Recommandation

Commencer par un carnet de séance irréprochable, en français et vraiment hors-ligne (V1). L'onboarding collecte dès le départ ce dont le coach IA et la nutrition auront besoin. Contenu de la V1 :
- Onboarding de 7 écrans : objectif ; lieux multiples avec profil de matériel (salle avec enseigne + modèle pré-coché, maison poids du corps ou petit matériel, sport loisir) ; expérience sur 4 niveaux ; jours et durée ; limitations facultatives avec consentement ; mesures facultatives ; programme recommandé puis séance 1, et création du compte à la fin.
- Saisie : ligne « préc. | kg | reps | valider » avec valeurs pré-remplies et recopie en un tap.
- Minuteur : heure de fin absolue, Wake Lock pour garder l'écran allumé.
- Persistance : chaque série est écrite en local (IndexedDB) dès sa validation, avec un bandeau de reprise de séance.
- Suivi et programmes : historique, records, un graphique par exercice, calculateur de disques, 5-6 programmes avec double progression, export CSV.
- « Ma salle » : enseigne + nom libre + modèle de matériel par format, sans géodonnées.

V1.1 : coach IA alimenté par le profil et l'historique, conseils nutrition fondés sur des règles simples (pas encore de journal alimentaire).

V2 :
- Base locale de salles fusionnant Data ES, OSM et All The Places (moins de 25 000 points, attribution OSM), avec les stations de street workout pour les profils poids du corps.
- Profils de matériel partagés par salle.
- Notification push du minuteur envoyée par notre serveur.
- Journal alimentaire (Ciqual, Open Food Facts, scan avec repli WASM sur iOS).

Côté code, s'inspirer de Liftosaur et workout-cool sans copier de code AGPL.

## Options

### MVP « carnet de séance hors-ligne » d'abord (IA et nutrition détaillée en V1.1/V2)
- Pour : Couvre l'usage quotidien (saisir une série en un tap, perf précédente, minuteur), que toutes les références offrent gratuitement ; Construit l'historique sans lequel le coach IA conseillerait à l'aveugle ; Se démarque des apps des chaînes françaises, faibles sur la saisie (Fitness Park) et sur le hors-ligne (Basic-Fit) ; Réalisable par une petite équipe en PWA
- Contre : Le coach IA, cœur de la vision, arrive après la V1 ; Lancement moins spectaculaire

### MVP « coach IA » d'abord (programme généré + chat)
- Pour : Différenciation forte, conforme à la vision ; Les concurrents (Fitness Park, Hevy Trainer, LiftLog) montrent que la demande existe
- Contre : Sans historique de séances, les conseils restent génériques ; Coût et infrastructure IA encore inconnus (GPU, budget API) ; La saisie reste l'usage quotidien et doit de toute façon être irréprochable

### « Ma salle » simple en V1 : enseigne + nom libre + modèle de matériel à cocher
- Pour : Aucune dépendance à des données externes, un seul écran ; Suffisant pour un cercle privé ; Compatible avec un enrichissement ultérieur par géodonnées
- Contre : Pas de recherche géographique ; Pas de partage du matériel entre membres d'une même salle ; Doublons et fautes dans les noms

### Base locale de salles fusionnée (Data ES + OSM + All The Places) avec recherche texte et proximité
- Pour : Moins de 25 000 points au total (quelques Mo), interrogés sur notre serveur sans dépendre de Nominatim ; Licences ouvertes : Licence Ouverte 2.0, ODbL, CC0 ; Couvre aussi les parcs de street workout pour le profil poids du corps (8 762 stations OSM, 1 096 aires Data ES)
- Contre : Doublons entre sources à fusionner, noms génériques dans Data ES ; Attribution ODbL et partage à l'identique si la base dérivée est diffusée ; Fraîcheur variable : spider Basic-Fit absent du dernier run, OSM couvre environ 3/4 des Basic-Fit ; Import périodique à maintenir

### Onboarding court (7 écrans) + profils de lieu multiples
- Pour : Moins de 2 minutes, sur le modèle Boostcamp (4 questions) et Hevy Trainer (6 entrées) ; Intègre directement le choix salle / maison poids du corps / sport loisir ; Première séance proposée tout de suite ; Profils multiples comme Fitbod ; on complète le profil au fil de l'usage
- Contre : Personnalisation initiale moins fine ; Le modèle de matériel pré-coché peut être approximatif et doit être vérifié

### Onboarding long à la Fitbod (~29 écrans, matériel détaillé dès le départ)
- Pour : Personnalisation maximale dès la première séance
- Contre : Risque d'abandon et de lassitude ; Collecte trop tôt des données de santé (RGPD art. 9) ; Disproportionné pour un cercle de proches

## Risques

- Limites des PWA sur iPhone : pas de vibration ; minuteur non fiable en arrière-plan (JS gelé) ; push seulement si l'app est installée (iOS 16.4+) ; Wake Lock seulement depuis iOS 18.4 en mode installé ; ni Live Activity ni montre. L'expérience reste en dessous de Hevy et Strong sur iOS.
- Perte de séance si l'état n'est pas écrit en local à chaque série (cas signalé sur l'app Basic-Fit), et conflits de fusion en multi-appareil (Liftosaur reconnaît des pertes possibles).
- Licences : copier du code de wger, LiftLog, Liftosaur ou ExerciseDB (AGPL) imposerait l'AGPL à notre code. Diffuser une base dérivée d'OSM impose le partage à l'identique (ODbL). Nominatim interdit l'autocomplétion.
- Données de salles incomplètes ou vieillissantes : OSM couvre environ 3/4 des Basic-Fit ; Data ES a des noms génériques (« BASIC FIT ») et des adresses dans une table séparée ; All The Places dépend de scrapers fragiles (spider Basic-Fit absent du dernier run, spider Fitness Park qui ignore robots.txt). Utiliser les exports publiés plutôt que scraper nous-mêmes.
- Aucune chaîne ne publie d'inventaire machine par machine : des profils de matériel approximatifs proposeront des exercices impossibles, d'où un remplacement d'exercice rapide indispensable.
- Données de santé (blessures, poids croisé avec les apports) soumises à l'article 9 du RGPD si l'app sort du cercle privé : consentement explicite et sécurité du serveur domestique.
- Dérive du périmètre : un journal alimentaire comme MyFitnessPal ou Yazio est un gros chantier (base d'aliments, scan de code-barres sans BarcodeDetector sur iOS).
- workout-cool n'est ni une source d'exercices (dépôt sans base complète) ni un modèle de hors-ligne (service worker sans repli cache, localStorage).
- Les prix des concurrents divergent selon les sources tierces (Strong, Boostcamp, Hevy) : les revérifier avant de s'en servir pour un positionnement.
- Réseau absent dans certaines salles (sous-sols) et serveur maison parfois injoignable : le hors-ligne est un prérequis, pas une option.

## Questions pour nous

- Public cible : uniquement toi et tes proches (instance privée sur invitation) ou ouvert au public ? Cela change les obligations RGPD, l'intérêt d'une base de salles et la modération.
- Combien d'iPhone dans le groupe, et sous quelle version d'iOS (18.4 ou plus) ? Acceptez-vous un minuteur sans vibration, fiable seulement écran allumé ?
- Le serveur maison sera-t-il joignable depuis l'extérieur (nom de domaine, HTTPS) pour la synchro et les notifications push ? Vos salles captent-elles le réseau ?
- Que veut dire « sport en loisir » : pratiquer un autre sport avec la muscu en complément, ou faire de la muscu sans objectif de performance ?
- Quel niveau de détail pour le matériel : par familles (barre, haltères, poulies, machines) ou machine par machine ?
- Quelles salles et enseignes fréquentez-vous ? Cela permettrait de préparer les premiers modèles de matériel.
- Quels programmes voulez-vous en V1, et qui les écrit ou les valide ?
- Nutrition en V1 : de simples cibles (calories, protéines) ou un vrai journal alimentaire avec scan de code-barres ?
- Acceptez-vous de stocker des données de santé (blessures, poids) ? Qui administre le serveur et y a accès ?
- Faut-il pouvoir importer un historique Strong ou Hevy (CSV) ?
- Un volet social (voir les séances des proches, défis) est-il utile dès la V1 ?
- Une recherche de salle géolocalisée est-elle nécessaire dès la V1, ou une saisie libre de la salle suffit-elle ?

## Affirmations clés

- [haute] Hevy Pro coûte 2,99 $/mois, 23,99 $/an ou 74,99 $ à vie. Hevy Trainer (Pro) pose 6 questions (expérience, objectif, matériel, fréquence, durée, muscle prioritaire) et applique une double progression : la charge monte quand le haut de la fourchette est atteint sur toutes les séries. (https://www.hevyapp.com/features/workout-plan-generator/)
- [moyenne] La version gratuite de Hevy permet des séances illimitées mais se limite à 4 routines, 7 exercices personnalisés et 3 mois d'historique de graphiques. (https://www.sensai.fit/blog/hevy-review-2026)
- [haute] Pendant la séance, Hevy affiche une colonne PREVIOUS (dernière perf par série). Un tap sur une valeur la recopie dans la série en cours. (https://www.hevyapp.com/features/track-exercises/)
- [haute] Le sélecteur de programme Boostcamp pose 4 questions : objectif (muscle, force, femmes, athlétisme, poids du corps), expérience (débutant, novice < 1 an, intermédiaire 1-3 ans, avancé > 3 ans), lieu (salle complète, garage, haltères seuls, maison) et fréquence (2 à 6 jours). (https://www.boostcamp.app/program-selector)
- [haute] Boostcamp offre gratuitement 11 000+ programmes, le RPE/RIR, un calculateur de disques, les minuteurs de repos, les records et le hors-ligne une fois le programme chargé. Pro coûte 4,99 $/mois. (https://www.boostcamp.app/features)
- [haute] Fitbod gère plusieurs profils de salle, chacun avec sa liste de matériel, sa durée de séance (de 1 min à 4 h) et son split. (https://fitbod.me/blog/your-gym-profile/)
- [haute] Fitbod coûte 15,99 $/mois ou 95,99 $/an (essai de 7 jours). Une séance déjà générée peut être faite hors-ligne. (https://fitbod.me/faqs/)
- [moyenne] L'onboarding iOS de Fitbod compte environ 29 écrans : expérience, objectifs et matériel d'abord, inscription après le questionnaire. (https://pageflows.com/post/ios/onboarding/fitbod/)
- [haute] Le dépôt Snouzy/workout-cool ne contient pas la base d'exercices complète, seulement un échantillon. L'auteur confirme que les exercices sont des ressources externes non incluses. (https://github.com/Snouzy/workout-cool/issues/111)
- [haute] Liftosaur (PWA, AGPL) : la notification push de fin de minuteur de repos ne fonctionne que dans ses applis natives, pas dans la PWA. (https://github.com/astashov/liftosaur)
- [haute] Screen Wake Lock ne fonctionne dans les web apps installées sur l'écran d'accueil iOS que depuis iOS/iPadOS 18.4 (31/03/2025). (https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [haute] Sur iOS, Web Push (depuis 16.4) n'est disponible que pour les web apps ajoutées à l'écran d'accueil, et la permission doit être demandée suite à une action de l'utilisateur. (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [haute] Aucune API web ne permet de programmer une notification locale : le développement de Notification Triggers a été arrêté. (https://developer.chrome.com/docs/web-platform/notification-triggers)
- [haute] L'API Vibration n'est supportée par aucun navigateur iOS (WebKit). (https://caniuse.com/vibration)
- [haute] L'API Background Sync n'est supportée ni par Safari iOS ni par Firefox. (https://caniuse.com/background-sync)
- [haute] OpenStreetMap compte 4 436 objets leisure=fitness_centre en France (données au 05/10/2026), dont 676 Basic-Fit, 199 Fitness Park, 195 L'Orange Bleue, 140 KeepCool et 26 Neoness, ainsi que 8 762 leisure=fitness_station (stations extérieures). (https://taginfo.geofabrik.de/europe:france/tags/leisure=fitness_centre)
- [haute] Fin 2025, Basic-Fit avait 894 clubs en France (858 fin 2024). OSM en couvre donc environ 3/4. (https://annualreport.basic-fit.com/2025/mbr/business-and-financial-review/)
- [haute] Data ES (ministère des Sports) recense 8 084 équipements « Salle de musculation/cardiotraining », dont 3 941 à propriétaire privé commercial et 784 nommés « BASIC FIT », plus 1 096 « Aire de fitness/street workout ». Sous Licence Ouverte 2.0, avec une API mise à jour chaque jour (comptes obtenus via l'API le 06/10/2026). (https://www.data.gouv.fr/dataservices/api-data-es)
- [haute] All The Places publie en CC0 les emplacements des chaînes. Run du 26/09/2026 : Fitness Park 558, Keepcool 243, On Air 132, L'Appart Fitness 117, Neoness 32. Le spider Basic-Fit FR (903 sites à sa création en novembre 2025) est absent de ce run. (https://github.com/alltheplaces/alltheplaces)
- [haute] La politique d'usage de Nominatim interdit l'autocomplétion (recherche pendant la frappe) et limite à 1 requête par seconde. (https://operations.osmfoundation.org/policies/nominatim/)
- [haute] Selon la CNIL, des données de bien-être comme le poids, les pas ou les apports caloriques deviennent des données de santé quand on les croise. L'article 9 du RGPD s'applique alors (consentement explicite), sauf traitement purement personnel. (https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)
- [moyenne] Un avis App Store de l'app Basic-Fit rapporte que, sans réseau, l'app se ferme quand le minuteur de repos arrive à zéro et que la séance est perdue. (https://apps.apple.com/fr/app/basic-fit/id1588263601)
- [haute] Dans l'app Fitness Park, les séances générées par IA sont limitées à 3 par semaine et réservées à la formule Ultimate. (https://www.fitnesspark.fr/app-fitnesspark/)
- [haute] free-exercise-db compte 876 exercices et seulement 12 catégories de matériel (par exemple 'machine', générique, 67 exercices ; 'body only', 111 exercices). Trop grossier pour un inventaire salle par salle. (https://github.com/yuhonas/free-exercise-db)
- [moyenne] Le scan de code-barres de MyFitnessPal est réservé au Premium (79,99 $/an ou 19,99 $/mois) depuis fin 2022. (https://www.garagegymreviews.com/myfitnesspal-review)
- [moyenne] 49 % des utilisateurs observés tiennent leur smartphone d'une seule main (étude Hoober, 2013, 1 333 observations ; ancienne). (https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)

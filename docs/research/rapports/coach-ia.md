# Coach IA intégré (conseils entraînement et nutrition, génération et ajustement de programmes) : API Claude, LLM local, hybride, architecture, garde-fous, évaluation

# Coach IA intégré : options, coûts, architecture, garde-fous

*Recherche du 2026-10-06. « Vérifié » = lu dans la source liée ; « déduit » = calcul ou inférence de notre part.*

## Synthèse
- **Option par défaut : l'API Claude**, derrière une interface fournisseur interne. Modèle **Claude Opus 5.5** (`claude-opus-5-5`), avec l'effort `low` pour le chat et `medium` pour les programmes. Coût d'environ **1 $ par utilisateur actif et par mois**, ou 0,5 $ avec Sonnet 5.5 si nos tests le valident (c'est à vous de décider).
- **Pas de LLM local dans le chemin critique sans GPU** : sur un bon CPU, compter 1 à 2 minutes par réponse (déduit).

## 1. API Claude

| Modèle (ID) | Entrée | Écriture cache 5 min | Lecture cache | Sortie | Maintenu au moins jusqu'au |
|---|---|---|---|---|---|
| Opus 5.5 `claude-opus-5-5` | 4 | 5 | 0,20 | 20 | 22/09/2027 |
| Sonnet 5.5 `claude-sonnet-5-5` | 2 | 2,50 | 0,20 | 10 | 28/09/2027 |
| Haiku 4.5 `claude-haiku-4-5` | 1 | 1,25 | 0,10 | 5 | **15/10/2026** |

Prix en USD par million de tokens, vérifiés ([tarifs](https://platform.claude.com/docs/en/about-claude/pricing), [modèles](https://platform.claude.com/docs/en/about-claude/models/overview)). Haiku 4.5 n'est garanti que jusqu'au 15/10/2026, donc à écarter. Le traitement par lots (Batch) coûte 50 % de moins.

**Fonctionnalités (vérifié).**
- Outils déclarés en `strict: true`.
- Sorties structurées `output_config.format`, en production. Elles ne gèrent ni `minimum`, ni `maximum`, ni `minLength`, et sont limitées à 20 outils stricts : la validation métier reste donc à faire dans l'appli ([doc](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
- Cache de prompt (à partir de 512 tokens), streaming, Batch.

**Pièges (référence claude-api).**
- La réflexion d'Opus 5.5 ne se désactive pas et elle est facturée en tokens de sortie.
- Un `tool_choice` forcé renvoie une erreur 400 sur Opus et Sonnet 5.5.
- Il faut gérer le cas `stop_reason: "refusal"`.

Limites du palier Start : 1 000 requêtes par minute et 500 $ de dépense par mois au maximum ([limites](https://platform.claude.com/docs/en/api/rate-limits)).

**Coût par utilisateur (déduit).** Hypothèses retenues :
- 20 échanges par mois, 1,5 appel par échange (un outil une fois sur deux) ;
- 9 000 tokens d'entrée par appel : système et outils 4 000, dossier utilisateur 2 500, mémoire 2 000, message 500 ;
- 800 tokens de sortie par échange, réflexion comprise ;
- cache : 65 % de l'entrée lue, 25 % écrite ;
- en plus : 2 programmes par mois et des résumés hebdomadaires traités en Batch.

| | Opus 5.5 | Sonnet 5.5 |
|---|---|---|
| Un échange | 0,040 $ | 0,021 $ |
| Utilisateur type (20 échanges/mois) | 1,13 $ | 0,58 $ |
| Si la sortie double | 1,45 $ | 0,74 $ |
| Sans cache | 1,73 $ | 0,87 $ |
| 100 échanges/mois | 4,6 $ | 2,4 $ |

Pour 10 utilisateurs, cela fait environ 11 $/mois avec Opus et 6 $ avec Sonnet.

**Données personnelles (vérifié).**
- Anthropic n'entraîne pas ses modèles sur nos données ([conditions](https://www.anthropic.com/legal/commercial-terms)).
- Les données sont supprimées sous 30 jours, sauf signalement par la sécurité : elles sont alors gardées jusqu'à 2 ans ([politique](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)).
- Un accord de traitement des données (DPA) s'applique avec les clauses contractuelles types de l'UE, sans recours au Data Privacy Framework ([DPA](https://www.anthropic.com/legal/data-processing-addendum)).
- `inference_geo` n'accepte que `us` ou `global`. **Les données sortent donc de l'UE** ([résidence](https://platform.claude.com/docs/en/manage-claude/data-residency)).

Alternative : passer par Google Cloud en **multi-région `eu`**, pour 10 % de plus, avec les mêmes SDK, mais sans Batch (disponibilité par modèle à vérifier, [doc](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai)).

Le poids croisé avec l'alimentation relève des **données de santé** ([CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)). Il faut donc un consentement explicite au titre de l'article 9 du RGPD, et ne mettre ni nom ni e-mail dans les prompts.

## 2. LLM local

**Mémoire (déduit).** Une fois l'OS, PostgreSQL, l'appli et une marge déduits, il reste ~9-10 Go. Côté modèles, sur Ollama : ministral-3:8b pèse 6,0 Go, :14b 9,1 Go, qwen3.5:9b 6,6-7,6 Go et gemma4:26b 16-19 Go ([Ollama](https://ollama.com/library/ministral-3)). Il faut ajouter environ 1 Gio par tranche de 8k tokens de contexte (calcul pour un 8B). Sur CPU, on est donc plafonné à 8-9B.

**Débit (mesures).**

| Matériel | Modèle | Lecture du prompt | Génération |
|---|---|---|---|
| Ryzen 9 5950X ([llamafile](https://github.com/mozilla-ai/llamafile/discussions/450), 2024) | 8B | 104 tok/s | 10,5 tok/s |
| Intel N150 ([Geerling](https://github.com/geerlingguy/ai-benchmarks)) | 3B / 14B | n.d. | 9,1 / 2,1 tok/s |
| RTX 3060 (Geerling) | 14B | n.d. | 29,8 tok/s |
| RTX 3070-3090 ([bench](https://github.com/XiongjieDai/GPU-Benchmarks-on-LLM-Inference)) | 8B | 2 300-3 900 tok/s | 71-112 tok/s |

**Conséquence (déduit).** Avec 9 000 tokens de contexte, la réponse commence au bout de 50 à 90 s sur un bon CPU de bureau (bien plus sur un mini-PC), contre 3 à 6 s sur GPU. Par défaut, Ollama traite une seule requête à la fois ([FAQ](https://docs.ollama.com/faq)).

**Modèles candidats (licence Apache 2.0).** Ministral 3 8B/14B ([déc. 2025](https://mistral.ai/news/mistral-3)), Gemma 4 E4B ([avr. 2026](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)), Qwen3.5 4B/9B ([mars 2026](https://github.com/QwenLM/Qwen3.8)).

Préférences des utilisateurs en français ([compar:IA](https://arene.comparia.beta.gouv.fr/ranking)) : claude-opus-5.5 1191, gemma-3-12b 1031, llama-3.1-8b 906, qwen3.5-35b 901. Ce classement mesure des préférences, pas l'exactitude. Ollama peut forcer un schéma JSON ([doc](https://docs.ollama.com/capabilities/structured-outputs)), mais rien ne garantit qu'un petit modèle respecte les garde-fous.

**Option GPU.** Une RTX 5060 Ti 16 Go coûte 550 à 900 € ([GinjFo](https://www.ginjfo.com/actualites/composants/cartes-graphiques/geforce-rtx-5060-ti-16-go-son-prix-ne-cesse-daugmenter-et-inquiete-20260210)), plus 2 à 5 € d'électricité par mois (déduit, à 0,2001 €/kWh selon le [tarif réglementé](https://www.kelwatt.fr/actu/tarif-edf-reglemente-1er-aout-2026)). Pas rentable à 10 utilisateurs : seuil ≈ 30-60 actifs sur 2 ans (déduit).

## 3. Hybride et abstraction
- **Interface interne `CoachModel`** : génération, streaming, outils, schéma de sortie et calcul du coût à partir de `usage`.
- **Trois adaptateurs** derrière cette interface : `@anthropic-ai/sdk`, `@anthropic-ai/vertex-sdk` et `ollama`.
- **Schémas Zod communs**, convertis en JSON Schema.
- **Registre de modèles** en configuration.

Alternative : l'AI SDK (`ai` 7.x), au prix de 3 versions majeures en 11 mois ([npm](https://www.npmjs.com/package/ai)).

À éviter : la compatibilité `/v1/messages` d'Ollama, sans cache ni Batch ([doc](https://docs.ollama.com/api/anthropic-compatibility)).

Répartition proposée :
- Claude pour le dialogue et les programmes.
- Un modèle local, seulement avec un GPU, en secours.
- La recherche d'exercices sans LLM, en plein texte dans PostgreSQL.

## 4. Architecture
- **Contexte**, dans l'ordre du cache : outils, puis prompt système figé, puis dossier utilisateur. Le dossier contient le profil, les objectifs, le lieu (maison, salle, loisir), le matériel, les blessures, les records et les 4 dernières semaines. Viennent ensuite le résumé de la mémoire, les 10 derniers tours, puis le message.
- **Outils** : `search_exercises`, `get_history`, `get_records`, `compute_nutrition_targets` (les calculs restent **dans le code**), `propose_program` et `flag_safety`.
- **Proposition de programme** :
  1. Le modèle produit du JSON.
  2. Zod le valide : exercices existants et compatibles avec le matériel, séries bornées, contre-indications respectées.
  3. En cas d'erreur, le modèle reçoit un `tool_result` d'erreur, avec 2 essais maximum.
  4. L'utilisateur voit un aperçu et doit **confirmer**.
- **Mémoire** : historique conservé chez nous, avec des faits durables modifiables par l'utilisateur.
- **Limites** : 50 messages par jour, un plafond en $ par mois et des `max_tokens` bornés. Au-delà, passage en mode dégradé.

## 5. Garde-fous
- **Inscription** : âge et questionnaire PAR-Q (cœur, grossesse, pathologies, blessures, troubles alimentaires). Une réponse à risque active un mode prudent.
- **Règles fixes** : un plancher calorique et une perte de poids limitée à 0,5-1 % par semaine ([ISSN](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)).
- **Dopants** : refus, puis orientation vers Écoute Dopage au 0 800 15 2000 ([fiche](https://lannuaire.service-public.gouv.fr/centres-contact/R20697), qui date de 2021).
- **Douleur** : aucun diagnostic ; orientation vers un médecin ou un kiné ; en cas de douleur thoracique, le 15 ou le 112.
- **Troubles alimentaires** : aucun déficit calorique proposé, orientation vers le 09 69 325 900 ([FFAB](https://www.ffab.fr/500-ligne-tca-nouveau-numero)).
- **Grossesse et pathologies** : orientation vers un professionnel.
- **Mineurs** : consentement parental obligatoire avant 15 ans ([CNIL](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans)), plus des règles imposées par Anthropic ([guide](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)). Mieux vaut commencer en 18 ans et plus.

**Transparence.**
- L'article 50(1) de l'**AI Act** s'applique depuis le **2 août 2026** ([Baker Botts](https://www.bakerbotts.com/thought-leadership/publications/2026/september/eu-ai-act-article-50-transparency-obligations-go-live)).
- L'utilisateur doit savoir qu'il parle à une IA dès sa première interaction (art. 50(5), [texte](https://artificialintelligenceact.eu/article/50/)).
- Anthropic impose aussi cette mention **à chaque session**. Le conseil bien-être (nutrition, exercice) n'est pas classé à haut risque ([AUP](https://www.anthropic.com/legal/aup)).
- À confirmer avec un juriste : l'application de l'art. 50(2), sur le marquage des contenus générés.

## 6. Évaluation

**Jeu de tests : environ 100 cas en français.**
- Programmes à la maison, en salle, en loisir.
- Progression.
- Nutrition.
- Sécurité : douleur, grossesse, ado de 15 ans en sèche, régime à 1 000 kcal, SARMs, troubles alimentaires.
- Tentatives de contournement.
- Questions hors périmètre.
- Personnalisation.

**Méthodes de notation.**
- **Contrôles automatiques** : validité du schéma, règles Zod, identifiants, plancher calorique, numéro d'aide, mention de l'IA, coût, latence.
- **Juge LLM** : grille concrète, modèle juge différent du modèle testé.
- **Comparaison à l'aveugle** entre modèles.
- **Relecture de 20 à 30 cas** par un coach diplômé ou un diététicien.

**Seuils.**
- 100 % de réussite sur les cas de sécurité. C'est bloquant.
- Au moins 95 % de programmes valides du premier coup.

Chaque cas est joué 3 fois, pour environ 10 à 20 $ par campagne, juge compris (déduit).


## Recommandation

Je recommande comme option par défaut l'API Claude directe, derrière une interface interne CoachModel. Cette interface prévoit trois adaptateurs : @anthropic-ai/sdk pour l'API directe, @anthropic-ai/vertex-sdk pour l'UE et ollama pour un modèle local. Elle s'appuie sur des schémas Zod communs et un registre de modèles en configuration.

Réglages proposés :
- Modèle : Claude Opus 5.5 (claude-opus-5-5), avec l'effort low pour le chat et medium pour la génération de programmes.
- Cache de prompt dans l'ordre outils → système → dossier utilisateur.
- Outils en strict: true, sorties structurées, puis validation métier en Zod.
- Confirmation par l'utilisateur avant d'enregistrer un programme.

Coûts estimés (déduits, hypothèses explicites dans le rapport) :
- environ 1,13 $ par utilisateur actif et par mois (20 échanges et 2 programmes) ;
- environ 11 $/mois pour 10 utilisateurs ;
- environ 4,6 $/mois pour un gros utilisateur (100 échanges).

Sonnet 5.5 divise ces coûts par deux environ (0,58 $ par utilisateur et par mois). À vous de décider de basculer, une fois que l'évaluation en français a validé la qualité : au moins 100 cas, dont 100 % des cas de sécurité réussis.

Je déconseille un LLM local dans le chemin critique :
- sur CPU, il faut 50 à 90 s avant le premier mot et environ 10 tok/s pour un 8B, même sur un bon CPU de bureau ;
- sur un mini-PC, la génération tombe à 2-9 tok/s, et Ollama ne traite qu'une requête à la fois ;
- un GPU de 16 Go (550 à 900 €) ne devient rentable qu'au-delà d'environ 30 à 60 utilisateurs actifs, avec une qualité en français et en sécurité plus faible.

Si l'appli s'ouvre au public, ou si vous exigez que les données de santé restent dans l'UE, il suffit de passer l'adaptateur sur Google Cloud en multi-région eu, pour 10 % de plus.

Avant toute ouverture, il faut en plus :
- un consentement explicite (art. 9 du RGPD) ;
- la mention « IA » à chaque session (AI Act, art. 50, en vigueur depuis le 2 août 2026, et politique d'usage d'Anthropic) ;
- un âge minimum de 18 ans au départ ;
- des calculs nutritionnels faits dans le code, pas par le modèle ;
- des plafonds par utilisateur (par exemple 50 messages/jour et 3 $/mois) et une limite de dépense sur le workspace Anthropic.

## Options

### A. API Claude directe (Anthropic) : Opus 5.5 par défaut, Sonnet 5.5 pour réduire le coût
- Pour : Meilleure qualité perçue en français (compar:IA : claude-opus-5.5 à 1191, contre 906-1031 pour les petits modèles ouverts) ; Outils stricts, sorties structurées en production, cache de prompt, streaming, Batch à −50 % ; Coût faible à notre échelle : environ 1,13 $ par utilisateur actif et par mois avec Opus, 0,58 $ avec Sonnet, soit environ 11 $/mois pour 10 utilisateurs ; Aucune charge CPU ni RAM sur le serveur maison ; quelques secondes de latence en streaming ; Limites larges : 1 000 requêtes/min au palier Start ; les lectures de cache ne comptent pas dans la limite d'entrée
- Contre : Données de santé traitées hors UE (inference_geo us ou global uniquement) sous clauses contractuelles types, sans Data Privacy Framework ; Conservation jusqu'à 30 jours, jusqu'à 2 ans en cas de signalement ; conservation zéro (ZDR) seulement sur contrat ; Dépendance à un fournisseur dont l'API évolue vite : réflexion non désactivable sur Opus 5.5, tool_choice forcé supprimé ; Coût variable à plafonner : 500 $/mois maximum au palier Start, et possible palier d'évaluation plus bas au départ ; Internet obligatoire ; Opus est plus lent que Sonnet (latence « moderate » contre « fast »)

### B. Claude via Google Cloud (Vertex/Agent Platform) en multi-région UE
- Pour : Mêmes modèles et même famille de SDK (@anthropic-ai/vertex-sdk) : on bascule par configuration ; Traitement dans l'UE (endpoint eu) avec Google comme sous-traitant ; Cache de prompt, sorties structurées et outils disponibles
- Contre : 10 % plus cher sur tous les tokens ; Compte GCP, IAM, clé de service et quotas à administrer ; Ni Batch API, ni fallbacks côté serveur, ni Files API ; Disponibilité exacte d'Opus et Sonnet 5.5 en eu à vérifier dans le Model Garden

### C. LLM local sur CPU seul (Ollama ou llama.cpp, modèles 4-9B quantifiés en Q4)
- Pour : Les données de santé ne quittent pas la maison ; aucun coût par requête ; Modèles récents sous Apache 2.0 (Ministral 3, Gemma 4, Qwen3.5) ; Ollama peut contraindre la sortie à un schéma JSON ; Fonctionne sans Internet
- Contre : Environ 10 tok/s en génération (8B sur Ryzen 9 5950X), 2 à 9 tok/s sur un mini-PC N150, et environ 100 tok/s pour lire le prompt : 1 à 2 minutes par réponse avec 9 000 tokens de contexte ; Une seule requête à la fois par défaut : le deuxième utilisateur attend ; 6 à 8 Go pris sur les 16 Go, en concurrence avec PostgreSQL et l'appli (risque de manque de mémoire) ; Qualité en français et respect des garde-fous inférieurs, à prouver sur nos tests

### D. LLM local avec un GPU grand public (12-16 Go de VRAM)
- Pour : Premier mot en 3 à 6 s environ, 30 à 110 tok/s (modèles 8-14B) ; Données locales ; modèles 14B possibles, voire 24-31B avec 24 Go de VRAM ; Faible coût d'usage (électricité : environ 2 à 5 €/mois)
- Contre : Investissement de 550 à 900 € (RTX 5060 Ti 16 Go), rentable seulement au-delà d'environ 30 à 60 utilisateurs actifs sur 2 ans ; Qualité toujours en dessous des modèles de pointe pour des conseils de santé ; Compatibilité du serveur inconnue (alimentation, slot PCIe, OS, pilotes) et maintenance à prévoir ; Concurrence limitée ; taille du contexte et du cache KV à dimensionner

### E. Hybride derrière une interface unique (Claude principal, local en secours ou pour des tâches asynchrones)
- Pour : Résilience : en cas de panne de l'API ou de plafond atteint, passage en mode dégradé ; Changement de modèle par configuration ; évaluation comparative sur le même jeu de tests ; Les tâches simples (lecture de séances saisies, résumés) peuvent tourner localement en arrière-plan
- Contre : Deux chemins à tester et à maintenir, avec des comportements différents selon le modèle ; Peu utile sans GPU : le secours est trop lent pour du chat ; Les garde-fous doivent rester indépendants du modèle (validation dans le code)

## Risques

- Conseil dangereux (blessure, troubles alimentaires, déficit extrême, grossesse, pathologie, dopage) malgré le prompt. Parades : règles fixes à l'inscription, validation Zod, détection des sujets à risque, renvoi vers un professionnel ou une ligne d'aide, relecture par un pro, et 100 % exigé sur les cas de sécurité.
- Juridique. Données de santé (art. 9 du RGPD) transférées aux États-Unis sous clauses contractuelles types, sans Data Privacy Framework. AI Act art. 50 déjà en vigueur ; art. 50(2) sur le marquage à clarifier. Requalification possible en dispositif médical si l'appli fait des allégations médicales. Mineurs.
- Dérive des coûts (abus, boucles d'outils, contexte qui gonfle). Le plafond de 500 $/mois du palier Start peut couper le service en fin de mois. Parades : plafonds par utilisateur, max_tokens, limite de dépense sur le workspace, alertes.
- Instabilité côté fournisseurs : Haiku 4.5 peut être retiré dès le 15/10/2026 ; ruptures d'API sur la génération 5.5 (réflexion non désactivable, tool_choice forcé supprimé) ; SDK qui changent vite (AI SDK : 3 versions majeures en 11 mois).
- Injection de prompt, via le texte saisi par l'utilisateur ou via les descriptions d'exercices importées d'un dépôt tiers. Il faut traiter les résultats d'outils comme des données et nettoyer l'import.
- Modèle local : mémoire saturée (PostgreSQL tué faute de RAM), latence inacceptable sur CPU, qualité insuffisante en français et sur la sécurité.
- Disponibilité : le serveur domestique et la box Internet sont un point unique de défaillance. En cas de panne de l'API Claude, prévoir un mode dégradé (coach désactivé avec un message, ou modèle local s'il y a un GPU).
- Informations périssables : prix, modèles et classement compar:IA relevés le 2026-10-06, à revérifier avant décision. Le numéro d'Écoute Dopage provient d'une fiche de 2021.
- Mémoire du coach : le modèle peut retenir des informations sensibles. L'utilisateur doit pouvoir les consulter, les corriger et les supprimer, et la durée de conservation doit être définie.

## Questions pour nous

- Public cible : vous et vos proches seulement (environ 10-20 personnes) ou ouverture au public ? Cela conditionne le RGPD, l'AI Act, la résidence UE et les plafonds.
- Quel budget IA mensuel maximum et quel plafond par utilisateur (par exemple 20 $/mois au total et 3 $ par utilisateur) ? Opus 5.5 (environ 1,1 $ par utilisateur) ou Sonnet 5.5 (environ 0,6 $) après évaluation ?
- Acceptez-vous que les données de profil et de santé soient traitées aux États-Unis (Anthropic, clauses contractuelles types) ? Ou faut-il imposer l'UE via Google Cloud eu (+10 %, compte GCP à gérer) ?
- Quel est le matériel du serveur : CPU exact, type et nombre de canaux de RAM, OS, slot PCIe et alimentation pour un GPU ? Êtes-vous prêts à acheter un GPU (550-900 €) ?
- Quel âge minimum : 18 ans au départ, ou 15-17 ans avec un mode restreint (pas de sèche ni de déficit) et consentement parental sous 15 ans ?
- Avez-vous accès à un professionnel (coach diplômé BPJEPS/STAPS, diététicien, médecin du sport) pour relire le prompt système, les règles et un échantillon de réponses ?
- Le coach peut-il modifier un programme existant (avec confirmation) ou seulement en proposer ? Peut-il donner des objectifs caloriques chiffrés ?
- Quelle latence acceptez-vous, par exemple un premier mot affiché en moins de 3 s ?
- Combien de temps conserver chez nous les conversations et la mémoire du coach ? Faut-il permettre de désactiver l'IA pour ceux qui refusent d'envoyer leurs données à un tiers ?
- Tutoiement ou vouvoiement, et quels nom et ton pour le coach ?

## Affirmations clés

- [haute] Prix API Claude en USD par million de tokens. Opus 5.5 : 4 $ en entrée, 20 $ en sortie, 5 $ en écriture cache 5 min, 0,20 $ en lecture cache. Sonnet 5.5 : 2 $ / 10 $ / 2,50 $ / 0,20 $. Haiku 4.5 : 1 $ / 5 $. Batch : −50 %. Inférence US seulement (inference_geo us) : ×1,1. (https://platform.claude.com/docs/en/about-claude/pricing)
- [haute] Engagements de maintien : Haiku 4.5 jusqu'au 15/10/2026 au moins, Opus 5.5 jusqu'au 22/09/2027, Sonnet 5.5 jusqu'au 28/09/2027. Sur Opus 5.5, la réflexion est toujours active et l'effort par défaut est medium. Anthropic recommande de commencer par Opus 5.5. (https://platform.claude.com/docs/en/about-claude/models/overview)
- [haute] Les sorties structurées (output_config.format et strict tool use) sont en production sur Opus 5.5, Sonnet 5.5 et Haiku 4.5. Elles ne prennent en charge ni minimum, ni maximum, ni minLength, ni maxLength. Limites : 20 outils stricts, 24 paramètres optionnels. Les bornes métier (séries, répétitions, kcal) doivent donc être validées par l'appli. (https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [haute] Sur Opus 5.5 et Sonnet 5.5, un tool_choice forcé (any/tool) renvoie une erreur 400 ; il faut utiliser auto avec des consignes, ou des sorties structurées. Source : référence claude-api embarquée, qui renvoie au guide de migration. (https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- [haute] Palier Start, pour Opus 5.5 et Sonnet 5.5 : 1 000 requêtes/min, 2 M tokens d'entrée non cachés/min, 400 k tokens de sortie/min. Les lectures de cache ne comptent pas dans la limite d'entrée. Dépense plafonnée à 500 $/mois. Une nouvelle organisation peut démarrer sur un palier d'évaluation plus bas. (https://platform.claude.com/docs/en/api/rate-limits)
- [haute] API commerciale : Anthropic n'entraîne pas ses modèles sur le contenu client. Les entrées et sorties sont supprimées sous 30 jours, ou conservées jusqu'à 2 ans (avec scores jusqu'à 7 ans) si les systèmes de sécurité les signalent. La conservation zéro (ZDR) est possible sur accord. (https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
- [moyenne] Le DPA d'Anthropic (effectif au 24/02/2025) est intégré aux conditions commerciales. Il repose sur les clauses contractuelles types (modules 2 et 3), avec Anthropic Ireland pour l'UE, et ne mentionne pas le Data Privacy Framework. (https://www.anthropic.com/legal/data-processing-addendum)
- [haute] Sur l'API directe, inference_geo n'accepte que us ou global, et la géographie de stockage du workspace ne peut être que us. Il n'existe donc pas de résidence des données dans l'UE. (https://platform.claude.com/docs/en/manage-claude/data-residency)
- [moyenne] Sur Google Cloud (Vertex/Agent Platform), un endpoint multi-région eu existe, avec un surcoût de 10 %, et les nouveaux modèles passent par les endpoints global ou multi-région. Google y est sous-traitant. Le cache de prompt et les sorties structurées sont disponibles, mais pas Batch, les fallbacks côté serveur ni la Files API. La disponibilité exacte d'Opus et Sonnet 5.5 en eu reste à confirmer. (https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai)
- [haute] Selon la CNIL, un poids croisé avec les apports caloriques ou le nombre de pas devient une donnée de santé (article 9 du RGPD). (https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)
- [moyenne] Mesure CPU seul (llamafile, 2024) : Llama 3 8B Q4_K_M sur Ryzen 9 5950X avec DDR4-3600 lit le prompt à 104 tok/s (pp512) et génère 10,5 tok/s. (https://github.com/mozilla-ai/llamafile/discussions/450)
- [haute] Mesures Ollama. Mini-PC Intel N150 16 Go : 9,1 tok/s sur Llama 3.2 3B, 2,1 tok/s sur un 14B. Ryzen AI 5 340 : 5,8 tok/s sur un 14B. RTX 3060 : 29,8 tok/s sur un 14B. (https://github.com/geerlingguy/ai-benchmarks)
- [moyenne] Llama 3 8B Q4_K_M sur GPU : lecture du prompt (1024 tokens) à 2 284 tok/s sur RTX 3070 et 3 865 tok/s sur RTX 3090 ; génération à 71 et 112 tok/s. (https://github.com/XiongjieDai/GPU-Benchmarks-on-LLM-Inference)
- [haute] Valeurs par défaut d'Ollama : OLLAMA_NUM_PARALLEL=1, contexte de 4 096 tokens, file d'attente de 512 requêtes. Augmenter le parallélisme multiplie la mémoire réservée au contexte. (https://docs.ollama.com/faq)
- [haute] Tailles Ollama : ministral-3:8b 6,0 Go, ministral-3:14b 9,1 Go (Apache 2.0, contexte 256K), qwen3.5:9b 6,6-7,6 Go, gemma4:e4b 6,6-9,5 Go, gemma4:26b 16-19 Go. (https://ollama.com/library/ministral-3)
- [moyenne] compar:IA mesure les préférences d'utilisateurs francophones (Bradley-Terry). Scores : claude-opus-5.5 1191 (433 votes), gemma-4-31b 1096, gemma-3-12b 1031, gemma-3-4b 1002, gpt-oss-20b 909, llama-3.1-8b 906, qwen3.5-35b-a3b 901. Ce sont des préférences, pas de l'exactitude. (https://arene.comparia.beta.gouv.fr/ranking)
- [haute] La compatibilité /v1/messages (Anthropic) d'Ollama ne prend en charge ni cache_control, ni tool_choice, ni Batch, ni le comptage de tokens. (https://docs.ollama.com/api/anthropic-compatibility)
- [haute] Politique d'usage d'Anthropic : tout chatbot grand public doit indiquer à l'utilisateur qu'il parle à une IA, au minimum au début de chaque session. Le conseil bien-être (sommeil, stress, nutrition, exercice) n'entre pas dans le cas à haut risque « santé ». (https://www.anthropic.com/legal/aup)
- [haute] L'article 50(1) de l'AI Act (informer l'utilisateur qu'il parle à une IA) s'applique depuis le 2 août 2026. L'information doit intervenir au plus tard lors de la première interaction (art. 50(5)). L'omnibus numérique n'a pas reporté l'article 50. Amendes jusqu'à 15 M€ ou 3 % du chiffre d'affaires. (https://artificialintelligenceact.eu/article/50/)
- [moyenne] Les détails sur l'omnibus numérique viennent de Baker Botts (source secondaire) : le règlement (UE) 2026/1744, en vigueur depuis le 27/07/2026, reporte les obligations « haut risque » à décembre 2027 mais pas l'article 50. Il prévoit une période de grâce jusqu'au 02/12/2026 pour le marquage des systèmes déjà sur le marché. (https://www.bakerbotts.com/thought-leadership/publications/2026/september/eu-ai-act-article-50-transparency-obligations-go-live)
- [haute] En France, un mineur de moins de 15 ans ne peut consentir qu'avec un parent (art. 45 de la loi Informatique et Libertés). Anthropic impose par ailleurs des garde-fous spécifiques aux organisations qui servent des mineurs. (https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans)
- [moyenne] Lignes d'aide : Anorexie Boulimie Info Écoute au 09 69 325 900 ; Écoute Dopage au 0 800 15 2000, du lundi au vendredi de 10 h à 20 h (fiche de l'annuaire mise à jour en 2021, à revérifier). (https://www.ffab.fr/500-ligne-tca-nouveau-numero)
- [haute] Position de l'ISSN : viser une perte de 0,5 à 1,0 % du poids corporel par semaine (contexte de préparation en bodybuilding), et ralentir chez les sujets plus secs. (https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)
- [haute] Versions majeures de l'AI SDK (Vercel) : v5 le 31/07/2025, v6 le 22/12/2025, v7 le 25/06/2026, soit 3 en 11 mois. Le provider Anthropic gère cacheControl et les sorties structurées natives. (https://www.npmjs.com/package/ai)
- [moyenne] Prix d'une RTX 5060 Ti 16 Go en France en 2026 : environ 550 € au plus bas, souvent entre 700 et 900 €. (https://www.ginjfo.com/actualites/composants/cartes-graphiques/geforce-rtx-5060-ti-16-go-son-prix-ne-cesse-daugmenter-et-inquiete-20260210)
- [moyenne] Tarif bleu EDF option base (6 kVA) au 1er août 2026 : 0,2001 € TTC le kWh. (https://www.kelwatt.fr/actu/tarif-edf-reglemente-1er-aout-2026)

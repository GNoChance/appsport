# Cadre légal (France/UE) et sécurité pour appsport : RGPD et données de santé, HDS, AI Act, mineurs, mentions et responsabilité, sécurité de l'hébergement à domicile

# Cadre légal (France/UE) et sécurité : appsport

*État au 6 octobre 2026. **[V]** = vérifié sur la source liée. **[D]** = déduction à valider, idéalement par un juriste avant toute ouverture au public.*

## En bref
- Poids, mensurations, blessures et nutrition sont des **données de santé** (art. 9 RGPD). Il faut donc un consentement explicite et une sécurité renforcée.
- **La certification HDS ne s'applique pas** : c'est une appli de bien-être, hors parcours de soins, hébergée par son propre éditeur.
- **AI Act** : pas de haut risque. L'obligation de transparence (art. 50) est **en vigueur depuis le 2 août 2026**.
- Mineurs : la majorité numérique est à 15 ans. Nous conseillons **16 ans minimum** pour une ouverture au public.
- Sécurité : passkeys + Argon2id, relais SMTP, sauvegardes chiffrées hors site, **aucun proxy tiers qui déchiffre le trafic (Cloudflare)**.

## 1. RGPD

**Données de santé ?** Oui, pour l'essentiel. La [CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante) classe parmi les données de santé celles qui le deviennent par croisement, par exemple le « croisement d'une mesure de poids avec d'autres données (nombre de pas, mesure des apports caloriques…) » [V]. La [CJUE](https://www.taylorwessing.com/en/insights-and-events/insights/2024/10/ecj-lindenapotheke) adopte une lecture large : toute donnée qui permet de tirer des conclusions sur l'état de santé (C-21/23 *Lindenapotheke*, 4 oct. 2024) [V]. Les blessures sont des données de santé par nature. Le poids, les mensurations et le journal alimentaire le deviennent par croisement. Les photos de progression sont très sensibles [D]. Les séries et les charges seules ne le sont a priori pas, mais une fois rattachées au profil corporel, il faut les traiter de la même façon [D].

**(a) Usage perso + proches.** L'exemption « strictement personnelle ou domestique » (art. 2.2.c) s'interprète strictement (CJUE *Lindqvist*, *Ryneš*). Le [considérant 18](https://gdpr-text.com/read/recital-18/) soumet au RGPD celui qui « fournit les moyens » du traitement [V]. Héberger les données de ses proches reste donc une zone grise : le risque pratique est faible, mais l'exemption n'est pas garantie [D].

**(b) Ouverture au public : RGPD intégral.**

| Sujet | (a) | (b) |
|---|---|---|
| Base légale | consentement explicite conseillé | contrat (compte, séances) + **consentement explicite (art. 9.2.a)** distinct des CGU. La [CNIL](https://www.cnil.fr/fr/applications-mobiles-en-sante-et-protection-des-donnees-personnelles-les-questions-se-poser) refuse « une case à cocher valant acceptation des conditions générales d'utilisation » [V]. Consentement séparé pour le coach IA |
| Registre | conseillé | **obligatoire** : l'exemption pour moins de 250 salariés ne joue pas pour les données de l'[art. 9](https://gdpr-info.eu/art-30-gdpr/) [V] |
| AIPD | non | très probable (santé + IA), même si selon la [CNIL](https://www.cnil.fr/fr/realiser-une-analyse-dimpact-si-necessaire) l'IA n'est pas « systématiquement » un usage innovant [V] |
| Conservation | idem | compte inactif depuis 2 ans : suppression après relance, durée « jugé[e] proportionné[e] » par la [CNIL](https://www.cnil.fr/fr/achat-de-contenus-numeriques-quelle-duree-de-conservation-des-comptes-inactifs) [V]. [Journaux](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000044283637) : 6 mois à 1 an [V] |
| Droits | export + suppression | export JSON/CSV (art. 20), suppression en libre-service (art. 17), purge des sauvegardes par rotation [D] |
| Violation | prévenir les proches | [notification à la CNIL sous 72 h](https://gdpr-info.eu/art-33-gdpr/), sauf si le risque est improbable, + registre des incidents [V] |

**Sous-traitants IA.** Un contrat au sens de l'art. 28 est obligatoire. Le transfert hors UE doit être mentionné dans la politique de confidentialité (art. 13.1.f).
- [Anthropic](https://www.anthropic.com/legal/data-processing-addendum) : contrat de sous-traitance (DPA) fondé sur les clauses contractuelles types (CCT, modules 2/3). Les services UE sont fournis par Anthropic Ireland [V].
- [OpenAI](https://openai.com/index/introducing-data-residency-in-europe/) : résidence des données dans l'UE depuis février 2025, sous conditions d'éligibilité (à vérifier).
- Le cadre de transfert UE–États-Unis (DPF) a été [validé par le Tribunal de l'UE](https://data-en-maatschappij.ai/en/publications/general-court-latombe) (T-553/23, sept. 2025). Mais un [pourvoi](https://privacy-daily.com/article/2025/11/07/eu-high-court-accepts-latombes-appeal-on-euus-data-transfer-scheme-2511070020) est en cours et l'organe américain de contrôle (PCLOB) n'a plus de quorum depuis janvier 2025 ([BTLJ](https://btlj.org/2026/02/third-times-the-charm-the-fate-of-the-eu-u-s-data-privacy-framework/)). Cette base juridique est donc fragile.
- [Mistral](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data) (France) : données « hébergées dans l'Union européenne » par défaut [V].
- Un LLM local supprime la question du transfert.

Dans tous les cas : prompts sans nom ni e-mail, âge par tranche, jamais de photo [D].

Le volet RGPD du « Digital Omnibus » est toujours [en négociation](https://acompli.ie/news/digital-omnibus-gdpr-cookies-status-september-2026/) : le Conseil n'avait pas de mandat en septembre 2026. Rien ne change pour l'instant.

## 2. HDS

L'art. L.1111-8 du Code de la santé publique vise l'hébergement **pour le compte de tiers** de données recueillies lors d'activités « de prévention, de diagnostic, de soins ou de suivi social et médico-social » ([ANS](https://gnius.esante.gouv.fr/en/regulations/regulation-profiles/healthcare-data-hosting-hds)) [V]. appsport (bien-être, hors parcours de soins, hébergé par son éditeur) n'est donc pas concerné [D]. La [CNIL](https://www.cnil.fr/fr/applications-mobiles-en-sante-et-protection-des-donnees-personnelles-les-questions-se-poser) vise le cas où un professionnel confie la conservation des données à un tiers [V].

La situation changerait si des kinés, médecins ou diététiciens suivaient leurs patients via l'appli. Il faudrait alors un hébergeur certifié et, depuis fin septembre 2026, un stockage dans l'UE/EEE ([décret 2026-209](https://www.vigier-avocats.com/hebergement-des-donnees-de-sante-le-decret-du-24-mars-2026-renforce-la-souverainete-la-territorialite-et-la-transparence/)).

## 3. AI Act

- **Classification** : appsport n'entre pas dans l'Annexe III. Un logiciel « destiné au mode de vie et au bien-être » n'est pas un dispositif médical ([considérant 19 du règlement sur les dispositifs médicaux](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf)) [V]. Il faut éviter tout diagnostic ou « traitement » de blessure ou de pathologie : sinon l'appli peut être requalifiée en dispositif médical, donc en haut risque [D].
- **[Art. 50.1](https://artificialintelligenceact.eu/article/50/)** : il faut indiquer clairement à l'utilisateur qu'il parle à une IA, au plus tard lors de la première interaction [V]. Cette règle s'applique depuis le 2 août 2026. L'Omnibus IA ne l'a pas reportée ([règlement (UE) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng), en vigueur le 27 juillet 2026, [résumé](https://www.nicfab.eu/en/posts/digital-omnibus-ai-official-journal/)) [V].
- **Art. 50.2** : les textes générés doivent porter un marquage lisible par machine. Le délai de grâce jusqu'au 2 décembre 2026 ne vaut que pour les systèmes mis sur le marché avant le 2 août 2026, donc pas pour appsport ([Morgan Lewis](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/08/eu-ai-acts-transparency-rules-what-went-into-effect-on-2-august)) [V]. Les [lignes directrices](https://www.traverssmith.com/knowledge/knowledge-container/is-it-a-bot-eu-ai-act-transparency-rules-take-effect-2-august-2026/) du 20 juillet 2026 et le code de bonnes pratiques évoquent des aménagements pour les textes courts (à vérifier). En pratique : une métadonnée `ai_generated` + le marquage du fournisseur du modèle [D].
- Publier le code en open source **ne dispense pas** de l'art. 50 ([art. 2.12](https://artificialintelligenceact.eu/article/2/)) [V]. L'obligation de former à l'IA (art. 4) devient une obligation de moyens [V]. Amendes : jusqu'à 15 M€ ou 3 % du chiffre d'affaires.
- Scénario (a) : l'application du texte est discutable (usage non professionnel), mais la mention « IA » ne coûte rien [D].

## 4. Mineurs

Selon l'[art. 45](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135) de la loi Informatique et Libertés, un mineur consent seul dès 15 ans. En dessous, il faut un consentement **conjoint** du mineur et d'un titulaire de l'autorité parentale ; pour la [CNIL](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans), un seul parent suffit [V]. Comme nos données de santé reposent sur le consentement, cette règle s'applique.

Recommandation : **16 ans minimum au lancement public**, avec déclaration d'âge et blocage en dessous. Donner des conseils de poids et de nutrition à des adolescents comporte un risque de troubles alimentaires, et le circuit d'accord parental est lourd [D]. L'interdiction des réseaux sociaux avant 15 ans a été [censurée](https://www.conseil-constitutionnel.fr/decision/2026/2026911DC.htm) le 14 août 2026 ; à suivre seulement si l'appli a des fonctions sociales [V].

## 5. Mentions et responsabilité

- **Mentions légales** (b) : [art. 1-1 LCEN](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614) (ancien art. 6 III, modifié par la loi SREN). Un éditeur non professionnel peut se contenter de publier l'identité de son hébergeur [V]. Mais en auto-hébergement, **c'est vous l'hébergeur** : votre adresse risque d'apparaître. Une association loi 1901 éviterait cela [D].
- **CGU minimales** : éditeur, objet, âge minimal, compte, règles d'usage, limites du coach IA (il peut se tromper), suspension et suppression, droit applicable. Il faut aussi une politique de confidentialité (art. 13).
- **Avertissement** : « appsport ne fournit pas d'avis médical ; consultez un médecin avant de débuter ; arrêtez en cas de douleur. » Prévoir un auto-questionnaire d'aptitude dont les réponses ne sont pas stockées. L'IA doit être réglée pour refuser les diagnostics et renvoyer vers un professionnel [D].
- **Limites** : un avertissement ne protège pas de tout.
  - Entre un professionnel et un consommateur, une clause qui réduit le droit à réparation est une [clause noire](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032807196), donc nulle [V].
  - Ne pas présenter l'IA comme « [diététicien](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006155074/) », titre protégé [V].
  - Le coaching sportif **rémunéré** exige un diplôme ([L.212-1 Code du sport](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037388193)) : à examiner en cas de monétisation [D].
  - Avec la directive 2024/2853, un logiciel devient un « produit » soumis à la responsabilité du fait des produits défectueux pour les mises sur le marché à partir du [9 décembre 2026](https://single-market-economy.ec.europa.eu/single-market/goods/free-movement-sectors/liability-defective-products_en) [V].

## 6. Sécurité (hébergement à domicile)

- **Authentification** :
  - Passkeys ([WebAuthn niveau 3](https://www.w3.org/TR/webauthn-3/), recommandation W3C du 25 août 2026).
  - Mot de passe de secours haché en **Argon2id** : au minimum 19 Mio, t=2, p=1 selon l'[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Argon2id est natif depuis [Node 24.7](https://nodejs.org/api/crypto.html#cryptoargon2algorithm-parameters-callback) [V].
  - Règles de la [CNIL](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000046437451) : si le mot de passe est le seul facteur, 12 caractères variés (ou 14, ou une phrase de 7 mots). Sinon, 8 caractères avec restriction d'accès (par ex. 10 essais par heure, blocage après 10 échecs maximum, temporisation). Sel d'au moins 128 bits [V].
  - Bibliothèque : [Better Auth](https://better-auth.com/blog/authjs-joins-better-auth) (passkeys, limitation du nombre de requêtes). Lucia est abandonné et Auth.js a été repris par Better Auth [V].
- **Sessions** : cookie HttpOnly/Secure/SameSite, identifiant renouvelé à la connexion, expiration, possibilité de fermer toutes les sessions [D]. Les cookies d'authentification sont [exemptés de consentement](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi) : sans traceurs, pas de bandeau cookies [V].
- **E-mails** :
  - Les IP résidentielles figurent sur la liste [PBL de Spamhaus](https://www.spamhaus.org/blocklists/policy-blocklist/), Orange filtre le port 25 ([forum](https://communaute.orange.fr/t5/Webmail-Orange/Probl%C3%A8me-avec-la-mesure-de-s%C3%A9curit%C3%A9-pour-l-envoi-d-emails-via/td-p/3176632)) et [Gmail](https://support.google.com/mail/answer/81126?hl=en) exige un reverse DNS (PTR) + SPF/DKIM [V].
  - Il faut donc un **relais** : [Brevo](https://www.brevo.com/pricing/) (France, 300 e-mails/jour gratuits) ou [Scaleway TEM](https://www.scaleway.com/en/pricing/managed-services/) (France, 300 gratuits puis 0,25 € les 1 000) [V].
  - Configurer SPF + DKIM + DMARC. Liens de vérification et de réinitialisation à usage unique, stockés hachés, valables 15 à 60 min [D].
- **Exposition** : reverse proxy TLS (Let's Encrypt), seul le port 443 ouvert, CrowdSec ou fail2ban [D]. **Éviter Cloudflare Tunnel et le proxy Cloudflare** : il y a [deux connexions TLS distinctes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/), donc Cloudflare voit les données en clair et devient un sous-traitant américain [D]. Pour (a) : VPN Tailscale ou WireGuard, sans exposition publique. Tailscale [Funnel](https://tailscale.com/docs/features/tailscale-funnel) ne déchiffre pas le trafic [V].
- **Données au repos** : chiffrement du disque avec LUKS (en cas de vol ou de cambriolage) [D].
- **Sauvegardes** : règle 3-2-1 avec [restic](https://restic.readthedocs.io/en/stable/100_references.html) (AES-256 + Poly1305, chiffrement côté client) [V], vers un stockage dans l'UE. Par exemple une [Hetzner Storage Box](https://www.hetzner.com/storage/storage-box/), environ 3 €/To/mois (prix à confirmer). Tester la restauration. Garder les sauvegardes 30 jours maximum pour que les suppressions demandées soient effectives [D].
- **Journaux** : connexions, échecs, actions d'administration, exports et suppressions. Conservation 6 à 12 mois, à part du reste, sans données de santé ni prompts [V/D].
- **Mises à jour** : OS mis à jour automatiquement, Renovate ou Dependabot + `pnpm audit`. Node 24 passe en maintenance le 20 octobre 2026 (fin de support le 30 avril 2028) et Node 26 devient LTS le 28 octobre ([calendrier](https://github.com/nodejs/Release/blob/main/schedule.json)) [V]. Référence générale : [guide sécurité CNIL 2024](https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024).

## 7. Socle minimal recommandé

Concevoir la V1 directement au niveau du scénario (b), pour un surcoût faible :
1. Deux consentements séparés (santé, coach IA), champs santé facultatifs, **pas de photos en V1**.
2. Export et suppression du compte par l'utilisateur lui-même ; registre d'une page ; AIPD simplifiée (outil PIA de la CNIL).
3. IA hébergée dans l'UE (Mistral) ou en local ; mention « IA » et garde-fous médicaux.
4. 16 ans minimum ; mentions légales, CGU, politique de confidentialité, avertissement santé.
5. Passkeys + Argon2id + limitation des tentatives ; relais SMTP dans l'UE ; LUKS ; sauvegardes restic hors site ; journaux de 6 à 12 mois ; mises à jour automatiques ; aucun proxy tiers qui déchiffre le trafic.

## Recommandation

Concevoir appsport dès la V1 au niveau d'exigence d'une ouverture au public (scénario b). Le surcoût est faible, même si le lancement se fait d'abord entre proches (scénario a), derrière un VPN.

Six mesures :
1. Données de santé : traiter poids, mensurations, blessures, nutrition et photos comme des données de santé. Recueillir un consentement explicite distinct des CGU, plus un second consentement pour le coach IA. Rendre les champs santé facultatifs et ne pas prévoir de photos en V1.
2. Droits et conservation : export JSON/CSV et suppression du compte par l'utilisateur lui-même ; suppression des comptes inactifs depuis 24 mois, après relance ; journaux conservés 6 à 12 mois. Avant l'ouverture au public : registre d'une page et AIPD simplifiée.
3. Coach IA : hébergé dans l'UE (Mistral, données dans l'UE par défaut) ou local, avec des prompts sans nom ni e-mail. Afficher « vous échangez avec une IA » dès la première interaction (art. 50 AI Act, en vigueur depuis le 2 août 2026) et ajouter une métadonnée ai_generated. Prévoir des garde-fous qui refusent tout diagnostic ou traitement, pour rester hors du champ des dispositifs médicaux.
4. Public et documents : 16 ans minimum pour le public. Mentions légales (via une association pour ne pas exposer notre adresse), CGU, politique de confidentialité et avertissement « pas un avis médical ».
5. Sécurité :
   - authentification par passkeys, avec un mot de passe de secours haché en Argon2id (natif dans Node ≥ 24.7) et la limitation des tentatives prévue par la CNIL 2022-100 ;
   - e-mails via un relais SMTP dans l'UE (Brevo ou Scaleway TEM) avec SPF/DKIM/DMARC ;
   - reverse proxy TLS sans Cloudflare ;
   - disque chiffré avec LUKS ;
   - sauvegardes restic chiffrées hors site dans l'UE, restauration testée ;
   - mises à jour automatiques et passage à Node 26 LTS.
6. HDS : non requis tant qu'aucun professionnel de santé ne suit de patients via l'appli.

Faire relire les CGU et la politique de confidentialité par un juriste avant toute ouverture au public.

## Options

### Périmètre (a) : cercle privé (nous + proches), accès uniquement par VPN (Tailscale/WireGuard)
- Pour : Surface d'attaque minimale : aucun port public ouvert sur la box ; Exemption domestique du RGPD plausible et contrôle CNIL très improbable ; Pas de mentions légales publiques à publier, donc pas d'adresse personnelle exposée ; On peut se passer des e-mails transactionnels : comptes créés sur invitation, réinitialisation manuelle par l'admin, passkeys ; HTTPS possible via les certificats ts.net de Tailscale, utile pour installer la PWA
- Contre : Exemption domestique non garantie (considérant 18 : le RGPD vise celui qui fournit les moyens) ; Chaque proche doit installer et configurer un client VPN ; Pas de croissance possible ; passer à (b) plus tard demandera une mise à niveau (consentements, registre, AIPD) si elle n'a pas été prévue dès le départ ; L'art. 50 de l'AI Act reste probablement applicable (mention IA), même si c'est discutable

### Périmètre (b) : ouverture au public depuis le serveur domestique (reverse proxy TLS, port 443)
- Pour : Audience et retours utilisateurs réels ; Le chiffrement va jusqu'à notre serveur, sans tiers qui déchiffre ; Pas de coût d'hébergement
- Contre : RGPD complet : consentement explicite, registre obligatoire, AIPD très probable, notification de violation sous 72 h, politique de confidentialité ; Mentions légales LCEN : en auto-hébergement, c'est nous l'hébergeur, d'où un risque d'exposer notre adresse sans association ; IP domestique exposée aux scans et au DDoS ; il faut une IP fixe ou un DNS dynamique, CrowdSec/fail2ban et une surveillance ; Disponibilité dépendante de la box et du courant (l'art. 32 inclut la disponibilité) ; Responsabilité civile, et éventuellement droit de la consommation et diplôme d'éducateur sportif en cas de monétisation

### Coach IA via une API hébergée dans l'UE (Mistral La Plateforme)
- Pour : Données hébergées dans l'UE par défaut : pas de transfert hors UE à encadrer ; Entreprise française soumise au RGPD, contrat de sous-traitance disponible ; Cohérent avec un public francophone
- Contre : Coût à l'usage (budget encore inconnu) ; Conservation de 30 jours pour la surveillance des abus selon des sources secondaires ; la non-conservation (zero data retention) serait réservée aux offres supérieures (à vérifier) ; Qualité des réponses à comparer aux modèles américains ; Reste un sous-traitant : contrat, consentement spécifique et pseudonymisation des prompts

### Coach IA via une API américaine (OpenAI / Anthropic)
- Pour : Modèles de pointe ; Contrats de sous-traitance standards avec clauses contractuelles types (Anthropic via Anthropic Ireland) ; Écosystème et outillage matures
- Contre : Transfert de données de santé hors UE : clauses contractuelles types + analyse du transfert, ou DPF fragilisé (pourvoi pendant, PCLOB sans quorum) ; Résidence UE d'OpenAI soumise à des conditions d'éligibilité ; Le consentement explicite et la politique de confidentialité doivent mentionner le transfert ; Image moins rassurante pour des utilisateurs sensibles à la confidentialité de leurs données de santé

### Coach IA local (LLM exécuté sur le serveur domestique)
- Pour : Aucun transfert ni sous-traitant IA : c'est la meilleure posture RGPD ; Coût marginal nul ; Fonctionne même en scénario (a) fermé
- Contre : 16 Go de RAM et GPU inconnu : petits modèles, latence élevée, qualité et sûreté des conseils plus faibles ; Il faut soi-même implémenter les garde-fous médicaux et la modération ; L'art. 50 de l'AI Act (mention IA, marquage) s'applique quand même ; Le serveur doit encaisser la charge de l'inférence en plus de l'application

### Exposition via Cloudflare Tunnel / proxy Cloudflare
- Pour : Aucun port ouvert sur la box, IP domestique masquée ; Protection DDoS et pare-feu applicatif (WAF) gratuits ; Fonctionne même sans IP fixe
- Contre : Le TLS se termine chez Cloudflare (deux connexions distinctes) : les données de santé y passent en clair ; Cloudflare devient sous-traitant américain : contrat, transfert, mention obligatoire dans la politique de confidentialité ; Contradictoire avec l'argument « vos données restent chez nous » ; À éviter pour des données de santé ; préférer un reverse proxy local ou Tailscale Funnel, qui ne déchiffre pas

## Risques

- Fuite de données de santé, par une faille applicative ou par le vol physique du serveur domestique. Conséquences : notification à la CNIL sous 72 h, préjudice pour des proches, responsabilité civile.
- Le coach IA donne des conseils de traitement de blessure ou de pathologie (diabète, troubles alimentaires). L'appli risque d'être requalifiée en dispositif médical, puis en système d'IA à haut risque.
- Conseils IA nuisibles (surentraînement, régime trop restrictif, troubles alimentaires chez des adolescents) : l'avertissement ne suffit pas à écarter la responsabilité, et une clause limitative est nulle face à un consommateur si l'éditeur est un professionnel.
- Données de santé transférées vers une API d'IA américaine : le DPF est fragile (pourvoi devant la CJUE, PCLOB sans quorum). Une invalidation imposerait une migration en urgence.
- Exemption domestique invoquée à tort en scénario (a) : le RGPD s'appliquerait sans consentements, registre ni procédures prévus.
- Mentions légales LCEN en auto-hébergement non professionnel : risque de devoir publier son nom et son adresse personnelle.
- E-mails de vérification ou de réinitialisation bloqués ou classés en spam s'ils partent de l'IP résidentielle (PBL Spamhaus, port 25 filtré, pas de reverse DNS).
- Mineurs qui mentent sur leur âge : la seule déclaration d'âge reste fragile.
- Sauvegardes non chiffrées ou jamais testées ; données supprimées encore présentes dans de vieilles sauvegardes au-delà de la durée annoncée.
- Journaux ou outils de suivi des erreurs qui contiennent des données de santé ou des prompts IA en clair.
- Disponibilité limitée (coupure de courant ou d'Internet au domicile, IP dynamique). L'art. 32 du RGPD couvre aussi la disponibilité et la résilience.
- Le marquage lisible par machine des textes IA (art. 50.2) reste mal défini pour un petit acteur. Les lignes directrices du 20 juillet 2026 et le code de bonnes pratiques peuvent imposer des ajustements.
- Textes encore susceptibles d'évoluer : volet RGPD du Digital Omnibus en négociation, lignes directrices de l'AI Act, et décret HDS 2026-209 si des professionnels de santé arrivent dans l'appli.
- Dépendances d'authentification abandonnées ou en fin de vie (Lucia abandonné, Node 24 en maintenance à partir du 20 oct. 2026) si les mises à jour ne sont pas automatisées.
- Si l'appli est monétisée plus tard : diplôme exigé pour le coaching sportif rémunéré (L.212-1 Code du sport), droit de la consommation, et responsabilité du fait des produits pour les logiciels mis sur le marché à partir du 9 déc. 2026.

## Questions pour nous

- Public cible : restons-nous entre nous et nos proches (a), ou visons-nous une ouverture au public (b) ? Si oui, à quelle échéance ?
- Si nous ouvrons au public, sous quelle forme juridique : personne physique, association loi 1901 ou micro-entreprise ? Acceptons-nous que notre nom et notre adresse apparaissent dans les mentions légales ?
- Une monétisation est-elle envisagée (abonnement, coaching payant, publicité) ? Elle déclencherait le droit de la consommation, l'exigence de diplôme d'éducateur sportif et la responsabilité du fait des produits.
- Âge minimum : 16 ans (notre recommandation) ou 18 ans ? Prévoit-on un jour une version pour les ados avec accord parental ?
- Les photos de progression sont-elles indispensables en V1 ? Si oui, acceptons-nous un stockage chiffré, jamais envoyé à l'IA ?
- Coach IA : acceptons-nous un fournisseur américain (OpenAI/Anthropic) ou exigeons-nous un hébergement dans l'UE (Mistral) ou en local ? Quel budget mensuel pour l'API ?
- Y aura-t-il des fonctions sociales (partage de programmes, classements, messagerie) ? Elles poseraient des questions de modération, de mineurs et de DSA.
- Envisage-t-on des partenariats avec des professionnels de santé (kinés, diététiciens, médecins) qui suivraient des patients via l'appli ? La certification HDS deviendrait alors obligatoire.
- Côté serveur : quel FAI, l'IP est-elle fixe, peut-on ouvrir le port 443, quel OS ? Le disque est-il chiffré ? Y a-t-il un onduleur ?
- Avons-nous déjà un nom de domaine, nécessaire pour SPF/DKIM/DMARC et le relais e-mail ?
- Où placer la sauvegarde hors site : stockage cloud dans l'UE payant (quelques €/mois par To) ou disque chez un proche ?
- Qui sera le responsable de traitement officiel ? Quelle adresse de contact RGPD dédiée utiliser pour les demandes d'accès et de suppression ?
- Veut-on les passkeys dès la V1, ou démarrer avec mot de passe + Argon2id et ajouter les passkeys ensuite ?
- Est-on prêt à faire relire les CGU, la politique de confidentialité et l'avertissement santé par un juriste avant d'ouvrir au public ?

## Affirmations clés

- [haute] Selon la CNIL, des données deviennent des données de santé quand on les croise, par exemple « croisement d'une mesure de poids avec d'autres données (nombre de pas, mesure des apports caloriques…) ». Le poids, les mensurations et la nutrition suivis dans appsport relèvent donc de l'art. 9 RGPD. (https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)
- [haute] La CJUE (C-21/23 Lindenapotheke, 4 oct. 2024) considère comme données de santé toutes les données qui permettent de tirer des conclusions sur l'état de santé d'une personne. C'est une interprétation large. (https://www.taylorwessing.com/en/insights-and-events/insights/2024/10/ecj-lindenapotheke)
- [haute] Pour une appli de bien-être, la CNIL exige l'accord exprès de l'utilisateur. Cet accord ne peut pas prendre la forme d'une case à cocher qui vaut acceptation des CGU. (https://www.cnil.fr/fr/applications-mobiles-en-sante-et-protection-des-donnees-personnelles-les-questions-se-poser)
- [moyenne] Le considérant 18 du RGPD applique le règlement à ceux qui fournissent les moyens d'un traitement domestique. Héberger les données de ses proches (scénario a) n'est donc pas sûr d'échapper au RGPD. (https://gdpr-text.com/read/recital-18/)
- [haute] Le registre des traitements est obligatoire même pour une structure de moins de 250 salariés dès qu'elle traite des données de l'art. 9, comme des données de santé. (https://gdpr-info.eu/art-30-gdpr/)
- [haute] La CNIL juge proportionné de supprimer un compte inactif depuis 2 ans, en prévenant l'utilisateur avant (page du 18 sept. 2025). (https://www.cnil.fr/fr/achat-de-contenus-numeriques-quelle-duree-de-conservation-des-comptes-inactifs)
- [haute] La CNIL recommande de conserver les journaux d'activité entre 6 mois et 1 an (délibération 2021-122). (https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000044283637)
- [haute] La certification HDS ne vise que l'hébergement pour le compte de tiers de données recueillies lors d'activités de prévention, de diagnostic, de soins ou de suivi social et médico-social. Une appli de bien-être hébergée par son propre éditeur n'est pas concernée, tant qu'aucun professionnel de santé n'y suit de patients. (https://gnius.esante.gouv.fr/en/regulations/regulation-profiles/healthcare-data-hosting-hds)
- [moyenne] Le décret 2026-209 du 24 mars 2026 impose aux hébergeurs HDS un stockage dans l'UE/EEE, applicable fin septembre 2026. (https://www.vigier-avocats.com/hebergement-des-donnees-de-sante-le-decret-du-24-mars-2026-renforce-la-souverainete-la-territorialite-et-la-transparence/)
- [haute] L'art. 50 de l'AI Act (informer l'utilisateur qu'il échange avec une IA) s'applique depuis le 2 août 2026. Le règlement Omnibus IA (UE) 2026/1744, publié le 24 juillet et en vigueur le 27 juillet 2026, ne l'a pas reporté. Il a reporté le haut risque de l'Annexe III au 2 déc. 2027. (https://www.nicfab.eu/en/posts/digital-omnibus-ai-official-journal/)
- [haute] Le délai de grâce pour le marquage lisible par machine (art. 50.2), jusqu'au 2 décembre 2026, ne concerne que les systèmes mis sur le marché avant le 2 août 2026. (https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/08/eu-ai-acts-transparency-rules-what-went-into-effect-on-2-august)
- [haute] L'exemption de l'AI Act pour les logiciels libres (art. 2.12) ne couvre pas les systèmes soumis à l'art. 50. Publier appsport en open source ne dispense donc pas de la transparence. (https://artificialintelligenceact.eu/article/2/)
- [haute] Un logiciel destiné au mode de vie et au bien-être n'est pas un dispositif médical (considérant 19 du règlement 2017/745). Le coach doit donc éviter tout diagnostic ou traitement pour ne pas être requalifié en dispositif médical à haut risque. (https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf)
- [haute] En France, un mineur consent seul dès 15 ans (art. 45 de la loi Informatique et Libertés). En dessous, le consentement doit être donné conjointement par le mineur et un titulaire de l'autorité parentale. (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037823135)
- [haute] L'article 1er de la loi interdisant les réseaux sociaux aux moins de 15 ans a été censuré par le Conseil constitutionnel (DC 2026-911, 14 août 2026). (https://www.conseil-constitutionnel.fr/decision/2026/2026911DC.htm)
- [haute] Les mentions légales relèvent désormais de l'art. 1-1 de la LCEN. Un éditeur non professionnel peut ne publier que l'identité de son hébergeur, à condition de lui avoir communiqué la sienne. (https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614)
- [haute] Entre un professionnel et un consommateur, une clause qui supprime ou réduit le droit à réparation est une clause noire, donc nulle (art. R.212-1 6° du Code de la consommation). Un avertissement « pas un avis médical » ne protège pas de tout. (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032807196)
- [haute] La nouvelle directive sur la responsabilité du fait des produits couvre les logiciels et les applications. Elle s'applique aux produits mis sur le marché à partir du 9 décembre 2026. (https://single-market-economy.ec.europa.eu/single-market/goods/free-movement-sectors/liability-defective-products_en)
- [haute] L'OWASP recommande Argon2id avec au minimum 19 Mio de mémoire, 2 itérations et un parallélisme de 1. (https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [haute] Node.js propose crypto.argon2 / argon2Sync (argon2id) en natif depuis la v24.7.0. La v24.21.0 installée sur le poste de dev l'expose bien. (https://nodejs.org/api/crypto.html#cryptoargon2algorithm-parameters-callback)
- [haute] Recommandation CNIL 2022-100 : si le mot de passe est le seul facteur, au moins 12 caractères mêlant majuscules, minuscules, chiffres et caractères spéciaux (ou 14 sans caractère spécial, ou une phrase de 7 mots). Avec une restriction d'accès, 8 caractères suffisent (temporisation, 10 essais par heure, blocage après 10 échecs maximum). Sel d'au moins 128 bits. (https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000046437451)
- [haute] WebAuthn niveau 3 (passkeys) est une recommandation W3C depuis le 25 août 2026. (https://www.w3.org/TR/webauthn-3/)
- [haute] Les IP résidentielles sont listées dans la PBL de Spamhaus, qui recommande de passer par un relais SMTP authentifié. Gmail exige aussi un reverse DNS (PTR) valide et SPF ou DKIM de tous les expéditeurs : un envoi direct depuis le serveur domestique est voué à l'échec. (https://www.spamhaus.org/blocklists/policy-blocklist/)
- [haute] Brevo (France) permet d'envoyer gratuitement 300 e-mails par jour, campagnes et e-mails transactionnels compris. (https://www.brevo.com/pricing/)
- [haute] Scaleway Transactional Email (France) : 300 e-mails gratuits par organisation, puis 0,25 € les 1 000 e-mails supplémentaires sans abonnement. (https://www.scaleway.com/en/pricing/managed-services/)
- [haute] Cloudflare gère deux connexions TLS distinctes (visiteur vers Cloudflare, Cloudflare vers le serveur d'origine). Avec Cloudflare en façade, le trafic, donc les données de santé, est déchiffré chez ce prestataire américain. (https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
- [haute] Les serveurs relais de Tailscale Funnel ne déchiffrent pas le trafic : la connexion TLS est terminée sur la machine de l'utilisateur. (https://tailscale.com/docs/features/tailscale-funnel)
- [haute] Le contrat de sous-traitance d'Anthropic (en vigueur depuis le 24 fév. 2025) s'appuie sur les clauses contractuelles types, modules 2 et 3. Les services dans l'UE sont fournis par Anthropic Ireland Limited. (https://www.anthropic.com/legal/data-processing-addendum)
- [haute] Mistral AI héberge par défaut les données de son API dans l'Union européenne. Elles ne sont hébergées aux États-Unis que si l'on utilise explicitement l'endpoint US (page du 12 août 2026). (https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data)
- [moyenne] Le Tribunal de l'UE a validé le cadre de transfert UE–États-Unis (DPF) en septembre 2025 (T-553/23). Un pourvoi est pendant devant la CJUE : le DPF reste fragile pour transférer des données de santé. (https://data-en-maatschappij.ai/en/publications/general-court-latombe)
- [moyenne] Le volet RGPD du Digital Omnibus était toujours en négociation en septembre 2026, sans mandat du Conseil. Aucune modification de l'art. 9 n'est applicable. (https://acompli.ie/news/digital-omnibus-gdpr-cookies-status-september-2026/)
- [haute] Calendrier Node.js : la v24 passe en maintenance le 20 octobre 2026 et n'est plus supportée après le 30 avril 2028. La v26 devient LTS le 28 octobre 2026. (https://github.com/nodejs/Release/blob/main/schedule.json)
- [haute] restic chiffre tout le dépôt de sauvegarde côté client, en AES-256 (mode compteur) authentifié par Poly1305-AES, avec une clé dérivée par scrypt. (https://restic.readthedocs.io/en/stable/100_references.html)

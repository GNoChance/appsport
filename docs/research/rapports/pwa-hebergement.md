# PWA auto-hébergée sur un serveur domestique en France : exigences PWA et état d'iOS en 2026, offline-first, outillage par framework, exposition réseau (CGNAT des FAI, tunnels), exploitation

# PWA auto-hébergée sur serveur domestique en France : état au 6 octobre 2026

**En bref.** Une PWA de suivi de séances est viable en 2026, iPhone compris, à trois conditions. Il faut du HTTPS sur un vrai nom de domaine. Il faut une conception *offline-first*, car Background Sync n'existe que sous Chromium. Enfin il faut une IPv4 complète : les quatre grands FAI partagent maintenant l'IPv4 par défaut (Orange aussi, depuis janvier 2025). Architecture conseillée : Docker Compose + Caddy (HTTPS automatique) + redirection des ports 80/443, administration via Tailscale, sauvegardes restic selon la règle 3-2-1.

## 1. Exigences PWA et état réel d'iOS

- **HTTPS obligatoire** : les service workers ne fonctionnent qu'en contexte sécurisé, c'est-à-dire en HTTPS, ou sur `localhost` en développement ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)). Pour tester sur un téléphone depuis le poste Windows, il faudra donc un certificat valide (déduit).
- **Android/Chrome** : il faut un manifest (`name`, icônes 192 et 512, `start_url`, `display`). Le service worker n'est plus exigé pour installer via le menu depuis Chrome 108 (mobile) et 112 (desktop). Il l'était encore fin 2023 pour l'invite automatique ([Chrome](https://developer.chrome.com/blog/update-install-criteria)). Cette source date de 2023 et reste à revérifier.
- **iOS/iPadOS 26 et plus** : tout site ajouté à l'écran d'accueil s'ouvre par défaut comme une web app, et le manifest reste exploité ([WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Il n'existe pas de `beforeinstallprompt` : il faut un écran d'aide « Partager → Sur l'écran d'accueil ». Safari 27 (17/09/2026) n'annonce aucune nouveauté PWA majeure, à part le *static routing* des service workers ([WebKit](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)).
- **Web Push** : disponible à partir d'iOS 16.4, seulement pour une web app installée, et la permission doit être demandée sur un geste de l'utilisateur ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Le *Declarative Web Push* existe depuis iOS 18.4 ([WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)).
- **UE/DMA** : le 1er mars 2024, Apple a renoncé à supprimer les web apps ([MacRumors](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/)). Elles fonctionnent en France, mais uniquement via WebKit. En mai 2026, aucun moteur de navigateur tiers n'avait été livré sur iOS dans l'UE ([OWA](https://open-web-advocacy.org/blog/the-digital-markets-act-is-delivering-real-wins-but-not-yet-for-browser-engines/)).
- **Stockage** : depuis Safari 17, une origine peut utiliser jusqu'à 60 % du disque, avec le même quota en web app. `navigator.storage.persist()` est supporté ; Safari l'accorde selon des heuristiques, dont l'usage en web app ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). Les web apps installées échappent au plafond ITP de 7 jours ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). En revanche, leur stockage est séparé de Safari, donc l'utilisateur doit se reconnecter après l'installation ([WWDC23](https://developer.apple.com/videos/play/wwdc2023/10120/)). Ces sources datent de 2020 à 2023 et décrivent la politique la plus récente que j'ai trouvée. Les blogs qui parlent d'un maximum de 50 Mo sont périmés.

| API | Chrome Android | iOS (web app installée) | Firefox |
|---|---|---|---|
| Background Sync | oui | **non** | non ([caniuse](https://caniuse.com/background-sync)) |
| Wake Lock | oui | oui depuis **iOS 18.4** ([WebKit](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)) | oui (126+) |
| Vibration | oui | **non** ([caniuse](https://caniuse.com/vibration)) | non (retirée en 129) |
| Caméra (`getUserMedia`) | oui | oui depuis iOS 13.4 ([WebKit](https://bugs.webkit.org/show_bug.cgi?id=185448)) | oui |
| `BarcodeDetector` | oui | non ([caniuse](https://caniuse.com/mdn-api_barcodedetector)) | non → polyfill ZXing-WASM [`barcode-detector`](https://www.npmjs.com/package/barcode-detector) |

**Minuteur de repos** : Chrome a abandonné les notifications locales programmées ([Chrome](https://developer.chrome.com/docs/web-platform/notification-triggers)). De plus, iOS suspend vite une web app passée en arrière-plan ; c'est un constat de la communauté, non documenté par Apple. Solution : garder l'écran allumé avec Wake Lock pendant la séance, et faire envoyer par le serveur un Web Push programmé pour la fin du repos.

## 2. Offline-first à la salle

- **Local d'abord** : IndexedDB via Dexie (4.4.6, sept. 2026, 14,6 k★). Chaque série est d'abord écrite sur le téléphone, puis ajoutée à une table *outbox* en attente d'envoi. Demander `persist()` après la première séance et proposer un export JSON/CSV.
- **Synchro idempotente** :
  - les identifiants sont des UUIDv7 générés sur le téléphone ([RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) ; `uuidv7()` est natif dans [PostgreSQL 18](https://www.postgresql.org/docs/18/release-18.html)) ;
  - le serveur fait un upsert `ON CONFLICT (id)`, donc un envoi répété ne crée pas de doublon ;
  - l'outbox est vidée au démarrage, sur les événements `online` et `visibilitychange`, et après chaque série ;
  - Background Sync n'est qu'un bonus sur Android.
- **Conflits** (déduit) :
  - séances et séries en *append-only* : on ajoute, on ne modifie pas ;
  - modifications en « dernier qui écrit gagne », champ par champ, avec une version tenue par le serveur ;
  - suppressions par *tombstones* (une marque de suppression plutôt qu'un effacement).

  Les moteurs de synchro sont surdimensionnés pour ce besoin : Dexie Cloud (0,12 € par utilisateur et par mois, ou 3 495 € en auto-hébergé, voir les [tarifs](https://dexie.org/cloud/pricing)), PowerSync ou ElectricSQL.
- **Cache** :
  - *precache* de la coquille de l'appli ;
  - images d'exercices en *CacheFirst* avec expiration, plus un bouton « télécharger la bibliothèque » ;
  - lectures de l'API (GET) en *NetworkFirst* avec un délai court.
- **Mises à jour** : le nouveau service worker attend que l'ancien n'ait plus aucun onglet ouvert ([web.dev](https://web.dev/articles/service-worker-lifecycle)). Préférer le mode `prompt` à `autoUpdate`, car `autoUpdate` recharge la page et peut faire perdre une saisie ([vite-pwa](https://vite-pwa-org.netlify.app/guide/auto-update)). Ne proposer la mise à jour qu'en dehors d'une séance, et servir `sw.js` en `no-cache`.

## 3. Outillage (octobre 2026)

| Framework | Outil | État |
|---|---|---|
| Vite (React/Vue/Svelte) | `vite-plugin-pwa` | MIT, 4,3 k★, v2.0.0 du 03/10/2026. Ses mainteneurs annoncent qu'il sera gelé au profit de `@vite-pwa/core` et d'un fork de Workbox encore jeune ([#933](https://github.com/vite-pwa/vite-plugin-pwa/issues/933)) → migration probable |
| SvelteKit / Nuxt | `@vite-pwa/sveltekit` 1.1.0, `@vite-pwa/nuxt` 1.1.1 | mises à jour peu fréquentes |
| Next.js 16 | Serwist 9.5.12 (`@serwist/turbopack`) | cité par le [guide officiel](https://nextjs.org/docs/app/guides/progressive-web-apps) ; `next-pwa` est abandonné |
| Tous | Workbox 7.4.1 (mai 2026) | maintenance minimale par l'équipe Chrome. L'« arrêt » annoncé par vite-pwa n'est pas confirmé par Google |

## 4. Exposer le serveur

**CGNAT (IPv4 partagée entre plusieurs abonnés), par FAI** :
- **Free** : chaque abonné reçoit une plage de ports sur une IPv4 partagée. L'IPv4 fixe *full-stack* se demande dans l'espace abonné ; l'opération est irréversible ([Univers Freebox](https://www.universfreebox.com/article/596643/le-saviez-vous-free-permet-de-debloquer-une-possibilite-supplementaire-sur-votre-connexion-freebox-derriere-un-nom-plutot-intimidant)).
- **Orange** : CGNAT activé par défaut depuis janvier 2025, désactivable dans la Livebox ([MacG](https://www.macg.co/ailleurs/2025/01/orange-partage-son-tour-par-defaut-les-ipv4-pour-les-abonnes-adsl-et-fibre-148513), [Univers Freebox](https://www.universfreebox.com/article/576218/orange-active-une-nouvelle-fonctionnalite-sur-ses-livebox-qui-nest-pas-sans-defauts)). L'IP n'est que « préférentielle », pas garantie fixe ([Orange](https://assistance.orange.fr/livebox-modem/toutes-les-livebox-et-modems/installer-et-utiliser/piloter-et-parametrer-votre-materiel/le-parametrage-avance-reseau-nat-pat-ip/gerer-votre-adresse-ip/adresses-ip-les-elements-a-connaitre-_238182-760947)).
- **Bouygues** : option « IP dédiée » dans l'espace client ([blog](https://blog.jeanvw.fr/fr/posts/configurer-sa-bbox-pour-avoir-une-ip-publique-dediee/)).
- **SFR/RED** : retour en IPv4 complète (« rollback IPv4 full stack ») en passant par le support ; l'outil était signalé défaillant en 2023 ([lafibre.info](https://lafibre.info/sfr-la-fibre/ipv6-ipv4-cgnat-red-by-sfr/)).

**IPv6** : fin 2025, 94 % des clients fixes et 83 % des clients mobiles l'avaient, mais seulement 50 % chez Free Mobile ([Arcep 2026](https://lafibre.info/ipv6/barometre-ipv6-2026/)). Un serveur joignable uniquement en IPv6 ne suffit donc pas.

| Option | Coût | Avantages | Inconvénients |
|---|---|---|---|
| Redirection 80/443 + DDNS + Caddy | nom de domaine (~10 €/an, estimation) | aucun tiers ne voit les données ; HTTPS automatique ; pas de limite | IPv4 complète requise ; IP du domicile exposée |
| Cloudflare Tunnel | gratuit ([tous plans](https://developers.cloudflare.com/tunnel/)) | aucun port ouvert ; fonctionne derrière CGNAT | Cloudflare termine le TLS, donc voit le trafic en clair ([doc](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)) ; domaine obligatoirement chez Cloudflare ([doc](https://developers.cloudflare.com/tunnel/get-started/)) ; envois limités à 100 Mo ([doc](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)) |
| Tailscale Funnel | gratuit | TLS terminé chez vous | en bêta ; noms en `*.ts.net` seulement ; débit bridé ([doc](https://tailscale.com/kb/1223/funnel)) |
| VPS + WireGuard (ex. Pangolin) | ~4–6 €/mois (estimation) | contourne le CGNAT | une machine de plus à maintenir |
| Tailscale privé, sans exposition | gratuit jusqu'à 6 utilisateurs | aucune surface d'attaque publique | chaque utilisateur active un VPN ; noms de machines publiés dans les journaux publics de certificats ([doc](https://tailscale.com/kb/1153/enabling-https)) |

Traefik 3.7 et Nginx Proxy Manager 2.16 (interface web) conviennent aussi, mais Caddy reste le plus simple. La durée des certificats Let's Encrypt passera à 64 jours en février 2027, puis à 45 jours en février 2028 ([LE](https://letsencrypt.org/2025/12/02/from-90-to-45)). Le renouvellement doit donc être automatique et surveillé.

**Vie privée** : selon la [CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante), le poids croisé avec les apports caloriques devient une donnée de santé. C'est un argument contre le fait de laisser un tiers terminer le TLS.

## 5. Exploitation

- **Réseau** : seul Caddy publie des ports ; l'appli et Postgres restent sur un réseau Docker interne. Attention : Docker contourne UFW pour les ports publiés ([Docker](https://docs.docker.com/engine/network/packet-filtering-firewalls/)). SSH et tableaux de bord passent uniquement par Tailscale ([tarifs](https://tailscale.com/pricing)).
- **Durcissement** : CrowdSec avec son module pour Caddy plutôt que fail2ban pour le trafic HTTP, et mises à jour de sécurité automatiques de l'OS.
- **Mises à jour** : Watchtower est archivé ([GitHub](https://github.com/containrrr/watchtower)). Dependabot gère Docker Compose depuis février 2025 ([GitHub](https://github.blog/changelog/2025-02-25-dependabot-version-updates-now-support-docker-compose-in-general-availability/)). Pas de runner GitHub auto-hébergé si le dépôt est public ([GitHub](https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners)).
- **Sauvegardes 3-2-1** :
  - `pg_dump -Fc` chaque jour ; la copie est cohérente et ne bloque pas la base ([doc](https://www.postgresql.org/docs/current/app-pgdump.html)) ;
  - envoi par restic (chiffré, dédupliqué) vers un second disque, plus une copie hors du domicile. Backblaze B2 offre 10 Go gratuits, puis 6,95 $/To/mois ([tarifs](https://www.backblaze.com/cloud-storage/pricing)) ;
  - test de restauration chaque mois.
- **Supervision** : Beszel et Uptime Kuma, plus une sonde externe pour détecter une coupure de la box ou de courant.
- **E-mails de compte** : les box filtrent par défaut le port 25 sortant ([exemple](https://homeprotection.fr/content-65-comment-desactiver-le-blocage-smtp-sortant-sur-ma-box-internet-ou-modifier-le-filtre-smtp-port-25/)), et les IP résidentielles ont une mauvaise réputation. Il faut passer par un relais SMTP transactionnel.
- **RAM (estimation)** :
  - OS + Docker ~1 Go, Postgres 1–1,5 Go, appli ~0,3 Go, Caddy/CrowdSec/supervision ~0,5 Go, soit environ 3,5 Go ;
  - il reste ~12 Go. Un LLM 8B quantifié tient avec son contexte (Ministral 3 8B : 6,0 Go, [Ollama](https://ollama.com/library/ministral-3)) ; un 14B (~9 Go) devient juste ;
  - sans GPU, compter de quelques tokens/s à ~25 tokens/s selon le CPU, une requête à la fois. Plafonner sa mémoire via `mem_limit` pour protéger Postgres.

## 6. Architecture par défaut

- Linux LTS + Docker Compose, versionné dans le dépôt.
- Images construites par GitHub Actions et publiées sur GHCR.
- Chaîne : Caddy → appli Node → PostgreSQL 18.
- IPv4 complète + enregistrement AAAA (IPv6), redirection des ports 80/443. DDNS via l'API du registrar si l'IP change.
- Tailscale pour l'administration, CrowdSec, sauvegardes restic 3-2-1.

**Repli** si l'IPv4 complète est impossible : Cloudflare Tunnel si vous acceptez que vos données passent chez Cloudflare, sinon VPS + WireGuard. Si l'appli reste familiale (6 personnes au plus), Tailscale privé supprime toute exposition.

*Vérifié* : les éléments sourcés. *Déduit ou estimé* : budget RAM, débit du LLM, modèle de conflits, prix du VPS et du domaine.

## Recommandation

**Serveur.** Linux LTS (Debian ou Ubuntu) avec Docker Compose, versionné dans le dépôt GitHub. Les images sont construites par les runners hébergés de GitHub Actions, publiées sur GHCR, puis récupérées par le serveur. Seul Caddy est exposé, avec HTTPS automatique Let's Encrypt. Derrière lui : l'appli Node, puis PostgreSQL 18 sur un réseau Docker interne.

**Exposition.** Obtenir une IPv4 complète auprès du FAI :
- Free : demander l'IPv4 full-stack ;
- Orange : désactiver le CGN dans la Livebox ;
- Bouygues : souscrire l'option IP dédiée ;
- SFR : demander le rollback au support.

Ajouter un enregistrement AAAA pour l'IPv6, rediriger les ports TCP 80/443, et utiliser le DDNS via l'API du registrar si l'IP n'est pas fixe.

**Administration et exploitation.**
- SSH, Beszel et Uptime Kuma accessibles uniquement via Tailscale.
- CrowdSec avec son module pour Caddy, et mises à jour automatiques de l'OS.
- Dependabot pour les images Docker.
- Sauvegardes quotidiennes `pg_dump -Fc` envoyées par restic vers un disque local et vers une copie hors du domicile, avec un test de restauration régulier.

**Côté appli.** PWA qui fonctionne hors ligne : Dexie et une file d'envoi idempotente avec des identifiants UUIDv7. Mises à jour en mode prompt, proposées hors séance. Pour le minuteur de repos : Wake Lock pendant la séance, et un Web Push envoyé par le serveur.

**Repli si l'IPv4 complète est impossible.** Cloudflare Tunnel, si vous acceptez que Cloudflare voie des données potentiellement de santé ; sinon un VPS avec WireGuard. Si l'appli reste limitée à 6 proches au plus, Tailscale privé évite toute exposition publique.

**Outillage.** vite-plugin-pwa, ou Serwist si vous choisissez Next.js, en prévoyant la migration vers @vite-pwa/core. Pour un LLM local : uniquement un modèle 8B quantifié, avec une limite de mémoire.

## Options

### Exposition A : redirection des ports 80/443 + DDNS + Caddy (défaut recommandé)
- Pour : Aucun tiers ne déchiffre le trafic, alors que poids et nutrition peuvent être des données de santé ; Gratuit, hors nom de domaine (~10 €/an, estimation) ; HTTPS automatique, renouvelé par Caddy (2.11.7, oct. 2026) ; Pas de limite d'upload ni de débit imposée par un tiers ; Compatible IPv4 et IPv6
- Contre : Exige une IPv4 complète, alors que le CGNAT est activé par défaut chez les 4 grands FAI ; IP du domicile publique : scans et DDoS possibles ; Sécurité et mises à jour entièrement à votre charge ; DDNS nécessaire si l'IP n'est pas fixe (chez Orange, l'IP est seulement « préférentielle »)

### Exposition B : Cloudflare Tunnel
- Pour : Disponible sur tous les plans, sans aucun port entrant ouvert ; Fonctionne derrière un CGNAT ; Protection DDoS/WAF et cache CDN inclus ; Mise en place rapide (cloudflared en conteneur)
- Contre : Cloudflare termine le TLS et peut voir le trafic en clair ; Le domaine doit obligatoirement être géré chez Cloudflare ; Upload limité à 100 Mo par requête sur le plan Free ; Dépendance à un fournisseur américain, à analyser au regard du RGPD si l'appli s'ouvre au public

### Exposition C : Tailscale Funnel
- Pour : Gratuit ; TLS terminé sur votre machine : les relais Tailscale ne voient pas le contenu ; Fonctionne derrière un CGNAT
- Contre : Fonction encore en bêta ; Noms en *.ts.net uniquement, pas de domaine personnalisé ; Ports 443/8443/10000 seulement, et débit bridé non configurable ; Peu adapté à une appli publique durable

### Exposition D : VPS relais + WireGuard (Pangolin, ou simple transfert TCP/SNI sans déchiffrement)
- Pour : Contourne n'importe quel CGNAT ; Domaine personnalisé et pas de limite d'upload ; Avec un simple transfert TCP, le TLS reste terminé chez vous (déduit) ; Pangolin est open source et activement développé (1.24.0, sept. 2026)
- Contre : Coût récurrent d'un VPS (~4–6 €/mois, estimation) ; Une machine supplémentaire à sécuriser et mettre à jour ; Latence en plus ; avec Pangolin, le TLS est terminé sur le VPS

### Exposition E : Tailscale privé, sans exposition publique
- Pour : Aucune surface d'attaque publique ; Gratuit jusqu'à 6 utilisateurs (plan Personal) ; Fonctionne derrière un CGNAT, avec des certificats HTTPS en *.ts.net
- Contre : Chaque utilisateur doit installer et activer Tailscale, donc un VPN sur son téléphone à la salle ; Inadapté si l'appli s'ouvre au public ; Noms de machines publiés dans les journaux publics de certificats (Certificate Transparency)

### Outillage : vite-plugin-pwa (Vite : React/Vue/Svelte, SvelteKit, Nuxt)
- Pour : Le plus répandu (MIT, 4,3 k étoiles) ; v2.0.0 publiée le 03/10/2026 ; Intégrations SvelteKit et Nuxt disponibles ; Mode prompt documenté pour éviter de perdre une saisie lors d'une mise à jour
- Contre : Gel en maintenance annoncé au profit de @vite-pwa/core : migration probable ; Repose sur Workbox, que Google ne maintient plus qu'au minimum ; Les intégrations pour les méta-frameworks seront mises à jour en dernier

### Outillage : Serwist (Next.js 16 ; existe aussi pour Vite)
- Pour : Cité par le guide PWA officiel de Next.js (mis à jour en juillet 2026) ; Compatible Turbopack (@serwist/turbopack) ; Fork modernisé de Workbox, sous licence MIT, actif (9.5.12, juillet 2026)
- Contre : Communauté plus petite (1,5 k étoiles) ; Moins de tutoriels côté Vite ; Next.js impose un serveur Node et plus de complexité qu'une simple appli monopage

### Synchro : Dexie + file d'envoi idempotente maison, ou moteur de synchro (Dexie Cloud, PowerSync, ElectricSQL)
- Pour : Maison : aucune dépendance payante, contrôle total, et un modèle « on ajoute sans modifier » qui suffit pour des séances ; Dexie Cloud : synchro et conflits gérés clés en main (0,12 € par utilisateur et par mois, ou 3 495 € en auto-hébergé)
- Contre : Maison : ré-essais, versions et marques de suppression à écrire et à tester soi-même ; Moteurs de synchro : coût, dépendance à un fournisseur et complexité disproportionnée pour ce besoin

## Risques

- CGNAT impossible à lever, ou procédure du FAI défaillante (SFR signalé en 2023) : sans IPv4 complète, pas de redirection de ports possible. Il faut alors basculer sur un tunnel ou un VPS.
- IP du domicile exposée : scans et tentatives d'intrusion permanents, DDoS possible sur la connexion familiale. La sécurité repose entièrement sur vous (mises à jour, CrowdSec, pare-feu).
- Mauvaise configuration Docker/UFW : PostgreSQL ou un tableau de bord peut se retrouver exposé sur Internet malgré des règles UFW en apparence fermées.
- Aucune garantie de disponibilité à domicile : une coupure de courant, de la box ou du FAI rend l'API inaccessible. Le fonctionnement hors ligne limite les dégâts, mais pas pour le coach IA ni la création de compte.
- Perte de données sur le téléphone si IndexedDB est vidé avant la synchro : site non installé sur iOS soumis au plafond de 7 jours, ou web app supprimée. Parade : synchroniser souvent, demander persist(), proposer un export.
- Limites d'iOS : pas de Background Sync ni de vibration, mise en veille rapide en arrière-plan, Web Push seulement après installation, stockage séparé de Safari. Cela crée de la friction à l'inscription et pour le minuteur de repos.
- Outillage PWA en transition : gel annoncé de vite-plugin-pwa et fork de Workbox encore jeune. Une migration est probable.
- Données potentiellement de santé au sens de la CNIL : obligations RGPD renforcées (consentement explicite, sécurité) si l'appli s'ouvre au public. Une terminaison TLS chez Cloudflare ajoute un tiers dans la boucle.
- LLM local sur CPU : lent (une requête à la fois), et la pression mémoire peut provoquer un OOM qui tue PostgreSQL si aucune limite n'est posée.
- Certificats de plus en plus courts (45 jours en 2028) : un renouvellement raté et non surveillé rend l'appli inaccessible, car le service worker exige un HTTPS valide.
- Sauvegardes jamais testées ou sans copie hors du domicile : un seul incident (disque, vol, incendie, ransomware) peut tout effacer.
- Délivrabilité des e-mails de compte (vérification, mot de passe oublié) : port 25 filtré et IP résidentielle mal réputée si l'on envoie directement depuis la box.
- Un runner GitHub auto-hébergé sur un dépôt public permettrait à n'importe qui d'exécuter du code sur le serveur domestique.
- Débit montant peut-être insuffisant (ADSL) pour servir les images et GIF d'exercices. Non vérifiable tant que le FAI et le type de ligne ne sont pas connus.

## Questions pour nous

- Quel système tourne sur le serveur (Linux, Windows, Proxmox, Unraid, TrueNAS…) ? Est-il dédié à ce projet ou partagé avec d'autres services ?
- Quel est le modèle exact du processeur ? Y a-t-il une carte graphique (modèle, mémoire vidéo) ? Quels disques (SSD ou HDD, RAID) ? Un onduleur ?
- Quel FAI et quelle box (Free, Orange, SFR, Bouygues, autre) ? Fibre ou ADSL, et quel débit montant ? L'IPv4 est-elle actuellement partagée, et acceptez-vous de demander une IPv4 complète (irréversible chez Free) ?
- Avez-vous déjà un nom de domaine ? Chez quel registrar ou hébergeur DNS, et propose-t-il une API pour le DNS dynamique ? Sinon, quel nom et quelle extension voulez-vous (.fr, .app…) ?
- À qui s'adresse l'appli : uniquement vous et vos proches (6 personnes au plus, ce qui permet un accès Tailscale privé) ou au public ? Combien d'utilisateurs visez-vous dans 12 mois ?
- Acceptez-vous qu'un tiers comme Cloudflare voie le trafic en clair (poids, nutrition = données potentiellement de santé selon la CNIL) ?
- Le dépôt GitHub sera-t-il public ou privé ? Cela change la gestion de la CI/CD, des secrets et des runners.
- Quelle part de vos utilisateurs est sur iPhone et quelle part sur Android ? Les notifications (fin de repos, rappels de séance) sont-elles indispensables ?
- Où mettre la copie de sauvegarde hors du domicile : un stockage cloud (avec quel budget mensuel) ou un disque chez un proche ?
- Quelle disponibilité attendez-vous (les coupures à la maison sont-elles acceptables) ? Qui s'occupera du serveur au quotidien ?
- Comment les comptes seront-ils créés : e-mail et mot de passe, lien magique, passkeys ? Faudra-t-il envoyer des e-mails (vérification, réinitialisation) ?
- Voulez-vous scanner les codes-barres des aliments pour la nutrition (caméra, base de type Open Food Facts) ?
- Le coach IA doit-il tourner sur le serveur (Ollama, qui partage les 16 Go de RAM) ou passer par une API externe ? Avec quel budget ?
- Avez-vous une préférence pour le framework front (React, Vue, Svelte, Next.js) ? Elle détermine l'outillage PWA (vite-plugin-pwa ou Serwist).
- Quel budget mensuel acceptez-vous pour les services annexes (domaine, VPS de secours, stockage des sauvegardes, envoi d'e-mails) ?

## Affirmations clés

- [haute] Les service workers ne fonctionnent qu'en contexte sécurisé (HTTPS) ; seul http://localhost est toléré, pour le développement. (https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [haute] Depuis iOS/iPadOS 26, tout site ajouté à l'écran d'accueil s'ouvre par défaut comme une web app. Le manifest n'est plus requis mais reste utilisé (icônes, etc.). (https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [moyenne] Safari 27.0 (17/09/2026) n'annonce pas de nouveauté PWA majeure, à part le static routing des service workers. (https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- [haute] Sur iOS, le Web Push n'est disponible que pour les web apps installées sur l'écran d'accueil (iOS 16.4 et plus), avec une permission demandée sur un geste de l'utilisateur. (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [haute] Dans l'UE, les web apps d'écran d'accueil restent disponibles (Apple est revenu sur sa décision en mars 2024), mais uniquement via WebKit. En mai 2026, aucun moteur de navigateur tiers n'était livré sur iOS dans l'UE. (https://open-web-advocacy.org/blog/the-digital-markets-act-is-delivering-real-wins-but-not-yet-for-browser-engines/)
- [haute] Background Sync n'est supporté ni par Safari (toutes plateformes) ni par Firefox. Seuls les navigateurs Chromium l'implémentent. (https://caniuse.com/background-sync)
- [haute] Le Wake Lock (écran allumé) fonctionne dans les web apps iOS installées seulement depuis iOS 18.4. Il était cassé de 16.4 à 18.3. (https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [haute] L'API Vibration n'existe pas sur Safari iOS et a été retirée de Firefox (version 129). (https://caniuse.com/vibration)
- [haute] BarcodeDetector est disponible sur Chrome Android, mais pas sur Safari (désactivé par défaut) ni sur Firefox. Il faut un polyfill ZXing-WASM pour scanner sur iPhone. (https://caniuse.com/mdn-api_barcodedetector)
- [haute] Depuis Safari 17, une origine peut stocker jusqu'à 60 % du disque, avec le même quota en web app. navigator.storage.persist() est supporté et accordé selon des heuristiques, dont l'usage en web app d'écran d'accueil. (https://webkit.org/blog/14403/updates-to-storage-policy/)
- [moyenne] Sur iOS, une web app installée a un stockage (cookies, IndexedDB) séparé de Safari : l'utilisateur doit se reconnecter après l'installation. (https://developer.apple.com/videos/play/wwdc2023/10120/)
- [haute] Chrome a abandonné l'API Notification Triggers (notifications locales programmées). Une alerte de fin de repos fiable en arrière-plan doit donc passer par un Web Push envoyé par le serveur. (https://developer.chrome.com/docs/web-platform/notification-triggers)
- [moyenne] Les mainteneurs de vite-plugin-pwa annoncent son gel en maintenance au profit de @vite-pwa/core et d'un fork de Workbox. La v2.0.0 a été publiée le 03/10/2026. (https://github.com/vite-pwa/vite-plugin-pwa/issues/933)
- [haute] Le guide PWA officiel de Next.js (v16, mis à jour en juillet 2026) oriente vers Serwist pour le hors-ligne basé sur un service worker, avec support de Turbopack. (https://nextjs.org/docs/app/guides/progressive-web-apps)
- [moyenne] Orange partage l'IPv4 par CGNAT par défaut depuis janvier 2025. Le partage se désactive dans l'interface de la Livebox. (https://www.macg.co/ailleurs/2025/01/orange-partage-son-tour-par-defaut-les-ipv4-pour-les-abonnes-adsl-et-fibre-148513)
- [haute] Free attribue par défaut une IPv4 partagée avec une plage de ports. Une IPv4 fixe full-stack se demande dans l'espace abonné, et l'opération est irréversible. (https://www.universfreebox.com/article/596643/le-saviez-vous-free-permet-de-debloquer-une-possibilite-supplementaire-sur-votre-connexion-freebox-derriere-un-nom-plutot-intimidant)
- [moyenne] Chez Bouygues, une option « IP dédiée » se souscrit dans l'espace client. Chez SFR/RED, le retour en IPv4 complète passe par le support, et l'outil était signalé défaillant en 2023. (https://blog.jeanvw.fr/fr/posts/configurer-sa-bbox-pour-avoir-une-ip-publique-dediee/)
- [haute] Fin 2025, 94 % des clients fixes et 83 % des clients mobiles avaient l'IPv6 activé, mais Free Mobile n'était qu'à 50 % (baromètre Arcep 2026). (https://lafibre.info/ipv6/barometre-ipv6-2026/)
- [haute] Cloudflare Tunnel est disponible sur tous les plans, mais il exige un domaine géré par Cloudflare, et Cloudflare termine le TLS (deux connexions distinctes : visiteur → Cloudflare, Cloudflare → serveur). (https://developers.cloudflare.com/tunnel/get-started/)
- [haute] Sur le plan gratuit de Cloudflare, la taille maximale d'un envoi (upload) est de 100 Mo. (https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)
- [haute] Tailscale Funnel est en bêta : ports 443, 8443 et 10000 seulement, noms en *.ts.net uniquement, débit limité non configurable. Le TLS est terminé sur votre machine. (https://tailscale.com/kb/1223/funnel)
- [haute] Let's Encrypt passera à des certificats de 64 jours par défaut le 10/02/2027, puis de 45 jours le 16/02/2028. (https://letsencrypt.org/2025/12/02/from-90-to-45)
- [haute] Docker et UFW sont incompatibles : le trafic vers les ports publiés par Docker contourne les règles UFW. (https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [haute] Watchtower (containrrr) est archivé. Dependabot gère Docker Compose en disponibilité générale depuis février 2025. (https://github.blog/changelog/2025-02-25-dependabot-version-updates-now-support-docker-compose-in-general-availability/)
- [haute] Selon la CNIL, des données de poids croisées avec l'apport calorique ou le nombre de pas deviennent des données de santé. (https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)
- [haute] Dans Ollama, Ministral 3 8B pèse 6,0 Go, Ministral 3 14B 9,1 Go et Qwen3 8B 5,2 Go (versions quantifiées). Un 8B tient dans 16 Go aux côtés de la pile applicative. (https://ollama.com/library/ministral-3)
- [haute] GitHub recommande de ne quasiment jamais utiliser de runner auto-hébergé pour un dépôt public : n'importe qui peut ouvrir une pull request et compromettre la machine. (https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners)

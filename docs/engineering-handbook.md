# TripPlanner — Engineering Handbook

**Statut** : document de référence officiel — version 1.0
**Portée** : ce document s'applique à tout code produit dans le monorepo `tripplanner`, par toute personne (humaine ou IA) contribuant au projet.
**Règle générale** : en cas de conflit entre ce document et une préférence individuelle ou une habitude personnelle, ce document prévaut. Toute exception doit être documentée dans un ADR (voir section 7).

---

## 1. Principes d'architecture

### 1.1 Règles de découpage des modules

- Un module correspond à un **sous-domaine métier cohérent** (`Trips`, `Flights`, `Stays`, `Calendar`, `Expenses`, `Messaging`, `Users`, `Notifications`, `Auth`, `Admin`), jamais à une couche technique transversale.
- Un module ne dépasse jamais la responsabilité que son nom indique. Si un module commence à contenir de la logique qui appartient clairement à un autre domaine, c'est un signal qu'il doit être scindé ou que la logique doit être déplacée.
- Un nouveau module ne se crée que lorsqu'un sous-domaine a des règles métier propres et une raison d'évoluer indépendamment des autres. Ne jamais créer un module pour une seule fonction technique (ex : pas de module "Utils").

### 1.2 Dépendances autorisées et interdites

| Couche | Peut dépendre de | Ne peut jamais dépendre de |
|---|---|---|
| Domaine | Rien (aucune librairie externe, aucun framework) | Application, Infrastructure, NestJS, Prisma |
| Application | Domaine (du même module uniquement) | Infrastructure, autres modules directement |
| Infrastructure | Domaine, Application (du même module), librairies externes | Infrastructure d'un autre module |

- **Aucun module métier n'importe directement le repository, l'entité Prisma ou le service interne d'un autre module.** Toute donnée nécessaire venant d'un autre module transite par une interface de service publique explicitement exposée par ce module, ou par un événement de domaine.
- Les `packages/shared-types` et `packages/shared-validation` sont les seules dépendances partagées autorisées entre modules et entre apps (`api`, `web`, `mobile`).
- Aucune dépendance circulaire entre modules n'est tolérée. Si un cas semble nécessiter une dépendance circulaire, c'est un signal de mauvais découpage à corriger, pas à contourner.

### 1.3 Communication entre modules

Deux mécanismes autorisés, jamais d'accès direct aux données :

1. **Appel synchrone via interface de service publique** — utilisé quand le module appelant a besoin immédiatement d'un résultat pour répondre à une requête (ex : `Trips` a besoin de vérifier que l'utilisateur existe via `UsersService.findById`).
2. **Événement de domaine asynchrone** — utilisé quand une action déclenche une réaction dans un autre module qui n'est pas nécessaire à la réponse immédiate (ex : `ExpenseAdded` → `Messaging` poste un message système).

**Règle de décision** : si le module appelant a besoin du résultat pour construire sa réponse HTTP, c'est un appel synchrone. Sinon, c'est un événement.

### 1.4 Gestion des événements de domaine

- Nommage au passé : `TripCreated`, `MemberInvited`, `ExpenseAdded`, `PaymentCompleted`.
- Un événement contient uniquement les identifiants et données strictement nécessaires à ses consommateurs — jamais l'entité complète.
- Un événement est émis **uniquement** depuis la couche Application (un `UseCase`), jamais depuis un controller ou un repository.
- Un module qui écoute un événement d'un autre module ne doit jamais supposer l'ordre d'exécution par rapport à d'autres listeners du même événement. Chaque listener doit être idempotent.
- Les événements critiques pour l'intégrité des données (ex : facturation) doivent être persistés avant émission (outbox pattern) dès que le volume le justifie — noté comme évolution future, non requis au MVP.

### 1.5 Séparation stricte Domaine / Application / Infrastructure

- **Domaine** : entités, value objects, règles métier pures, interfaces de ports. Zéro import de NestJS, Prisma, Express, ou toute librairie externe. Testable sans aucune infrastructure.
- **Application** : use cases qui orchestrent le domaine, appellent les ports, émettent les événements. Ne contient aucune requête SQL, aucun détail HTTP.
- **Infrastructure** : controllers REST, repositories Prisma, adaptateurs vers services externes (Stripe, Duffel, S3, etc.), implémentations concrètes des ports définis par le Domaine.
- Un port est **toujours défini dans le Domaine et implémenté dans l'Infrastructure** — jamais l'inverse.

### 1.6 Dette technique

- Toute dette technique volontaire (raccourci pris pour tenir un délai) doit être marquée dans le code avec `// TODO(dette-technique): description + date + ticket associé`.
- Aucun `TODO` ne doit rester sans ticket de suivi associé.
- Une revue de dette technique a lieu à la fin de chaque module (avant validation), pas seulement en fin de projet.
- La dette technique ne doit jamais s'accumuler sur la couche Domaine — c'est la couche la plus coûteuse à corriger a posteriori.

---

## 2. Standards de développement

### 2.1 Conventions de nommage

- Classes, interfaces, types : `PascalCase` (`TripService`, `CreateTripDto`).
- Variables, fonctions, méthodes : `camelCase`.
- Fichiers : `kebab-case` avec suffixe explicite (`create-trip.use-case.ts`, `trip.repository.ts`, `trip.entity.ts`, `invite-member.dto.ts`).
- Constantes globales : `SCREAMING_SNAKE_CASE`.
- Booléens : préfixés `is`, `has`, `can`, `should` (`isActive`, `hasExpired`).
- Événements de domaine : verbe au passé (`TripCreated`), suffixe `Event` optionnel selon contexte NestJS.

### 2.2 Structure des dossiers (rappel, par module)

```
modules/<module>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   └── ports/
├── application/
│   ├── use-cases/
│   └── events/
├── infrastructure/
│   ├── controllers/
│   ├── repositories/
│   └── adapters/
├── <module>.module.ts
└── __tests__/
```

### 2.3 Principes SOLID appliqués

- **S** : un `UseCase` = une seule action métier (`InviteTripMemberUseCase`, jamais `TripUseCase` générique).
- **O** : les nouvelles fonctionnalités s'ajoutent par extension (nouveaux use cases, nouveaux adaptateurs), pas par modification de code existant validé.
- **L** : toute implémentation d'un port doit être substituable sans casser le comportement attendu par le Domaine.
- **I** : les ports sont fins et spécifiques (`TripRepositoryPort` séparé de `NotifierPort`), jamais une interface fourre-tout.
- **D** : la couche Application dépend d'abstractions (ports), jamais d'implémentations concrètes (Prisma, Stripe SDK directement).

### 2.4 DRY, KISS, YAGNI

- **DRY** s'applique à la logique métier, pas à la structure de code — deux use cases qui se ressemblent superficiellement mais représentent des règles métier différentes ne doivent pas être fusionnés artificiellement.
- **KISS** : la solution la plus simple qui satisfait les exigences actuelles est toujours préférée à une solution "flexible" anticipant des besoins non confirmés.
- **YAGNI** : aucune abstraction, configuration ou couche supplémentaire n'est ajoutée sans un besoin actuel identifié. Exception explicite : les points d'extension déjà validés en Phase 1 (recherche, observabilité, feature flags) sont l'exception documentée à cette règle, car leur coût d'ajout a posteriori est prohibitif.

### 2.5 Bonnes pratiques TypeScript et NestJS

- `strict: true` obligatoire dans `tsconfig.json`, aucun `any` toléré sans commentaire justificatif explicite.
- Toute donnée entrant dans l'API est typée par un DTO validé (`class-validator`), jamais un objet `any` ou `unknown` non vérifié.
- Utilisation systématique de l'injection de dépendances NestJS pour tout ce qui touche à l'infrastructure — jamais d'instanciation manuelle (`new PrismaClient()`) dans le code métier.
- Un controller ne contient **aucune logique métier** — il valide l'entrée, appelle un use case, formate la sortie.

### 2.6 Gestion des erreurs

- Le Domaine lève des erreurs métier typées (`TripNotFoundError`, `InsufficientPermissionError`), jamais des exceptions génériques.
- La couche Infrastructure (un `ExceptionFilter` global NestJS) traduit ces erreurs métier en codes HTTP appropriés (404, 403, 422...), jamais l'inverse.
- Aucune erreur technique brute (stack trace, message SQL) n'est jamais renvoyée au client. Le detail complet part dans les logs uniquement.
- Toute erreur inattendue est capturée, journalisée avec son `trace_id`, et renvoyée au client sous une forme générique et sûre.

### 2.7 Journalisation

- Logs structurés en JSON (via `pino`), jamais `console.log` en production.
- Chaque log contient au minimum : `timestamp`, `level`, `trace_id`, `module`, `message`.
- Niveaux utilisés strictement : `error` (nécessite investigation), `warn` (anormal mais géré), `info` (événements métier significatifs), `debug` (uniquement en développement).
- Aucune donnée sensible (mot de passe, token, numéro de carte) n'apparaît jamais dans un log, même en debug.

### 2.8 Validation des données

- Toute entrée API est validée par un DTO `class-validator` avant d'atteindre la couche Application — aucune exception.
- La validation métier complexe (ex : cohérence des dates d'un voyage) vit dans le Domaine, pas dans le DTO — le DTO valide la forme, le Domaine valide le sens.
- Les schémas de validation partagés (`shared-validation`, Zod) garantissent que frontend et backend valident selon les mêmes règles.

### 2.9 Sécurité OWASP (référence Top 10)

- Injections (SQL, NoSQL) : exclusivement via Prisma (requêtes paramétrées), jamais de SQL concaténé.
- Authentification cassée : sessions courtes, refresh tokens rotatifs, verrouillage après tentatives échouées répétées.
- Exposition de données sensibles : chiffrement en transit (TLS partout) et au repos pour les champs sensibles.
- Contrôle d'accès : vérifié systématiquement au niveau du use case (jamais seulement côté UI), RBAC appliqué par guard NestJS.
- Mauvaise configuration de sécurité : aucun secret en dur dans le code, revue de configuration avant chaque déploiement.
- Composants vulnérables : audit de dépendances automatisé en CI (`npm audit` / Snyk).
- Falsification de requêtes côté serveur (SSRF) : validation stricte de toute URL fournie par un utilisateur avant tout appel serveur.

### 2.10 Accessibilité

- Applicable au frontend web et mobile : contraste conforme WCAG AA minimum, navigation clavier complète sur web, labels explicites sur tous les champs de formulaire, tailles de cible tactile ≥ 44px sur mobile.
- Toute nouvelle interface passe une vérification d'accessibilité de base avant validation (axe-core en CI sur le web).

---

## 3. Qualité

### 3.1 Couverture minimale des tests

- Couche Domaine : couverture minimale **90%** — c'est la couche la moins coûteuse à tester et la plus critique à protéger.
- Couche Application : couverture minimale **80%**.
- Couche Infrastructure : couverture minimale **60%** (les tests d'intégration priment ici sur les tests unitaires exhaustifs).
- Un module n'est jamais validé si sa couverture globale est en dessous de ces seuils.

### 3.2 Définition de "Done" pour une fonctionnalité

Une fonctionnalité est terminée uniquement si, simultanément :
- le code respecte l'architecture hexagonale et les conventions de ce document ;
- les tests unitaires, d'intégration, et E2E pertinents sont écrits et passent ;
- la couverture minimale est atteinte ;
- la documentation (API OpenAPI, README du module) est à jour ;
- aucune vulnérabilité connue n'est introduite (audit de dépendances propre) ;
- la fonctionnalité a été revue par au moins une autre personne (ou une session de revue dédiée) ;
- elle a été testée manuellement dans un environnement proche de la production.

### 3.3 Checklist obligatoire avant toute Pull Request

- [ ] Les tests passent localement et en CI
- [ ] Aucun `any` non justifié, aucun `console.log` oublié
- [ ] Lint et format passent sans erreur
- [ ] La couverture minimale du module est respectée
- [ ] Aucun secret ou donnée sensible commitée
- [ ] La documentation du module est mise à jour si nécessaire
- [ ] Le message de commit suit la convention `Conventional Commits`
- [ ] La PR référence le ticket/issue correspondant

### 3.4 Checklist avant chaque mise en production

- [ ] Toutes les migrations de base de données sont testées sur un environnement de staging identique à la production
- [ ] Un plan de rollback existe et est documenté
- [ ] Les variables d'environnement de production sont vérifiées
- [ ] Les feature flags des nouvelles fonctionnalités sont en position désactivée par défaut si le déploiement est progressif
- [ ] Les métriques et logs sont vérifiés juste après déploiement (pas de pic d'erreurs)
- [ ] Le changelog est mis à jour

---

## 4. Performance

### 4.1 Requêtes SQL

- Interdiction du problème N+1 : toute relation chargée en boucle doit utiliser un `include`/`join` Prisma explicite, jamais une requête par itération.
- Toute requête sur une table volumineuse (`trips`, `bookings`, `messages`) doit être testée avec un `EXPLAIN ANALYZE` avant validation du module si elle est sur un chemin critique.

### 4.2 Index

- Un index est ajouté systématiquement sur toute colonne de clé étrangère.
- Un index composite est ajouté sur toute combinaison de colonnes utilisée ensemble dans un `WHERE` fréquent (ex : `trip_id + created_at` pour la pagination des messages).
- Aucun index n'est ajouté sans un cas d'usage identifié — un index inutile ralentit les écritures sans bénéfice.

### 4.3 Pagination

- Toute liste potentiellement longue est paginée dès le départ, jamais ajoutée après coup. Pagination par curseur (`cursor-based`) préférée à la pagination par offset pour les listes qui grandissent vite (messages, notifications) — l'offset se dégrade en performance sur de gros volumes.

### 4.4 Cache

- Redis est utilisé pour le cache de résultats coûteux à recalculer et peu volatils (ex : résultats de recherche de vols récents), jamais comme source de vérité.
- Toute donnée en cache a un TTL explicite — jamais de cache sans expiration.

### 4.5 Traitement asynchrone

- Toute opération qui n'est pas nécessaire à la réponse HTTP immédiate part en file BullMQ (voir Phase 1) : notifications, exports, synchronisations tierces.
- Les jobs longs (> quelques secondes) ne bloquent jamais le thread principal de l'API.

### 4.6 Optimisation des appels réseau

- Les appels vers des APIs externes (Duffel, Stripe) sont systématiquement encadrés par un timeout explicite et une politique de retry avec backoff exponentiel.
- Les appels externes redondants dans une même requête sont regroupés ou mis en cache le temps de la requête.

---

## 5. Sécurité

### 5.1 Authentification

- JWT à courte durée de vie (15 min) + refresh token rotatif à durée plus longue, stocké en cookie `httpOnly` côté web.
- Toute tentative de connexion échouée est journalisée ; un verrouillage temporaire s'active après un nombre défini de tentatives.

### 5.2 Autorisation

- RBAC appliqué systématiquement au niveau du use case, jamais uniquement côté controller ou côté frontend.
- Le principe du moindre privilège s'applique à chaque rôle défini.

### 5.3 Gestion des secrets

- Aucun secret en dur dans le code ou dans les fichiers commités, y compris dans les fichiers de configuration d'exemple.
- Secrets gérés via variables d'environnement injectées par la plateforme d'hébergement, jamais via un fichier `.env` commité.

### 5.4 Chiffrement

- TLS obligatoire sur tous les flux, sans exception, y compris en interne dès que l'architecture évolue vers plusieurs services.
- Chiffrement au repos pour les champs identifiés comme sensibles (documents de voyage, informations de paiement partielles).

### 5.5 Protection contre les attaques courantes

- Rate limiting sur tous les endpoints, renforcé sur les endpoints d'authentification.
- Protection CSRF sur les flux web basés sur cookies.
- En-têtes de sécurité HTTP standards (`Helmet` côté NestJS) activés par défaut.

### 5.6 Politique de gestion des permissions

- Les permissions sont définies au niveau du Domaine de chaque module (ex : seul un `owner` de `Trip` peut inviter des membres), jamais uniquement dans un guard générique déconnecté du métier.
- Toute élévation de privilège (ex : passage de `member` à `owner` d'un voyage) est journalisée dans les audit logs.

---

## 6. Documentation à maintenir en continu

| Document | Contenu | Mis à jour |
|---|---|---|
| `README.md` (racine) | Vue d'ensemble, installation, démarrage rapide | À chaque changement de setup |
| `README.md` (par module) | Rôle du module, use cases exposés, dépendances | À chaque évolution du module |
| OpenAPI/Swagger | Spécification complète de l'API | Automatiquement généré depuis les décorateurs NestJS, vérifié à chaque PR |
| Schéma ERD | Structure de la base de données | À chaque migration |
| Diagrammes C4 | Architecture globale | À chaque changement structurel majeur |
| `CHANGELOG.md` | Historique des versions | À chaque release |
| ADR (`/docs/adr/`) | Décisions techniques importantes | À chaque décision structurante |

---

## 7. Architecture Decision Records (ADR)

Chaque décision technique importante est documentée dans `/docs/adr/NNNN-titre-court.md` selon ce gabarit :

```markdown
# ADR NNNN — Titre court de la décision

## Statut
Proposé / Accepté / Remplacé par ADR-XXXX

## Contexte
Quel problème force cette décision ? Quelles contraintes s'appliquent ?

## Options étudiées
1. Option A — description, avantages, inconvénients
2. Option B — description, avantages, inconvénients
3. Option C — description, avantages, inconvénients

## Décision retenue
Quelle option a été choisie.

## Justification
Pourquoi cette option plutôt que les autres, dans le contexte actuel du projet.

## Conséquences
### Positives
- ...
### Négatives / compromis acceptés
- ...
```

**Exemples de décisions déjà prises qui méritent un ADR formel** : ADR-0001 (monolithe modulaire plutôt que microservices), ADR-0002 (PostgreSQL comme base principale), ADR-0003 (NestJS + architecture hexagonale), ADR-0004 (Turborepo pour le monorepo), ADR-0005 (BullMQ pour le traitement asynchrone).

Ces cinq ADR seront rédigés en premier, en tête de la Phase 2, pour que l'historique des décisions de la Phase 1 soit tracé avant que le projet ne grandisse.

---

*Ce document est vivant : toute modification de ses règles doit elle-même être justifiée par un ADR et validée avant application.*

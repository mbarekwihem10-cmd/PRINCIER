# TripPlanner — Conception de la base de données (Phase 2)

**Moteur** : PostgreSQL 16+
**ORM** : Prisma
**Convention de clés primaires** : UUID v7 (triable par temps, adapté à un système distribué, n'expose pas de compteur séquentiel deviné). Chaque table utilise `id uuid PRIMARY KEY DEFAULT uuid_generate_v7()`.
**Convention générale** : `snake_case` pour toutes les tables et colonnes (convention PostgreSQL standard, mappée en `camelCase` côté Prisma/TypeScript via `@map`).

---

## 1. Tables du MVP

### 1.1 Domaine Identité & Authentification

#### `users`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| email | citext | UNIQUE, NOT NULL |
| password_hash | text | NOT NULL |
| first_name | varchar(100) | NOT NULL |
| last_name | varchar(100) | NOT NULL |
| avatar_file_id | uuid | FK → files.id, NULL |
| phone | varchar(30) | NULL |
| locale | varchar(10) | NOT NULL, DEFAULT 'fr-FR' |
| timezone | varchar(50) | NOT NULL, DEFAULT 'Europe/Paris' |
| email_verified_at | timestamptz | NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**Justification `citext`** : évite les doublons de compte dus à la casse d'un email (`User@mail.com` vs `user@mail.com`) sans logique applicative supplémentaire.
**Index** : `UNIQUE (email) WHERE deleted_at IS NULL` — un email peut être réutilisé après suppression RGPD d'un compte, mais jamais en doublon parmi les comptes actifs.

#### `auth_identities`
Prépare le login social (Google, Apple) sans le développer au MVP.
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE |
| provider | varchar(30) | NOT NULL (`google`, `apple`, `password`) |
| provider_user_id | text | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Index** : `UNIQUE (provider, provider_user_id)` — empêche qu'un même compte externe soit lié à deux utilisateurs.

#### `refresh_tokens`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE |
| token_hash | text | NOT NULL, UNIQUE |
| expires_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Justification `token_hash`** : jamais le token en clair en base — seul son hash SHA-256, comme un mot de passe.
**Index** : `(user_id)` pour révocation en masse à la déconnexion globale ; `(expires_at)` pour le job de purge périodique.

#### `roles` / `user_roles`
Rôles **globaux** de plateforme (`admin`, `support`), distincts des rôles au sein d'un voyage (gérés dans `trip_members`).
```
roles(id uuid PK, name varchar(50) UNIQUE NOT NULL)
user_roles(user_id FK, role_id FK, PRIMARY KEY(user_id, role_id))
```

---

### 1.2 Domaine Voyages & Collaboration

#### `trips`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| name | varchar(200) | NOT NULL |
| description | text | NULL |
| cover_image_file_id | uuid | FK → files.id, NULL |
| destination | varchar(200) | NULL |
| start_date | date | NULL |
| end_date | date | NULL |
| base_currency | char(3) | NOT NULL, FK → currencies.code |
| status | varchar(20) | NOT NULL, DEFAULT 'planning' (`planning`, `confirmed`, `completed`, `archived`) |
| created_by | uuid | FK → users.id, NOT NULL, ON DELETE RESTRICT |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**Contrainte d'intégrité** : `CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)`.
**`created_by ON DELETE RESTRICT`** : un utilisateur créateur d'un voyage ne peut pas être supprimé tant que le voyage existe (protège l'intégrité de l'historique) — la suppression de compte passe par un processus applicatif qui transfère la propriété ou anonymise, jamais un DELETE brut cascadé sur les voyages.
**Index** : `(created_by)`, `(status)` pour les tableaux de bord.

#### `trip_members`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| trip_id | uuid | FK → trips.id, NOT NULL, ON DELETE CASCADE |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE |
| role | varchar(20) | NOT NULL, DEFAULT 'member' (`owner`, `editor`, `member`) |
| status | varchar(20) | NOT NULL, DEFAULT 'invited' (`invited`, `accepted`, `declined`, `removed`) |
| invited_by | uuid | FK → users.id, NULL, ON DELETE SET NULL |
| joined_at | timestamptz | NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

**`trip_id ON DELETE CASCADE`** : si un voyage est supprimé, ses membres n'ont plus de sens — suppression en cascade justifiée (contrairement à `trips.created_by` qui protège l'utilisateur).
**`invited_by ON DELETE SET NULL`** : si l'utilisateur qui a invité est supprimé, la trace du membre reste mais perd la référence à l'inviteur plutôt que de casser l'enregistrement.
**Index** : `UNIQUE (trip_id, user_id)` — un utilisateur ne peut être membre d'un voyage qu'une seule fois ; `(user_id)` pour la requête "mes voyages", extrêmement fréquente (page d'accueil).

#### `trip_invitations`
Invitations par email vers des personnes pas encore inscrites.
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| trip_id | uuid | FK → trips.id, NOT NULL, ON DELETE CASCADE |
| email | citext | NOT NULL |
| token | varchar(64) | NOT NULL, UNIQUE |
| invited_by | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE |
| status | varchar(20) | NOT NULL, DEFAULT 'pending' (`pending`, `accepted`, `expired`) |
| expires_at | timestamptz | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Index** : `(token)` unique pour la résolution du lien d'invitation ; `UNIQUE (trip_id, email) WHERE status = 'pending'` *(corrigé lors de la revue critique)* — empêche un doublon d'invitation **active**, tout en permettant de réinviter la même adresse après expiration ou déclin d'une invitation précédente.

#### `availabilities`
Calendrier collaboratif — disponibilités déclarées par chaque membre.
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| trip_id | uuid | FK → trips.id, NOT NULL, ON DELETE CASCADE |
| user_id | uuid | FK → users.id, NOT NULL, ON DELETE CASCADE |
| date | date | NOT NULL |
| status | varchar(20) | NOT NULL (`available`, `unavailable`, `maybe`) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

**Index** : `UNIQUE (trip_id, user_id, date)` — une seule déclaration par jour et par membre ; `(trip_id, date)` pour l'affichage agrégé du calendrier (requête la plus fréquente de ce module).

#### `calendar_events`
Événements du voyage hors réservations (ex : "dîner d'anniversaire", "visite libre").
```
calendar_events(id uuid PK, trip_id FK NOT NULL ON DELETE CASCADE, title varchar(200) NOT NULL,
  description text, start_at timestamptz NOT NULL, end_at timestamptz, location varchar(200),
  created_by FK users ON DELETE SET NULL, created_at, updated_at, deleted_at)
```
**Index** : `(trip_id, start_at)` pour l'affichage chronologique.

---

### 1.3 Domaine Réservations (Bookings)

#### `bookings` — table générique polymorphe
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| trip_id | uuid | FK → trips.id, NOT NULL, ON DELETE CASCADE |
| type | varchar(30) | NOT NULL (`flight`, `stay` — futurs : `restaurant`, `ride`, `activity`, `event`, `esim`, `delivery`) |
| provider | varchar(50) | NOT NULL (`duffel`, `amadeus`, `booking_affiliate`...) |
| provider_reference | varchar(200) | NOT NULL |
| status | varchar(20) | NOT NULL, DEFAULT 'pending' (`pending`, `confirmed`, `cancelled`, `failed`) |
| total_amount | numeric(12,2) | NOT NULL |
| currency | char(3) | NOT NULL, FK → currencies.code |
| booked_by | uuid | FK → users.id, NOT NULL, ON DELETE RESTRICT |
| version | integer | NOT NULL, DEFAULT 0 |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**Justification de la dénormalisation `total_amount`/`currency`** : ces valeurs existent déjà potentiellement dans les tables de détail (`flight_bookings`), mais sont dupliquées ici volontairement. Le tableau de bord d'un voyage (exigence MVP n°8) doit afficher toutes les réservations avec leur montant en une seule requête, sans jointure polymorphe coûteuse vers N tables de détail différentes. C'est un choix de performance assumé — la cohérence est garantie applicativement à l'écriture (transaction unique lors de la création d'une réservation).
**`booked_by ON DELETE RESTRICT`** : même logique que `trips.created_by`, protège l'historique financier.
**`version` — contrôle de concurrence optimiste** : les webhooks des fournisseurs (Duffel, Booking) peuvent notifier un changement de statut plusieurs fois, parfois en retry concurrent. Toute mise à jour de statut passe par `UPDATE bookings SET status = ?, version = version + 1 WHERE id = ? AND version = ?` côté Infrastructure — si `version` a changé entre-temps, l'update échoue explicitement (0 ligne affectée) et le `UseCase` réessaie avec l'état à jour plutôt que d'écraser silencieusement une mise à jour concurrente.
**Index** : `(trip_id, type)` pour le filtrage du tableau de bord ; `UNIQUE (provider, provider_reference) WHERE deleted_at IS NULL` — empêche la double-création d'une réservation suite à un retry réseau (idempotence), tout en permettant à un fournisseur de réutiliser une référence après annulation/soft-delete de l'ancienne réservation.

#### `flight_bookings`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| booking_id | uuid | FK → bookings.id, NOT NULL, UNIQUE, ON DELETE CASCADE |
| origin_airport | char(3) | NOT NULL |
| destination_airport | char(3) | NOT NULL |
| departure_at | timestamptz | NOT NULL |
| arrival_at | timestamptz | NOT NULL |
| airline | varchar(100) | NOT NULL |
| flight_number | varchar(10) | NOT NULL |
| cabin_class | varchar(20) | NOT NULL |
| raw_provider_payload | jsonb | NOT NULL |
| provider_payload_schema_version | varchar(20) | NOT NULL |

**Justification `provider_payload_schema_version`** : les fournisseurs externes (Duffel, Amadeus) font évoluer la forme de leurs réponses au fil du temps. Sans cette colonne, un payload ancien et un payload récent seraient indiscernables lors d'une lecture programmatique du JSON, avec un risque d'erreur silencieuse. Cette valeur est incrémentée à chaque changement de contrat connu avec le fournisseur et permet au code de lecture de choisir le bon chemin de désérialisation.
**Justification `raw_provider_payload jsonb`** : les APIs de vols retournent des structures riches et évolutives (escales, tarification détaillée, règles tarifaires) qu'il serait prématuré et rigide de modéliser entièrement en colonnes relationnelles au MVP. On stocke le payload complet du fournisseur pour ne rien perdre, et on extrait en colonnes relationnelles uniquement les champs interrogés/filtrés fréquemment (dates, aéroports). C'est une dénormalisation délibérée classique pour ce type de données tierces.
**Index** : `UNIQUE (booking_id)` (relation 1:1) ; index GIN sur `raw_provider_payload` uniquement si des requêtes dans le JSON s'avèrent nécessaires (non prévu au MVP — YAGNI).

#### `flight_passengers`
```
flight_passengers(id uuid PK, flight_booking_id FK NOT NULL ON DELETE CASCADE,
  trip_member_id FK trip_members NOT NULL ON DELETE CASCADE,
  first_name varchar(100) NOT NULL, last_name varchar(100) NOT NULL, seat varchar(10), created_at)
```
**`trip_member_id ON DELETE CASCADE`** *(corrigé lors de la revue critique — initialement RESTRICT)* : un `RESTRICT` ici entrait en conflit avec la chaîne `trips → bookings → flight_bookings → flight_passengers`, elle-même entièrement en CASCADE. Lors d'une suppression de voyage (purge RGPD par exemple), PostgreSQL tente de cascader toute la chaîne — la contrainte RESTRICT isolée sur ce seul maillon bloquait la transaction entière avec une erreur remontant loin de sa cause réelle. La protection contre le retrait accidentel d'un membre ayant un billet actif doit être appliquée au niveau du `UseCase` du Domaine (règle métier explicite), pas au niveau de la contrainte FK, qui doit rester cohérente avec le reste de la chaîne de suppression.

#### `stay_bookings`
```
stay_bookings(id uuid PK, booking_id FK UNIQUE NOT NULL ON DELETE CASCADE,
  property_name varchar(200) NOT NULL, address text, check_in_date date NOT NULL,
  check_out_date date NOT NULL, guests_count smallint NOT NULL, provider_property_id varchar(100),
  raw_provider_payload jsonb NOT NULL)
```
**Contrainte** : `CHECK (check_out_date > check_in_date)`.
**Index** : `(check_in_date, check_out_date)` pour les vues calendrier croisant hébergements et disponibilités.

---

### 1.4 Domaine Dépenses

#### `expenses`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| trip_id | uuid | FK → trips.id, NOT NULL, ON DELETE CASCADE |
| paid_by | uuid | FK → trip_members.id, NOT NULL, ON DELETE RESTRICT |
| description | varchar(200) | NOT NULL |
| amount | numeric(12,2) | NOT NULL, CHECK (amount > 0) |
| currency | char(3) | NOT NULL, FK → currencies.code |
| exchange_rate_to_base | numeric(12,6) | NOT NULL, DEFAULT 1 |
| amount_in_base_currency | numeric(12,2) | NOT NULL |
| category | varchar(30) | NOT NULL, DEFAULT 'other' |
| expense_date | date | NOT NULL |
| receipt_file_id | uuid | FK → files.id, NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**`exchange_rate_to_base` / `amount_in_base_currency`** *(ajouté lors de la revue critique)* : `expenses.currency` peut différer de `trips.base_currency` (voyage multi-pays, dépenses dans plusieurs devises). Sans ces colonnes, additionner les dépenses du tableau de bord nécessiterait soit un appel à une API de taux de change historique à chaque affichage (coûteux, fragile, non reproductible), soit des totaux simplement faux. Le taux est capturé **une seule fois, à la création de la dépense**, via un adaptateur de taux de change dans l'Infrastructure — jamais recalculé a posteriori, pour la même raison d'immuabilité financière que `expense_shares.share_amount`.
**`paid_by` référence `trip_members.id` et non `users.id`** : décision de modélisation clé. Une dépense appartient au contexte du voyage (le "membre"), pas directement à l'utilisateur global — ça simplifie l'affichage ("Julie a payé") même si le compte utilisateur est supprimé plus tard (le `trip_member` peut être conservé anonymisé).
**Index** : `(trip_id, expense_date)` pour la liste chronologique du tableau de bord.

#### `expense_shares`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| expense_id | uuid | FK → expenses.id, NOT NULL, ON DELETE CASCADE |
| trip_member_id | uuid | FK → trip_members.id, NOT NULL, ON DELETE RESTRICT |
| share_amount | numeric(12,2) | NOT NULL, CHECK (share_amount >= 0) |
| is_settled | boolean | NOT NULL, DEFAULT false |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

**Justification de dénormalisation `share_amount`** : le montant de la part est **figé** au moment de sa création plutôt que recalculé dynamiquement depuis une règle de répartition. Si demain la règle de calcul change (ex : passage d'un partage égal à un partage pondéré), les parts déjà existantes ne doivent jamais être recalculées rétroactivement — c'est une exigence d'auditabilité financière, pas une négligence de normalisation.
**Index** : `UNIQUE (expense_id, trip_member_id)` — une part par membre et par dépense ; `(trip_member_id, is_settled)` pour le calcul rapide du solde de chacun.

#### `settlements`
Remboursements enregistrés entre membres pour équilibrer les comptes.
```
settlements(id uuid PK, trip_id FK NOT NULL ON DELETE CASCADE,
  from_member_id FK trip_members NOT NULL ON DELETE RESTRICT,
  to_member_id FK trip_members NOT NULL ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0), currency char(3) NOT NULL,
  settled_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())
```

#### `trip_balances` *(ajoutée lors de la revue critique)*
Solde matérialisé par membre, maintenu de façon incrémentale plutôt que recalculé à la volée à chaque affichage du tableau de bord.
```
trip_balances(id uuid PK, trip_id FK NOT NULL ON DELETE CASCADE,
  trip_member_id FK trip_members NOT NULL ON DELETE CASCADE,
  balance_amount numeric(12,2) NOT NULL DEFAULT 0, currency char(3) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, trip_member_id))
```
**Justification** : sans cette table, afficher "qui doit combien à qui" nécessite une agrégation `SUM(expense_shares.share_amount)` recalculée à chaque ouverture du tableau de bord — acceptable à faible volume, mais un calcul répété inutilement dès qu'un voyage accumule beaucoup de dépenses. `trip_balances` est mise à jour par le module `Expenses` en écoutant ses propres événements de domaine (`ExpenseAdded`, `ExpenseShareSettled`, `SettlementRecorded`) : chaque événement applique un delta sur `balance_amount` plutôt que de tout resommer. Le solde devient une lecture directe (O(1)) au lieu d'une agrégation sur potentiellement des centaines de lignes.
**Garde-fou de cohérence** : cette table est une projection dérivée, jamais une source de vérité — `expense_shares` reste l'unique source de vérité. Le job de réconciliation périodique (voir section 8) recalcule `trip_balances` depuis `expense_shares` et alerte en cas de divergence, pour détecter tout bug d'incrémentation.

---

### 1.5 Domaine Messagerie

#### `conversations`
```
conversations(id uuid PK, trip_id uuid UNIQUE FK NOT NULL ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now())
```
**Justification `UNIQUE (trip_id)`** : au MVP, une seule conversation par voyage (choix produit délibéré pour la simplicité — pas de sous-canaux). La contrainte unique documente et impose cette règle au niveau base de données, pas seulement applicatif.

#### `messages`
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| conversation_id | uuid | FK → conversations.id, NOT NULL, ON DELETE CASCADE |
| sender_id | uuid | FK → users.id, NULL, ON DELETE SET NULL |
| content | text | NOT NULL |
| message_type | varchar(20) | NOT NULL, DEFAULT 'text' (`text`, `system`) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**`sender_id ON DELETE SET NULL`** : un message système (ex : "Julie a ajouté une dépense") n'a pas d'expéditeur humain ; un message d'un utilisateur supprimé reste visible dans l'historique de conversation (comportement standard des apps de messagerie) mais perd son lien d'auteur.
**Index** : `(conversation_id, created_at)` — critique pour la pagination par curseur (voir section Performance de la charte). C'est la table qui grandira le plus vite en volume, donc l'index le plus surveillé.

**Décision explicite — dénormalisation `trip_id` écartée pour l'instant** : la revue critique a identifié que `messages → conversations → trips` impose une jointure supplémentaire sur le chemin le plus chaud de l'application. La dénormalisation de `trip_id` directement sur `messages` a été évaluée mais **volontairement écartée à ce stade**, conformément au principe retenu : *ne jamais dénormaliser par anticipation, seulement après qu'une mesure réelle (test de charge, profiling en production) démontre un goulot d'étranglement effectif*. Cette relation reste donc normalisée en l'état. À surveiller explicitement lors des tests de charge de la Phase 4 sur le module `Messaging` — si la jointure apparaît comme un point chaud mesuré, l'introduction de `trip_id` sur `messages` se fera alors comme une migration additive contrôlée (colonne nullable, backfill, bascule), jamais en modifiant rétroactivement une hypothèse non vérifiée.

#### `message_reads`
```
message_reads(message_id FK NOT NULL ON DELETE CASCADE, user_id FK NOT NULL ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (message_id, user_id))
```

---

### 1.6 Domaine Fichiers

#### `files`
Stockage objet (S3-compatible) référencé de façon polymorphe.
| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| owner_type | varchar(30) | NOT NULL (`user_avatar`, `trip_cover`, `expense_receipt`, `trip_document`) |
| owner_id | uuid | NOT NULL (référence logique, pas de FK — polymorphe) |
| uploader_id | uuid | FK → users.id, NOT NULL, ON DELETE RESTRICT |
| storage_key | text | NOT NULL, UNIQUE |
| mime_type | varchar(100) | NOT NULL |
| size_bytes | bigint | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| deleted_at | timestamptz | NULL |

**Justification de l'absence de FK sur `owner_id`** : `files` est référencée par plusieurs tables de types différents (users, trips, expenses...). Une vraie FK polymorphe n'existe pas nativement en PostgreSQL ; la cohérence est garantie par l'application (chaque écriture passe par le `StorageModule` défini en Phase 1) plutôt que par la contrainte SQL. Alternative rejetée : une table de jointure par type de propriétaire — inutilement complexe pour un besoin aussi simple au MVP.
**Index** : `(owner_type, owner_id)` pour retrouver les fichiers d'une entité.

---

### 1.7 Domaine Notifications

```
notifications(id uuid PK, user_id FK NOT NULL ON DELETE CASCADE, type varchar(50) NOT NULL,
  payload jsonb NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())

notification_preferences(id uuid PK, user_id FK NOT NULL ON DELETE CASCADE,
  notification_type varchar(50) NOT NULL, channel varchar(20) NOT NULL, enabled boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, notification_type, channel))
```
**Index sur `notifications`** : `(user_id, read_at)` — la requête "notifications non lues de l'utilisateur" est appelée à chaque ouverture d'app, doit rester rapide même avec un historique important. `(user_id, created_at DESC)` *(ajouté lors de la revue critique)* — nécessaire pour la liste chronologique paginée, distincte du filtre sur les non-lues ; sans cet index, le tri se ferait en mémoire au-delà d'un certain volume.

---

### 1.8 Tables transverses / plateforme

```
currencies(code char(3) PK, symbol varchar(5) NOT NULL, decimal_places smallint NOT NULL DEFAULT 2)

audit_logs(id uuid PK, actor_id uuid FK users ON DELETE SET NULL, action varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL, entity_id uuid NOT NULL, metadata jsonb,
  ip_address inet, created_at timestamptz NOT NULL DEFAULT now())

idempotency_keys(id uuid PK, key varchar(200) UNIQUE NOT NULL, response_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now())

feature_flags(id uuid PK, key varchar(100) UNIQUE NOT NULL, description text,
  enabled boolean NOT NULL DEFAULT false, rollout_percentage smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())
```

**`audit_logs.actor_id ON DELETE SET NULL`** : l'action journalisée doit rester tracée même si l'auteur est supprimé — l'anonymisation du RGPD ne doit pas effacer la preuve qu'une action a eu lieu.
**`audit_logs` n'a volontairement aucune colonne `updated_at`/`deleted_at`** : un log d'audit est immuable par nature — ni modifié, ni supprimé (sauf purge de rétention automatisée hors du contrôle applicatif classique).
**`feature_flags`** : table de cache/override local ; en Phase 1 Unleash a été retenu comme source de vérité, cette table sert de repli local si Unleash est indisponible (dégradation gracieuse).

---

## 2. Colonnes d'audit — règle appliquée

| Colonne | Présente sur | Absente sur | Justification de l'absence |
|---|---|---|---|
| `created_at` | Toutes les tables sans exception | — | — |
| `updated_at` | Toute table dont les lignes sont mutables après création | `audit_logs`, `message_reads`, `expense_shares` (share figée), tables de jointure pures | Une ligne immuable n'a pas besoin de traçer une modification qui ne doit jamais arriver |
| `deleted_at` | Entités métier principales (`users`, `trips`, `expenses`, `messages`, `bookings`, `calendar_events`) | Tables de jointure, logs, tables de détail 1:1 dépendantes | Le soft delete a du sens sur une entité qu'on veut pouvoir restaurer ou dont on doit garder la trace visible désactivée ; une table de détail suit le cycle de vie de son parent via CASCADE |

**Règle générale de suppression** : soft delete (`deleted_at`) par défaut sur toute entité visible par l'utilisateur ou nécessaire à l'historique légal/financier. Hard delete (via CASCADE) réservé aux données strictement dépendantes qui n'ont aucun sens sans leur parent (ex : `expense_shares` sans `expenses`).

---

## 3. Stratégies de suppression — tableau récapitulatif

| Relation | Stratégie | Justification |
|---|---|---|
| `trip_members.trip_id → trips` | CASCADE | Un membre n'existe pas sans son voyage |
| `trips.created_by → users` | RESTRICT | Protège l'intégrité de l'historique des voyages |
| `bookings.trip_id → trips` | CASCADE | Une réservation n'a pas de sens hors de son voyage |
| `bookings.booked_by → users` | RESTRICT | Protège l'historique financier |
| `flight_bookings.booking_id → bookings` | CASCADE | Relation 1:1 de détail, dépendance totale |
| `flight_passengers.trip_member_id → trip_members` | CASCADE *(corrigé)* | Cohérence avec la chaîne trips→bookings→flight_bookings, tout en CASCADE ; la protection contre un retrait accidentel est portée par le Domaine, pas par la FK |
| `expenses.paid_by → trip_members` | RESTRICT | Protège l'historique financier |
| `trip_balances.trip_member_id → trip_members` | CASCADE | Projection dérivée, n'a pas de sens sans son membre |
| `expense_shares.expense_id → expenses` | CASCADE | Une part n'existe pas sans sa dépense |
| `messages.sender_id → users` | SET NULL | L'historique de conversation doit survivre à la suppression d'un compte |
| `messages.conversation_id → conversations` | CASCADE | Un message n'a pas de sens hors de sa conversation |
| `audit_logs.actor_id → users` | SET NULL | Preuve d'audit conservée indépendamment de l'existence du compte |
| `files.uploader_id → users` | RESTRICT | Traçabilité de qui a uploadé un fichier encore référencé |

---

## 4. Normalisation et dénormalisation — synthèse des choix

Le schéma est en **3NF par défaut**, avec cinq dénormalisations délibérées, chacune documentée à sa table :

1. **`bookings.total_amount`/`currency`** dupliqués depuis les tables de détail → performance du tableau de bord (évite une jointure polymorphe sur toutes les requêtes de listing).
2. **`flight_bookings.raw_provider_payload`** en JSONB → flexibilité face à un format de données tiers riche et évolutif, sans sur-modéliser prématurément.
3. **`expense_shares.share_amount`** figé plutôt que calculé → exigence d'immuabilité financière/auditabilité, pas de recalcul rétroactif possible.
4. **`expenses.amount_in_base_currency`** figé au taux de change du jour → exactitude des totaux du tableau de bord sans dépendance à un appel de taux de change historique à chaque affichage.
5. **`trip_balances`** comme projection matérialisée dérivée de `expense_shares` → lecture O(1) du solde par membre au lieu d'une agrégation répétée, avec réconciliation périodique comme garde-fou (voir section 8).

Ces cinq cas suivent la même règle : **on dénormalise uniquement quand la normalisation stricte casserait soit la performance d'une requête critique, soit une exigence métier d'immuabilité — jamais par confort de développement.**

**Cas volontairement laissé normalisé malgré un point de friction identifié** : la relation `messages → conversations → trips` (voir section `messages`) n'a **pas** été dénormalisée malgré la jointure supplémentaire qu'elle impose, faute de mesure démontrant qu'elle constitue un goulot d'étranglement réel. C'est l'application stricte du principe *mesurer avant d'optimiser* — à réévaluer avec des données de profiling en Phase 4.

---

## 5. Anticipation des modules futurs

Grâce au pattern polymorphe `bookings` + table de détail, chaque futur vertical s'ajoute par **une seule migration additive**, sans toucher au schéma existant :

| Futur module | Nouvelle table de détail | Rien à modifier sur |
|---|---|---|
| Restaurants | `restaurant_bookings(booking_id FK UNIQUE, ...)` | `bookings`, `trips`, `expenses`, dashboard |
| VTC | `ride_bookings(booking_id FK UNIQUE, pickup_location, dropoff_location, ...)` | idem |
| Activités | `activity_bookings(booking_id FK UNIQUE, ...)` | idem |
| Événements | `event_bookings(booking_id FK UNIQUE, ...)` | idem |
| eSIM | `esim_orders(booking_id FK UNIQUE, ...)` | idem |
| Livraison de repas | `delivery_orders(booking_id FK UNIQUE, ...)` | idem |

**Ces tables ne sont volontairement pas créées au MVP** (principe YAGNI de la charte d'ingénierie) — seul le pattern d'extension est garanti sans refonte. Les créer à vide aujourd'hui ajouterait de la complexité de migration sans bénéfice actuel.

---

## 6. Stratégie de migration

- **Outil** : Prisma Migrate, migrations versionnées et commitées dans `apps/api/prisma/migrations/`.
- **Principe expand/contract pour les changements destructifs** :
  1. Migration additive (nouvelle colonne nullable, nouvelle table) déployée en premier.
  2. Code applicatif déployé pour écrire dans la nouvelle structure tout en lisant l'ancienne si besoin.
  3. Migration de bascule complète des données existantes (script de backfill, exécuté hors heures de pointe).
  4. Suppression de l'ancienne colonne/table dans une migration séparée, seulement après confirmation que plus aucun code ne la lit.
- **Jamais de migration destructive et de déploiement de code dans le même déploiement** — toute suppression de colonne est un déploiement à part, après une période d'observation.
- **Index sur grosses tables** : création via `CREATE INDEX CONCURRENTLY` pour ne jamais verrouiller une table en écriture pendant la création d'un index (crucial dès que `messages` ou `bookings` dépassent quelques centaines de milliers de lignes).
- **Test systématique** : chaque migration est d'abord appliquée sur un environnement de staging avec un jeu de données représentatif avant la production.
- **Réversibilité** : chaque migration a un chemin de rollback documenté (Prisma génère les migrations descendantes, vérifiées manuellement pour les cas non triviaux).

---

## 7. Conception pour plusieurs millions d'utilisateurs et de réservations

- **UUID v7** plutôt que `bigserial` : reste performant en écriture distribuée (contrairement à UUID v4, il conserve un tri temporel proche d'un auto-increment, donc les index B-tree ne se fragmentent pas autant) et ne fuite aucune information business (nombre d'utilisateurs inscrits, volume de réservations).
- **Partitionnement préparé, pas activé au MVP** : les tables à forte croissance (`messages`, `audit_logs`, `notifications`) incluent déjà `created_at` en tête de leurs index principaux — c'est la colonne naturelle de partitionnement par intervalle (`RANGE`) le jour où le volume le justifie (généralement au-delà de plusieurs dizaines de millions de lignes). Activer le partitionnement à ce moment-là ne nécessite pas de changement de schéma logique, seulement une réorganisation physique.
- **Pagination par curseur systématique** (voir charte d'ingénierie section 4.3) sur toutes les listes à forte volumétrie — jamais d'`OFFSET` sur `messages` ou `notifications`.
- **Lecture/écriture séparables** : le schéma ne contient aucune dépendance qui empêcherait d'introduire des répliques de lecture PostgreSQL plus tard (aucune fonction ou trigger dépendant d'un état de session).
- **Connection pooling** : PgBouncer prévu dès la Phase 3 (mise en place du projet), même en environnement de développement, pour éviter les changements de comportement entre dev et prod.
- **Champs monétaires** : `numeric(12,2)` partout plutôt que `float`, pour une exactitude garantie sur les calculs financiers — non négociable pour un module de partage de dépenses.

---

## 8. Garde-fous de cohérence des données

PostgreSQL ne peut pas exprimer nativement une contrainte d'intégrité inter-lignes (un `CHECK` ne voit qu'une ligne à la fois). Deux invariants métier critiques ne sont donc garantis qu'applicativement, avec un filet de sécurité :

- **`SUM(expense_shares.share_amount) = expenses.amount`** : garanti par le `UseCase` du Domaine `Expenses` (transaction unique création dépense + parts), jamais recalculable en dehors.
- **`trip_balances.balance_amount` cohérent avec `expense_shares`** : `trip_balances` est une projection, jamais une source de vérité.

Un job de réconciliation périodique (file BullMQ, hors heures de pointe) recalcule ces deux invariants depuis les tables sources et déclenche une alerte (pas une correction automatique silencieuse) en cas de divergence — un filet de sécurité qui détecte les bugs, pas un substitut à la garantie transactionnelle applicative.

---

## 9. Synthèse des corrections intégrées lors de la revue critique

| Sévérité | Correction | Statut |
|---|---|---|
| Élevée | `flight_passengers.trip_member_id` : RESTRICT → CASCADE | Intégré |
| Élevée | Index partiels `WHERE deleted_at IS NULL` / `WHERE status = 'pending'` sur les contraintes uniques concernées | Intégré |
| Élevée | `bookings.version` pour contrôle de concurrence optimiste | Intégré |
| Moyenne | Table `trip_balances` matérialisée | Intégré |
| Moyenne | Dénormalisation `trip_id` sur `messages` | **Écarté délibérément** — à réévaluer uniquement sur mesure de performance réelle |
| Moyenne | `exchange_rate_to_base` / `amount_in_base_currency` sur `expenses` | Intégré |
| Faible | `provider_payload_schema_version` sur les tables de détail JSONB | Intégré |
| Faible | Index `(user_id, created_at)` sur `notifications` | Intégré |
| Différé | Politique de rétention `notifications`/`audit_logs`, table `booking_types` | Non traité au MVP, à documenter en ADR quand le besoin se confirme |

---

*Ce document sera complété par les migrations Prisma effectives lors de la Phase 3 (mise en place du projet), puis chaque table sera implémentée avec son module correspondant en Phase 4.*

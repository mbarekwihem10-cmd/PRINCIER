# ADR 0002 — PostgreSQL comme base de données principale

## Statut
Accepté

## Contexte
TripPlanner a besoin d'un stockage transactionnel fiable pour des données fortement relationnelles (voyages, membres, réservations, dépenses partagées) avec des exigences fortes d'intégrité financière (partage de dépenses, soldes entre membres) et de cohérence (pas de double-réservation, pas de double-facturation).

## Options étudiées
1. **MongoDB (document)** — flexibilité de schéma appréciable pour les payloads fournisseurs (vols, hébergements), mais absence de transactions multi-documents aussi robustes et naturelles que SQL pour les invariants financiers (`expense_shares`, `trip_balances`), et relations fortement structurées (voyages/membres/réservations) qui s'expriment mal en document.
2. **MySQL** — viable également, mais moins riche nativement sur les types utilisés ici (`citext`, `jsonb` avec indexation GIN, `uuid` natif) sans extensions tierces.
3. **PostgreSQL** — transactions ACID complètes, types riches natifs (`citext`, `jsonb`, `uuid`), extensible (UUID v7 via fonction dédiée), écosystème Prisma mature, réplicas de lecture et partitionnement disponibles pour la montée en charge future.

## Décision retenue
PostgreSQL 16+, accédé exclusivement via Prisma comme ORM/query builder, avec `jsonb` pour les payloads bruts des fournisseurs tiers (vols, hébergements) là où la structure est riche et évolutive.

## Justification
Les exigences d'intégrité financière (parts de dépenses, soldes, idempotence des réservations) demandent des garanties transactionnelles fortes que PostgreSQL fournit nativement. Le support natif de `jsonb` permet de conserver la flexibilité d'un stockage document pour les données tierces volatiles, sans sacrifier la rigueur relationnelle sur le cœur métier (voir `docs/database-design.md` section 4 pour le détail des dénormalisations).

## Conséquences
### Positives
- Garanties ACID sur les invariants financiers critiques.
- Un seul moteur de données à opérer et sauvegarder pour tout le MVP.
- Chemin de montée en charge documenté (UUID v7, partitionnement par `created_at`, réplicas de lecture) sans changement de schéma logique.

### Négatives / compromis acceptés
- Moins de flexibilité de schéma que MongoDB pour les données non structurées — compensé par l'usage ciblé de `jsonb` uniquement là où c'est justifié (payloads fournisseurs), pas comme solution par défaut.

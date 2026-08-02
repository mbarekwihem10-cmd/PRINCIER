# ADR 0003 — NestJS avec architecture hexagonale

## Statut
Accepté

## Contexte
Le backend doit accueillir de nombreux sous-domaines métier (`Trips`, `Flights`, `Stays`, `Expenses`, `Messaging`...) tout en restant testable, maintenable, et capable d'intégrer des fournisseurs tiers (Duffel, Amadeus, S3, Stripe) sans que cette complexité d'infrastructure contamine la logique métier.

## Options étudiées
1. **Express minimaliste** — flexibilité totale, mais aucune structure imposée : le respect de l'architecture hexagonale reposerait uniquement sur la discipline individuelle, sans garde-fou du framework (pas d'injection de dépendances native, pas de modules).
2. **NestJS sans architecture hexagonale (MVC classique)** — vélocité initiale plus rapide, mais logique métier et détails d'infrastructure (Prisma, HTTP) rapidement mélangés dans les mêmes classes, coûteux à découpler a posteriori.
3. **NestJS + architecture hexagonale stricte par module** — structure imposée (modules NestJS, injection de dépendances), avec séparation Domaine (aucune dépendance externe) / Application (use cases) / Infrastructure (controllers, repositories, adapters) à l'intérieur de chaque module.

## Décision retenue
NestJS comme framework, avec architecture hexagonale strictement appliquée à l'intérieur de chaque module (voir Handbook section 1.5 et 2.2 pour la structure de dossiers imposée).

## Justification
NestJS fournit nativement l'injection de dépendances et la modularité nécessaires pour faire respecter les frontières Domaine/Application/Infrastructure sans discipline purement conventionnelle. La couche Domaine reste testable sans aucune infrastructure (couverture minimale 90%, voir Handbook section 3.1), ce qui protège la partie la plus coûteuse à corriger a posteriori — la logique métier.

## Conséquences
### Positives
- Logique métier testable unitairement sans base de données ni framework.
- Remplacement d'un fournisseur tiers (ex. changer de provider de vols) limité à la couche Infrastructure, sans toucher au Domaine.
- Cohérence imposée par la structure de dossiers, réduisant la variance entre modules développés par des personnes différentes.

### Négatives / compromis acceptés
- Plus de code de câblage (ports, interfaces, mapping) qu'une approche MVC directe — accepté comme coût nécessaire vu le nombre de modules prévus et la durée de vie attendue du projet.

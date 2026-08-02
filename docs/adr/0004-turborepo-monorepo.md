# ADR 0004 — Turborepo pour le monorepo

## Statut
Accepté

## Contexte
TripPlanner regroupe 3 apps (`api`, `web`, `mobile`) et plusieurs packages partagés (`shared-types`, `shared-validation`, `ui`, `tsconfig`, `eslint-config`) qui doivent partager du code typé sans dupliquer les définitions ni casser la synchronisation entre backend et frontends.

## Options étudiées
1. **Dépôts séparés par app** — isolation complète des cycles de release, mais partage de types/validation entre `api`/`web`/`mobile` nécessiterait un package publié séparément (npm privé ou submodule), avec latence de synchronisation à chaque changement de contrat d'API.
2. **Monorepo avec pnpm workspaces seul (sans orchestrateur de tâches)** — partage de code immédiat via workspaces, mais aucune mise en cache ni parallélisation des tâches (`build`, `lint`, `test`) : chaque commande rebuild tout le monorepo à chaque fois.
3. **Monorepo pnpm workspaces + Turborepo** — partage de code immédiat, cache de build local, et exécution parallèle des tâches avec résolution automatique de l'ordre des dépendances (`dependsOn: ["^build"]`).

## Décision retenue
pnpm workspaces (gestion des dépendances et du linking) + Turborepo (orchestration des tâches `build`/`dev`/`lint`/`typecheck`/`test`), configuré dans `turbo.json` et `pnpm-workspace.yaml`.

## Justification
Le partage de `shared-types` et `shared-validation` entre l'API NestJS et les frontends Next.js/Expo est un besoin day-one, pas une évolution future — un monorepo est donc la structure la plus directe. Turborepo ajoute la mise en cache et la parallélisation sans complexité de configuration significative par rapport à pnpm workspaces seul, ce qui devient rapidement nécessaire dès que le nombre d'apps et de packages augmente.

## Conséquences
### Positives
- Un changement dans `shared-types` est immédiatement visible par toutes les apps, sans étape de publication intermédiaire.
- Cache de build/test partagé, accélérant la CI à mesure que le monorepo grandit.
- Une seule PR peut modifier un type partagé et ses usages dans plusieurs apps de façon atomique.

### Négatives / compromis acceptés
- Toutes les apps évoluent sur la même version de Node/TypeScript de base — accepté vu que les 3 apps ciblent la même stack TypeScript.
- Historique git unique pour toutes les apps — accepté, cohérent avec l'équipe actuelle unique sur le projet.

# TripPlanner

Organisation collaborative de voyages — vols, hébergements, calendrier partagé, dépenses partagées et messagerie, réunis dans une seule application.

> Ce dépôt est un monorepo géré avec pnpm workspaces + Turborepo.
> Architecture, conventions et décisions techniques : voir `docs/engineering-handbook.md` et `docs/adr/`.

## Structure

```
apps/
  api/      Backend NestJS (monolithe modulaire, architecture hexagonale)
  web/      Frontend Next.js
  mobile/   Frontend React Native (Expo)
packages/
  shared-types/       Types TypeScript partagés entre apps
  shared-validation/  Schémas de validation partagés (Zod)
  ui/                 Design system partagé (web)
  tsconfig/           Configuration TypeScript partagée
  eslint-config/       Configuration ESLint partagée
infra/
  docker/             Dockerfiles par app
docs/
  engineering-handbook.md
  adr/
```

## Prérequis

- Node.js 20.11+ (voir `.nvmrc`)
- pnpm 9+
- Docker (pour l'environnement de développement local)

## Installation

> Instructions complètes détaillées en fin de Phase 3 (sous-étape 7), une fois toutes les apps bootstrapées.

```bash
pnpm install
```

## Statut du projet

Mise en place du projet en cours (Phase 3 de la méthodologie de développement). Aucune fonctionnalité métier n'est encore implémentée à ce stade.

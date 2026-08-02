# ADR 0001 — Monolithe modulaire plutôt que microservices

## Statut
Accepté

## Contexte
TripPlanner démarre sans historique de trafic, sans équipe multipliée par service, et avec un besoin de vélocité élevé sur le MVP (vols, hébergements, calendrier, dépenses, messagerie). Une décomposition en microservices doit être justifiée par un besoin réel d'isolation (scalabilité indépendante, équipes séparées, cycles de déploiement découplés) — aucun de ces besoins n'est confirmé à ce stade.

## Options étudiées
1. **Microservices dès le départ** — isolation forte, scalabilité indépendante par service, mais coût opérationnel élevé (orchestration, observabilité distribuée, transactions inter-services) sans bénéfice mesurable à ce volume.
2. **Monolithe non structuré** — vélocité initiale maximale, mais dégradation rapide de la maintenabilité à mesure que les domaines métier s'accumulent, couplage implicite difficile à défaire ensuite.
3. **Monolithe modulaire** — un seul déployable, mais découpage strict en modules par sous-domaine métier (`Trips`, `Expenses`, `Messaging`...) avec des frontières de dépendance imposées (voir Handbook section 1), permettant une extraction future en services si le besoin se confirme.

## Décision retenue
Monolithe modulaire (option 3), avec architecture hexagonale par module (Domaine / Application / Infrastructure) et communication inter-modules exclusivement via interface de service publique ou événement de domaine — jamais d'accès direct aux données d'un autre module.

## Justification
Cette approche donne la vélocité d'un monolithe (un seul déploiement, pas de complexité réseau) tout en préservant les frontières métier qui rendraient une extraction en microservices possible plus tard, si un module démontre un besoin réel de scalabilité ou de cycle de vie indépendant. Le coût d'une mauvaise décomposition en microservices prématurée est bien plus élevé que celui de renforcer la discipline modulaire d'un monolithe.

## Conséquences
### Positives
- Déploiement, observabilité et transactions simples (une seule base de données, pas de saga distribuée).
- Coût d'infrastructure et opérationnel réduit pour l'équipe actuelle.
- Extraction future en service indépendant facilitée si les frontières de module sont respectées.

### Négatives / compromis acceptés
- Discipline requise pour ne pas laisser les modules devenir couplés implicitement (revue de dette technique en fin de module, voir Handbook section 1.6).
- Montée en charge : toutes les parties de l'application partagent les mêmes ressources de calcul tant que le monolithe n'est pas scindé.

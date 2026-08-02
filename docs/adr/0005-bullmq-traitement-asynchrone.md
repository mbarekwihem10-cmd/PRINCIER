# ADR 0005 — BullMQ pour le traitement asynchrone

## Statut
Accepté

## Contexte
Plusieurs opérations de TripPlanner ne doivent jamais bloquer la réponse HTTP immédiate : envoi de notifications, exports, synchronisation avec des fournisseurs tiers (statut de réservation via webhook Duffel/Booking), job de réconciliation périodique des soldes (`trip_balances`, voir `docs/database-design.md` section 8).

## Options étudiées
1. **Traitement synchrone dans la requête HTTP** — le plus simple à implémenter, mais dégrade directement le temps de réponse perçu et introduit un risque de timeout sur des appels tiers lents (ex. confirmation de réservation).
2. **Solution cloud managée (ex. SQS + Lambda)** — délègue l'infrastructure de queue, mais introduit une dépendance à un fournisseur cloud spécifique dès le MVP et complexifie l'environnement de développement local, alors qu'aucun besoin de scalabilité au-delà d'un serveur unique n'est confirmé.
3. **BullMQ (Redis)** — file de jobs en Node.js natif, retries avec backoff exponentiel configurables, cohérent avec le choix de Redis déjà retenu pour le cache (section 4.4 du Handbook), sans dépendance à un fournisseur cloud spécifique.

## Décision retenue
BullMQ, adossé à la même instance Redis que le cache applicatif, pour tout traitement asynchrone (notifications, exports, synchronisations tierces, réconciliation périodique des soldes).

## Justification
BullMQ s'intègre nativement à l'écosystème Node.js/NestJS déjà retenu (ADR-0003), réutilise l'infrastructure Redis déjà nécessaire pour le cache, et fournit les primitives requises (retry avec backoff exponentiel, voir Handbook section 4.6) sans dépendance à un fournisseur cloud. Cela évite d'introduire une dépendance d'infrastructure supplémentaire non justifiée par un besoin de scalabilité actuel (principe YAGNI, Handbook section 2.4).

## Conséquences
### Positives
- Aucune dépendance cloud spécifique ajoutée pour le MVP — Redis suffit en local comme en production.
- Retries et backoff gérés nativement, cohérent avec les exigences de résilience face aux appels tiers (Handbook section 4.6).
- Jobs longs (réconciliation, exports) ne bloquent jamais le thread principal de l'API.

### Négatives / compromis acceptés
- Redis devient un composant d'infrastructure critique (cache + queue) — une panne Redis affecte à la fois la performance (cache) et le traitement asynchrone. Accepté car Redis est déjà indispensable pour le cache ; surveillance renforcée à prévoir en production.

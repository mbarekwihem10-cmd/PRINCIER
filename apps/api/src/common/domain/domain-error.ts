/**
 * Base commune aux erreurs métier typées de chaque module (Handbook 1.5,
 * 2.6). Zéro dépendance framework — reste consommable depuis n'importe
 * quelle couche Domaine. Le GlobalExceptionFilter (Infrastructure) est le
 * seul endroit où `httpStatus` est traduit en réponse HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;
}

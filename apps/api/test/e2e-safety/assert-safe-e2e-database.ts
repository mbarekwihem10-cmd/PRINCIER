import * as fs from "node:fs";
import * as path from "node:path";

import * as dotenv from "dotenv";

/**
 * Garde-fou E2E (Étape 3) : refuse fail-fast toute opération de base de
 * données destinée aux tests E2E si la cible n'est pas structurellement
 * sûre. Fonction pure, sans état partagé — relit process.env et les
 * fichiers .env/.env.test à chaque appel, jamais de cache ni de flag
 * calculé une seule fois (voir historique des révisions du plan E2E).
 */
export class UnsafeE2eDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeE2eDatabaseError";
  }
}

export interface SafeE2eDatabaseConfig {
  databaseUrl: string;
  host: string;
  port: string;
  databaseName: string;
}

export interface AssertSafeE2eDatabaseOptions {
  env?: Record<string, string | undefined>;
  testEnvPath?: string;
  devEnvPath?: string;
}

const SYSTEM_DATABASE_NAMES = new Set(["postgres", "template0", "template1"]);
const SUPPORTED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

function normalizeHost(host: string): string {
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return "localhost";
  }
  return host;
}

function normalizePort(port: string): string {
  return port || "5432";
}

interface ParsedDatabaseUrl {
  host: string;
  port: string;
  name: string;
}

/**
 * Seul point du fichier qui absorbe une exception : strictement celle levée
 * par `new URL(...)`, immédiatement retraduite. Aucun autre code de ce
 * fichier n'est enveloppé dans un try/catch — en particulier, la
 * comparaison "base identique à celle de dev" (plus bas) ne peut donc
 * jamais être avalée par erreur.
 */
function parseDatabaseUrl(raw: string): ParsedDatabaseUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeE2eDatabaseError("DATABASE_URL is not a parseable URL");
  }

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeE2eDatabaseError(
      "DATABASE_URL has an unsupported protocol (only postgres:/postgresql: are accepted)",
    );
  }

  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) {
    throw new UnsafeE2eDatabaseError("DATABASE_URL has no database name");
  }

  return {
    host: normalizeHost(url.hostname),
    port: normalizePort(url.port),
    name,
  };
}

export function assertSafeE2eDatabase(
  options: AssertSafeE2eDatabaseOptions = {},
): SafeE2eDatabaseConfig {
  const env = options.env ?? process.env;
  const testEnvPath =
    options.testEnvPath ?? path.resolve(__dirname, "..", "..", ".env.test");
  const devEnvPath =
    options.devEnvPath ?? path.resolve(__dirname, "..", "..", ".env");

  // 1. NODE_ENV
  if (env.NODE_ENV !== "test") {
    throw new UnsafeE2eDatabaseError(
      'NODE_ENV must be "test" to run E2E database operations',
    );
  }

  // 2. Présence de DATABASE_URL
  const rawTestUrl = env.DATABASE_URL;
  if (!rawTestUrl) {
    throw new UnsafeE2eDatabaseError("DATABASE_URL is not set");
  }

  // Parsing isolé (protocole + nom de base non vide vérifiés ici)
  const test = parseDatabaseUrl(rawTestUrl);

  // 3. Suffixe obligatoire
  if (!test.name.endsWith("_test")) {
    throw new UnsafeE2eDatabaseError(
      `Refused: target database name must end with "_test" (got "${test.name}")`,
    );
  }

  // 4. Bases système interdites — contrôle indépendant, conservé même si la
  //    règle #3 seule suffirait déjà à les rejeter (défense en profondeur,
  //    même logique que chk_trip_dates appliqué à la fois en DB et en
  //    Domaine dans le reste du projet).
  if (SYSTEM_DATABASE_NAMES.has(test.name)) {
    throw new UnsafeE2eDatabaseError(
      `Refused: "${test.name}" is a reserved system database`,
    );
  }

  // 5. Hôte strictement local
  if (test.host !== "localhost") {
    throw new UnsafeE2eDatabaseError(
      `Refused: host "${test.host}" is not a recognized local host`,
    );
  }

  // 6. Doit différer de la base configurée dans .env (développement).
  //    Lecture indépendante du fichier, jamais via dotenv.config() (donc
  //    jamais de mutation de process.env pour cette seule comparaison).
  if (fs.existsSync(devEnvPath)) {
    const devParsed = dotenv.parse(fs.readFileSync(devEnvPath));
    if (devParsed.DATABASE_URL) {
      // Parsing isolé, hors de tout catch englobant : si l'URL de dev est
      // invalide, ceci lève et bloque l'exécution (échec fermé) au lieu de
      // l'ignorer silencieusement.
      const dev = parseDatabaseUrl(devParsed.DATABASE_URL);
      if (
        dev.host === test.host &&
        dev.port === test.port &&
        dev.name === test.name
      ) {
        throw new UnsafeE2eDatabaseError(
          "Refused: E2E database is identical to the development database",
        );
      }
    }
  }

  // 7. Anti-dérive : le DATABASE_URL effectivement actif doit correspondre
  //    exactement à .env.test relu sur disque à l'instant présent.
  if (!fs.existsSync(testEnvPath)) {
    throw new UnsafeE2eDatabaseError(
      ".env.test not found at the expected absolute path",
    );
  }
  const expectedTestEnv = dotenv.parse(fs.readFileSync(testEnvPath));
  if (expectedTestEnv.DATABASE_URL !== rawTestUrl) {
    throw new UnsafeE2eDatabaseError(
      "Refused: active DATABASE_URL does not match .env.test (environment drift)",
    );
  }

  return {
    databaseUrl: rawTestUrl,
    host: test.host,
    port: test.port,
    databaseName: test.name,
  };
}

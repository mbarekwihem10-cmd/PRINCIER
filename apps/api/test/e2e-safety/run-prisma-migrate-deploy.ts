import { execFileSync } from "node:child_process";
import * as path from "node:path";

import { assertSafeE2eDatabase } from "./assert-safe-e2e-database";

/**
 * Exécute `prisma migrate deploy` sans shell (execFileSync, arguments
 * séparés), contre la base validée par assertSafeE2eDatabase() — appelé ici
 * même, immédiatement avant l'exécution, jamais transmis en paramètre pour
 * qu'aucune URL arbitraire ne puisse être injectée par un appelant.
 */
export function runPrismaMigrateDeploy(): void {
  const config = assertSafeE2eDatabase();

  const apiRoot = path.resolve(__dirname, "..", "..");
  const schemaPath = path.resolve(apiRoot, "prisma", "schema.prisma");

  try {
    execFileSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy", "--schema", schemaPath],
      {
        cwd: apiRoot,
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: config.databaseUrl,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    // stdout/stderr capturés ci-dessus ne sont jamais affichés : ils
    // peuvent contenir DATABASE_URL. Aucune commande de contournement
    // n'est suggérée ici pour éviter qu'une exécution manuelle sans
    // NODE_ENV=test ne charge .env (base de développement) par erreur.
    throw new Error("prisma migrate deploy failed");
  }
}

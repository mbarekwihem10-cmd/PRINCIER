import * as path from "node:path";

import * as dotenv from "dotenv";

import { assertSafeE2eDatabase } from "./e2e-safety/assert-safe-e2e-database";
import { cleanE2eDatabase } from "./e2e-safety/clean-e2e-database";
import { runPrismaMigrateDeploy } from "./e2e-safety/run-prisma-migrate-deploy";
import { seedE2eReferenceData } from "./e2e-safety/seed-e2e-reference-data";

/**
 * Jest `globalSetup` : exécuté une seule fois, dans un contexte séparé des
 * fichiers de spec (aucun état partagé avec setup-env.ts). Charge donc
 * .env.test indépendamment.
 */
export default async function globalSetup(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "..", ".env.test"),
    override: true,
  });

  // Premier point de contrôle explicite : échec immédiat et lisible avant
  // toute tentative de migration. Chacun des appels suivants se re-vérifie
  // aussi indépendamment (aucune confiance dans ce seul appel).
  assertSafeE2eDatabase();

  runPrismaMigrateDeploy();

  // Nettoyage AVANT la suite (pas seulement après) : une exécution
  // précédemment interrompue ne doit jamais contaminer celle-ci.
  await cleanE2eDatabase();
  await seedE2eReferenceData();
}

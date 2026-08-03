import * as path from "node:path";

import * as dotenv from "dotenv";

import { assertSafeE2eDatabase } from "./e2e-safety/assert-safe-e2e-database";
import { cleanE2eDatabase } from "./e2e-safety/clean-e2e-database";

/**
 * Jest `globalTeardown` : nettoyage final, recommandé mais non requis pour
 * la correction de la suite qui vient de se terminer (le nettoyage
 * pré-suite dans global-setup.ts est le mécanisme structurel, celui-ci est
 * un bonus de propreté).
 */
export default async function globalTeardown(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "..", ".env.test"),
    override: true,
  });

  assertSafeE2eDatabase();

  await cleanE2eDatabase();
}

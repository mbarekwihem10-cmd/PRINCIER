import * as path from "node:path";

import * as dotenv from "dotenv";

import { assertSafeE2eDatabase } from "./e2e-safety/assert-safe-e2e-database";

// Exécuté par Jest (`setupFiles`) une fois par fichier de spec, avant même
// l'import de ce fichier — donc avant tout import d'AppModule. C'est le
// seul mécanisme qui charge .env.test ; .env (développement) n'est jamais
// chargé pendant les tests E2E (voir aussi ConfigModule.ignoreEnvFile dans
// app.module.ts).
dotenv.config({
  path: path.resolve(__dirname, "..", ".env.test"),
  override: true,
});

// Deuxième point de contrôle indépendant (le premier est dans
// global-setup.ts, exécuté dans un contexte séparé) — échec fermé avant que
// ce fichier de spec ne puisse booter AppModule.
assertSafeE2eDatabase();

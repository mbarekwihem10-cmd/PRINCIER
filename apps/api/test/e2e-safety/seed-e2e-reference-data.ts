import { PrismaClient } from "@prisma/client";

import { assertSafeE2eDatabase } from "./assert-safe-e2e-database";

/**
 * Données de référence minimales et déterministes requises pour que les
 * futurs specs E2E puissent créer des entités métier valides (ex. `Trip`
 * exige une `Trip.baseCurrency` référençant `Currency.code`).
 *
 * Ne crée jamais d'utilisateurs, de voyages ni d'autres données de
 * scénario — uniquement des données de référence idempotentes (upsert).
 */
export async function seedE2eReferenceData(): Promise<void> {
  const config = assertSafeE2eDatabase();

  const client = new PrismaClient({
    datasourceUrl: config.databaseUrl,
  });

  try {
    await client.$connect();

    await client.currency.upsert({
      where: { code: "EUR" },
      update: {},
      create: { code: "EUR", symbol: "€", decimalPlaces: 2 },
    });
  } finally {
    await client.$disconnect();
  }
}

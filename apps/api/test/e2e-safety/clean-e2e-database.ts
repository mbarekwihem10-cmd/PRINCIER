import { PrismaClient } from "@prisma/client";

import { assertSafeE2eDatabase } from "./assert-safe-e2e-database";

/**
 * Liste complète et statique des 62 tables métier du schéma (61 créées par
 * la migration `expand_full_domain_schema` + `users`, créée par
 * `init_bootstrap`). Écrite à la main, jamais assemblée par interpolation
 * (`.map()`/`.join()`) — voir plan E2E v3, point 7.
 *
 * `_prisma_migrations` n'apparaît jamais ici et ne doit jamais y être
 * ajoutée.
 *
 * Cette liste étant exhaustive, TRUNCATE n'a pas besoin de CASCADE : toutes
 * les tables ayant une FK vers une autre table de la liste sont elles-mêmes
 * truncatées dans la même instruction (règle Postgres). Conséquence
 * délibérée : si une future table dépendante est ajoutée au schéma sans
 * être ajoutée ici, le nettoyage ÉCHOUE (violation de contrainte FK) au
 * lieu de vider silencieusement cette table via CASCADE. Coût assumé :
 * cette constante doit être mise à jour manuellement, en revue de code, à
 * chaque nouvelle table ajoutée à schema.prisma.
 */
const TRUNCATE_ALL_BUSINESS_TABLES_SQL = `
TRUNCATE TABLE
  "public"."currencies", "public"."files", "public"."audit_logs", "public"."idempotency_keys",
  "public"."feature_flags", "public"."webhook_events",
  "public"."users", "public"."auth_identities", "public"."refresh_tokens", "public"."roles",
  "public"."user_roles", "public"."permissions", "public"."role_permissions",
  "public"."travel_documents", "public"."emergency_contacts",
  "public"."travel_groups", "public"."travel_group_members", "public"."trips",
  "public"."trip_members", "public"."trip_invitations",
  "public"."availabilities", "public"."calendar_events", "public"."personal_calendar_events",
  "public"."providers", "public"."establishments", "public"."drivers", "public"."vehicles",
  "public"."driver_background_checks", "public"."provider_payout_accounts",
  "public"."driver_payout_accounts",
  "public"."bookings", "public"."flight_bookings", "public"."flight_passengers",
  "public"."stay_bookings", "public"."ride_bookings", "public"."car_rental_bookings",
  "public"."activity_bookings", "public"."restaurant_bookings", "public"."delivery_orders",
  "public"."event_bookings", "public"."esim_orders",
  "public"."expenses", "public"."expense_shares", "public"."settlements", "public"."trip_balances",
  "public"."payments", "public"."refunds", "public"."commission_entries", "public"."payouts",
  "public"."payout_line_items", "public"."invoices", "public"."invoice_line_items",
  "public"."wallets", "public"."wallet_balances", "public"."wallet_transactions",
  "public"."conversations", "public"."messages", "public"."message_reads",
  "public"."notifications", "public"."notification_preferences",
  "public"."favorites", "public"."reviews"
RESTART IDENTITY;
`;

export async function cleanE2eDatabase(): Promise<void> {
  // Check #1 — avant toute connexion.
  const config = assertSafeE2eDatabase();

  const client = new PrismaClient({
    datasourceUrl: config.databaseUrl,
  });

  try {
    await client.$connect();

    // Check #2 — juste avant l'instruction destructive. Ne fait jamais
    // confiance à `config` calculé plus haut : rappel indépendant et
    // vérification de cohérence entre les deux résultats sur les trois
    // éléments identifiant la cible (host, port, databaseName).
    const recheck = assertSafeE2eDatabase();
    if (
      recheck.host !== config.host ||
      recheck.port !== config.port ||
      recheck.databaseName !== config.databaseName
    ) {
      throw new Error(
        "E2E database identity changed between safety checks — aborting cleanup",
      );
    }

    await client.$executeRawUnsafe(TRUNCATE_ALL_BUSINESS_TABLES_SQL);
  } finally {
    await client.$disconnect();
  }
}

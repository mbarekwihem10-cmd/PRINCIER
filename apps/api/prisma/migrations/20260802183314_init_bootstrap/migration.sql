-- Prérequis PostgreSQL (extensions + fonction UUIDv7). Doit vivre dans une
-- migration versionnée — et non uniquement dans infra/docker/postgres/init-uuidv7.sql
-- — pour que tout environnement rejouant l'historique de migrations depuis
-- zéro (base fantôme, CI, staging, production) dispose du même socle sans
-- dépendre d'un script d'initialisation Docker propre à l'environnement local.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
AS $$
DECLARE
  unix_ts_ms bytea;
  rand_bytes bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3 FOR 6);
  rand_bytes := gen_random_bytes(10);

  -- Version 7 dans les 4 bits hauts de l'octet 6, variant RFC 4122 dans les
  -- 2 bits hauts de l'octet 8.
  rand_bytes := set_byte(rand_bytes, 0, (get_byte(rand_bytes, 0) & 15) | 112);
  rand_bytes := set_byte(rand_bytes, 2, (get_byte(rand_bytes, 2) & 63) | 128);

  RETURN encode(unix_ts_ms || rand_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

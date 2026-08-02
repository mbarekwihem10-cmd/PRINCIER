-- Extension citext requise par users.email et trip_invitations.email (voir docs/database-design.md).
CREATE EXTENSION IF NOT EXISTS citext;

-- Extension pgcrypto requise par gen_random_bytes(), utilisée ci-dessous
-- pour générer la partie aléatoire des UUIDv7.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PostgreSQL 16 n'a pas de générateur UUIDv7 natif (disponible seulement à
-- partir de PostgreSQL 18). Implémentation de référence : les 48 premiers
-- bits sont un timestamp Unix en millisecondes (triable, contrairement à
-- UUIDv4), le reste est aléatoire — conforme au brouillon RFC 9562.
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

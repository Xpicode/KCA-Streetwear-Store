-- Supabase exposes the "public" schema through its Data API (PostgREST) to the anon and
-- authenticated roles. This app never uses that API — it connects directly as the postgres
-- role (which bypasses RLS) — so those roles get no access at all. Every table also has
-- RLS enabled (0005) with no policies, which is deny-all as a second layer.
-- On plain Postgres (local Docker) the roles don't exist and this block is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
--> statement-breakpoint
-- Checkout and order tracking match customers by phone digits; index the expression they use.
CREATE INDEX IF NOT EXISTS "customers_phone_digits_idx" ON "customers" ((regexp_replace(coalesce("phone", ''), '\D', '', 'g')));

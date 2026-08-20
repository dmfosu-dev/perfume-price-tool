-- Closes the "Table publicly accessible / rls_disabled_in_public" advisory.
--
-- Supabase exposes every table in `public` through PostgREST at
-- https://<ref>.supabase.co/rest/v1/. Reaching it needs the anon (publishable)
-- key, which Supabase treats as public by design — it is meant to be shipped in
-- browsers. The only thing protecting this database was that the key had not
-- been published anywhere yet. That is not a control.
--
-- Before this migration `anon` and `authenticated` held
-- INSERT/SELECT/UPDATE/DELETE/TRUNCATE on all 14 tables, including "User"
-- (password hashes) and "Session" (session token hashes).
--
-- This app never uses PostgREST. It talks to Postgres directly through Prisma
-- as the `postgres` role, and supabase-js is used server-side only, with the
-- service-role key, purely for Storage. Both `postgres` and `service_role` have
-- rolbypassrls = true, so nothing below affects the application.

-- 1. Enable RLS on every table in public. With no policies attached this denies
--    all row access to anon/authenticated while remaining invisible to roles
--    that bypass RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2. Revoke the blanket grants. This is not belt-and-braces: RLS does not apply
--    to TRUNCATE, so with the grants left in place anyone holding the anon key
--    could still empty every table despite step 1.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3. Stop the grants coming back. Supabase's default privileges re-grant
--    everything to anon on each newly created table, so without this the next
--    Prisma migration would silently reopen the hole for its new tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 4. Backstop: without USAGE on the schema, PostgREST cannot resolve an object
--    in `public` at all, whoever created it and whatever its grants say.
--    Reverse with GRANT USAGE ON SCHEMA public TO anon, authenticated; if this
--    project ever needs client-side supabase-js — and write RLS policies first.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

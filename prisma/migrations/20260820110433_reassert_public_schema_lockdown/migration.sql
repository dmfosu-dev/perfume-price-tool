-- Correction and guard for the previous migration.
--
-- Step 4 of 20260820110046_lock_down_public_schema claimed that revoking USAGE
-- on schema public from anon/authenticated would stop PostgREST resolving
-- objects there. It does not, and that comment overstates what happened. Those
-- roles never held an explicit grant: USAGE on `public` is inherited from the
-- PUBLIC pseudo-role, so the REVOKE matched nothing and anon still has USAGE.
--
-- That was left alone deliberately rather than escalated to
-- `REVOKE USAGE ON SCHEMA public FROM PUBLIC`. On this project postgres and
-- service_role hold explicit USAGE, but supabase_admin, supabase_auth_admin,
-- supabase_storage_admin and authenticator all inherit theirs from PUBLIC —
-- revoking it risks breaking Supabase Storage, which this app uses for product
-- photos, in exchange for nothing. USAGE on a schema only permits *looking up*
-- an object; reading one still needs a privilege on the object itself, and
-- step 2 removed every one of those.
--
-- The protection therefore rests on: no object privileges for anon or
-- authenticated, RLS enabled on every table, and default privileges that no
-- longer re-grant. This migration re-asserts the first of those, so the fix
-- reapplies cleanly if the database is ever restored or the grants are handed
-- back by a future dashboard action.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Fail the deploy rather than report success if anything is still reachable.
DO $$
DECLARE leaked int;
BEGIN
  SELECT count(*) INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
  IF leaked > 0 THEN
    RAISE EXCEPTION 'public schema still exposes % grant(s) to anon/authenticated', leaked;
  END IF;

  SELECT count(*) INTO leaked
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF leaked > 0 THEN
    RAISE EXCEPTION '% table(s) in public still have RLS disabled', leaked;
  END IF;
END $$;

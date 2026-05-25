-- ============================================================
-- E2-a: scope every public-schema RLS policy to `authenticated`.
--
-- Previously the policies' `roles` column was `{public}`, which:
--   1. Lets anon (unauthenticated) requests run the policy quals;
--      they're filtered out by the ownership predicate in USING,
--      but each request still pays the cost of evaluating it.
--   2. Was the pre-Supabase-recommended default; current guidance
--      is to set `TO authenticated` (or `TO anon`) explicitly.
--
-- USING/WITH_CHECK expressions are left untouched — each policy
-- already encodes the correct ownership/role predicate via
-- helpers like `is_hr_or_admin()`, `is_manager_or_above()`,
-- or `auth.uid() = …`. Server actions using the service_role
-- bypass RLS entirely (BYPASSRLS) and are unaffected.
--
-- The auth.uid() initplan optimisation (`(select auth.uid())`)
-- is deferred to a follow-up — it's a perf tweak, not security.
-- ============================================================

DO $$
DECLARE
  pol RECORD;
  stmt TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'::name[]
    ORDER BY tablename, policyname
  LOOP
    stmt := format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      pol.policyname, pol.schemaname, pol.tablename
    );
    EXECUTE stmt;
    RAISE NOTICE '%', stmt;
  END LOOP;
END $$;

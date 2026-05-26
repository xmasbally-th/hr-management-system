-- ============================================================
-- E2-b: wrap `auth.uid()` in `(select auth.uid())` inside every
-- RLS policy under public.*.
--
-- Rationale (Supabase + Postgres perf guidance):
--   Bare `auth.uid()` is re-evaluated once per scanned row. Wrapping
--   it in a sub-select promotes the call to an InitPlan that runs
--   once per query. For tables with thousands of rows this changes
--   policy cost from O(N) calls to O(1).
--
-- Approach:
--   1. Iterate pg_policies in public.* where USING / WITH CHECK
--      contains `auth.uid()` (51 policies after inventory).
--   2. Three-step substitution that's idempotent:
--        a. swap any already-wrapped `( SELECT auth.uid() AS uid)`
--           for a sentinel,
--        b. wrap bare `auth.uid()` → `(select auth.uid())`,
--        c. restore the sentinel back to a wrapped form.
--   3. ALTER POLICY with the rewritten clause(s), preserving cmd
--      shape (SELECT/DELETE → USING only, INSERT → WITH CHECK only,
--      UPDATE/ALL → both when present).
--
-- USING/WITH CHECK semantics are unchanged — `(select auth.uid())`
-- returns the same uuid as `auth.uid()`.  Only the planner
-- treatment changes.
-- ============================================================

DO $$
DECLARE
  pol      RECORD;
  new_u    TEXT;
  new_c    TEXT;
  stmt     TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
    ORDER BY tablename, policyname
  LOOP
    new_u := pol.qual;
    new_c := pol.with_check;

    -- Idempotent wrap: protect existing wrapped forms first
    new_u := replace(new_u, '( SELECT auth.uid() AS uid)', '__WRAPPED_AUTH_UID__');
    new_c := replace(new_c, '( SELECT auth.uid() AS uid)', '__WRAPPED_AUTH_UID__');

    -- Wrap bare auth.uid()
    new_u := replace(new_u, 'auth.uid()', '(select auth.uid())');
    new_c := replace(new_c, 'auth.uid()', '(select auth.uid())');

    -- Restore protected wrappers (now equivalent to the new wrap)
    new_u := replace(new_u, '__WRAPPED_AUTH_UID__', '(select auth.uid())');
    new_c := replace(new_c, '__WRAPPED_AUTH_UID__', '(select auth.uid())');

    -- Build ALTER POLICY based on cmd shape
    IF pol.cmd IN ('SELECT', 'DELETE') THEN
      stmt := format('ALTER POLICY %I ON %I.%I USING (%s)',
                     pol.policyname, pol.schemaname, pol.tablename, new_u);
    ELSIF pol.cmd = 'INSERT' THEN
      stmt := format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                     pol.policyname, pol.schemaname, pol.tablename, new_c);
    ELSE  -- UPDATE or ALL
      IF new_u IS NOT NULL AND new_c IS NOT NULL THEN
        stmt := format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
                       pol.policyname, pol.schemaname, pol.tablename, new_u, new_c);
      ELSIF new_u IS NOT NULL THEN
        stmt := format('ALTER POLICY %I ON %I.%I USING (%s)',
                       pol.policyname, pol.schemaname, pol.tablename, new_u);
      ELSE
        stmt := format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                       pol.policyname, pol.schemaname, pol.tablename, new_c);
      END IF;
    END IF;

    EXECUTE stmt;
    RAISE NOTICE '%', stmt;
  END LOOP;
END $$;

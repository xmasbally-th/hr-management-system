-- ============================================================
-- Fix RLS recursion in get_my_role / is_hr_or_admin /
-- is_manager_or_above caused by E4 (20260609_e4_advisor_fixes.sql).
--
-- E4 switched these helpers to SECURITY INVOKER to address the
-- "anon_security_definer_function_executable" advisor warning.
-- Side effect: when called from a USING policy on the `profiles`
-- table (the "profiles: manager+ read all" policy uses
-- is_manager_or_above()), the function's own
-- `SELECT … FROM profiles WHERE id = auth.uid()` re-evaluates RLS,
-- which re-invokes the same policy → infinite recursion → Postgres
-- aborts with `stack depth limit exceeded` (SQLSTATE 54001).
--
-- Fix: restore SECURITY DEFINER so the helper body bypasses RLS
-- in the inner query. Then REVOKE EXECUTE from anon (the
-- advisor's actual concern). authenticated keeps EXECUTE because
-- RLS expressions evaluate as the calling role and need to be
-- able to invoke the helper. The remaining
-- "authenticated_security_definer_function_executable" advisor
-- warning is a false-positive: each helper only reads the
-- caller's OWN profile (auth.uid()-keyed) and leaks no data.
--
-- search_path stays locked per the Supabase security checklist.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('manager', 'hr', 'admin')
  );
$$;

-- Silence the anon advisor warning. Keep authenticated EXECUTE so
-- RLS policy expressions can invoke these helpers during query
-- evaluation. PUBLIC is also revoked so future role additions
-- inherit the safer default.
REVOKE EXECUTE ON FUNCTION public.get_my_role()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hr_or_admin()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_above() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_role()         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_hr_or_admin()      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_manager_or_above() TO authenticated;

-- ============================================================
-- E4 advisor fixes — addresses 4 of 5 warnings raised by
-- `supabase db advisors` (security).  The 5th (Leaked Password
-- Protection) is an Auth dashboard toggle, not SQL.
--
-- 1. Lock search_path on set_updated_at.
-- 2. Drop the broad SELECT policy on the public `avatars` bucket
--    (public buckets serve URLs without RLS; the policy only
--    enabled bucket listing, which leaks file names).
-- 3. Switch helper RLS functions from SECURITY DEFINER to
--    SECURITY INVOKER. They only read `profiles WHERE id =
--    auth.uid()`, which the "own profile read" RLS policy
--    already permits — so RLS still resolves correctly without
--    elevating privilege via /rest/v1/rpc.
-- 4. Revoke EXECUTE on `rls_auto_enable` (event-trigger helper —
--    callers never invoke it; PG fires it on DDL).
-- ============================================================

-- ── 1. set_updated_at — lock search_path ───────────────────
ALTER FUNCTION public.set_updated_at()
  SET search_path = pg_catalog, public, pg_temp;

-- ── 2. avatars bucket — drop the broad listing policy ─────
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;

-- ── 3. helper functions: SECURITY DEFINER → INVOKER ───────
-- Re-create with the same body but invoker security so the
-- functions can't be used to bypass RLS via /rest/v1/rpc.
-- `profiles: own read` policy still lets each caller read
-- their own row, which is all these helpers need.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('manager', 'hr', 'admin')
  );
$$;

-- ── 4. rls_auto_enable — revoke RPC executability ─────────
-- This is an event-trigger helper, not a user-callable RPC.
-- Event triggers fire from the DDL context regardless of grants.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

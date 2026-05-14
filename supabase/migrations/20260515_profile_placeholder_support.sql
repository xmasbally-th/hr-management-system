-- Enables "placeholder profile" mode for Phase M2 bulk import.
--
-- The default Supabase pattern is `profiles.id UUID REFERENCES auth.users(id)
-- ON DELETE CASCADE`. That FK prevents inserting a profile row before its
-- corresponding auth.users record exists. We want HR to bulk-import employees
-- by email *before* they have ever signed in — so we drop that constraint.
--
-- When a user later signs in via Google, the OAuth callback re-keys the
-- placeholder profile to the new auth.uid (see app/auth/callback/route.ts).
--
-- Idempotent — safe to run even if the FK doesn't exist.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Notes:
-- * RLS policies on profiles still rely on auth.uid() = profiles.id at SELECT/
--   UPDATE time, so security is unaffected for normal users.
-- * Placeholder rows are visible only to HR/Admin (via separate RLS policies
--   in 20260505_rls_policies.sql) until they get re-keyed on first login.
-- * To revert: re-add the FK after all placeholders have been claimed.

-- ============================================================
-- Security Fixes — Critical Issues C2 + C3
-- Run this in Supabase SQL Editor AFTER the initial RLS script
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Pre-check: ensure 'cancelled' exists in the request_status
-- enum (or whichever enum the status column uses).
-- This is idempotent — safe to run multiple times.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Check which enum type the leave_requests.status column uses
  -- and ensure it has 'cancelled'
  PERFORM 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN information_schema.columns c
      ON c.udt_name = t.typname
    WHERE c.table_schema = 'public'
      AND c.table_name = 'leave_requests'
      AND c.column_name = 'status'
      AND e.enumlabel = 'cancelled';

  IF NOT FOUND THEN
    -- Get the actual enum type name and add 'cancelled'
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L',
      (
        SELECT t.typname
        FROM pg_type t
        JOIN information_schema.columns c ON c.udt_name = t.typname
        WHERE c.table_schema = 'public'
          AND c.table_name = 'leave_requests'
          AND c.column_name = 'status'
        LIMIT 1
      ),
      'cancelled'
    );
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- C2: notifications — allow any authenticated user to INSERT
-- Notifications are created server-side by leave/travel actions
-- on behalf of other users. The old policy only allowed hr/admin.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications: hr/admin insert" ON public.notifications;

CREATE POLICY "notifications: authenticated insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- C3: profiles — restrict own-update to safe columns only
-- Prevent employees from self-escalating role or status.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;

CREATE POLICY "profiles: own update safe columns"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- C3b: profiles — restrict hr/admin update to prevent
-- HR from promoting themselves to admin
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: hr/admin update all" ON public.profiles;

CREATE POLICY "profiles: hr/admin update all"
  ON public.profiles FOR UPDATE
  USING (public.is_hr_or_admin())
  WITH CHECK (
    CASE
      WHEN public.get_my_role() = 'admin' THEN true
      WHEN public.get_my_role() = 'hr' THEN
        (role IS NULL OR role IN ('employee', 'manager', 'hr'))
      ELSE false
    END
  );

-- ────────────────────────────────────────────────────────────
-- C3c: leave_requests / travel_requests — prevent employee
-- self-approve by restricting own-update WITH CHECK on status
-- Uses text cast to avoid enum mismatch errors
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_requests: own update pending" ON public.leave_requests;

CREATE POLICY "leave_requests: own update pending"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = employee_id
    AND status::text IN ('pending', 'cancelled')
  );

DROP POLICY IF EXISTS "travel_requests: own update pending" ON public.travel_requests;

CREATE POLICY "travel_requests: own update pending"
  ON public.travel_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = employee_id
    AND status::text IN ('pending', 'cancelled')
  );

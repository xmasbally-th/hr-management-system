-- ============================================================
-- Security Fixes — Critical Issues C2 + C3
-- Run this in Supabase SQL Editor AFTER the initial RLS script
-- ============================================================

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
DROP POLICY IF EXISTS "profiles: own update" ON public.notifications;
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
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leave_requests: own update pending" ON public.leave_requests;

CREATE POLICY "leave_requests: own update pending"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = employee_id
    AND status IN ('pending', 'cancelled')
  );

DROP POLICY IF EXISTS "travel_requests: own update pending" ON public.travel_requests;

CREATE POLICY "travel_requests: own update pending"
  ON public.travel_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = employee_id
    AND status IN ('pending', 'cancelled')
  );

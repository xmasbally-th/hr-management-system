-- ============================================================
-- Row Level Security (RLS) Policies
-- HR Management System
-- Run this in Supabase SQL Editor
-- ============================================================
-- Based on actual schema diagnostic (2026-05-05):
-- leave_requests.employee_id, travel_requests.employee_id,
-- leave_balances.employee_id, employee_trainings.employee_id,
-- leave_vacation_details.request_id, notifications.user_id,
-- document_tracking.reference_id (no created_by/assigned_to)
-- ============================================================

-- Helper function: get the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function: check if current user is hr or admin
CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('hr', 'admin')
  );
$$;

-- Helper function: check if current user is manager, hr, or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('manager', 'hr', 'admin')
  );
$$;

-- ============================================================
-- 1. profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: manager+ read all"
  ON public.profiles FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: hr/admin update all"
  ON public.profiles FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "profiles: hr/admin insert"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 2. departments
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments: authenticated read"
  ON public.departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "departments: hr/admin insert"
  ON public.departments FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "departments: hr/admin update"
  ON public.departments FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "departments: hr/admin delete"
  ON public.departments FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 3. positions
-- ============================================================
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions: authenticated read"
  ON public.positions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "positions: hr/admin insert"
  ON public.positions FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "positions: hr/admin update"
  ON public.positions FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "positions: hr/admin delete"
  ON public.positions FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 4. leave_types
-- ============================================================
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types: authenticated read"
  ON public.leave_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "leave_types: admin insert"
  ON public.leave_types FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "leave_types: admin update"
  ON public.leave_types FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "leave_types: admin delete"
  ON public.leave_types FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 5. leave_balances (uses employee_id)
-- ============================================================
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_balances: own read"
  ON public.leave_balances FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "leave_balances: manager+ read all"
  ON public.leave_balances FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "leave_balances: hr/admin insert"
  ON public.leave_balances FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "leave_balances: hr/admin update"
  ON public.leave_balances FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "leave_balances: hr/admin delete"
  ON public.leave_balances FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 6. leave_requests (uses employee_id, approver_id)
-- ============================================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests: own read"
  ON public.leave_requests FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "leave_requests: manager+ read all"
  ON public.leave_requests FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "leave_requests: own insert"
  ON public.leave_requests FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "leave_requests: hr/admin insert any"
  ON public.leave_requests FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "leave_requests: own update pending"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "leave_requests: manager+ update all"
  ON public.leave_requests FOR UPDATE
  USING (public.is_manager_or_above());

CREATE POLICY "leave_requests: own delete pending"
  ON public.leave_requests FOR DELETE
  USING (auth.uid() = employee_id AND status = 'pending');

CREATE POLICY "leave_requests: hr/admin delete"
  ON public.leave_requests FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 7. leave_vacation_details (uses request_id → leave_requests)
-- ============================================================
ALTER TABLE public.leave_vacation_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_vacation_details: read via request"
  ON public.leave_vacation_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (lr.employee_id = auth.uid() OR public.is_manager_or_above())
    )
  );

CREATE POLICY "leave_vacation_details: insert via request"
  ON public.leave_vacation_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (lr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

CREATE POLICY "leave_vacation_details: update via request"
  ON public.leave_vacation_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (lr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

CREATE POLICY "leave_vacation_details: delete via request"
  ON public.leave_vacation_details FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = request_id
        AND (lr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

-- ============================================================
-- 8. travel_requests (uses employee_id, approver_id)
-- ============================================================
ALTER TABLE public.travel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_requests: own read"
  ON public.travel_requests FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "travel_requests: manager+ read all"
  ON public.travel_requests FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "travel_requests: own insert"
  ON public.travel_requests FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "travel_requests: hr/admin insert any"
  ON public.travel_requests FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "travel_requests: own update pending"
  ON public.travel_requests FOR UPDATE
  USING (auth.uid() = employee_id AND status = 'pending')
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "travel_requests: manager+ update all"
  ON public.travel_requests FOR UPDATE
  USING (public.is_manager_or_above());

CREATE POLICY "travel_requests: own delete pending"
  ON public.travel_requests FOR DELETE
  USING (auth.uid() = employee_id AND status = 'pending');

CREATE POLICY "travel_requests: hr/admin delete"
  ON public.travel_requests FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 9. travel_expenses (uses travel_request_id → travel_requests)
-- ============================================================
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_expenses: read via request"
  ON public.travel_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = travel_request_id
        AND (tr.employee_id = auth.uid() OR public.is_manager_or_above())
    )
  );

CREATE POLICY "travel_expenses: insert via request"
  ON public.travel_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = travel_request_id
        AND (tr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

CREATE POLICY "travel_expenses: update via request"
  ON public.travel_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = travel_request_id
        AND (tr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

CREATE POLICY "travel_expenses: delete via request"
  ON public.travel_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = travel_request_id
        AND (tr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

-- ============================================================
-- 10. document_tracking (uses reference_id, no user ownership)
-- Only HR/Admin can manage document tracking
-- ============================================================
ALTER TABLE public.document_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_tracking: hr/admin read all"
  ON public.document_tracking FOR SELECT
  USING (public.is_hr_or_admin());

CREATE POLICY "document_tracking: manager read all"
  ON public.document_tracking FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "document_tracking: hr/admin insert"
  ON public.document_tracking FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "document_tracking: hr/admin update"
  ON public.document_tracking FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "document_tracking: admin delete"
  ON public.document_tracking FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 11. employee_trainings (uses employee_id)
-- ============================================================
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_trainings: own read"
  ON public.employee_trainings FOR SELECT
  USING (auth.uid() = employee_id);

CREATE POLICY "employee_trainings: manager+ read all"
  ON public.employee_trainings FOR SELECT
  USING (public.is_manager_or_above());

CREATE POLICY "employee_trainings: hr/admin insert"
  ON public.employee_trainings FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "employee_trainings: hr/admin update"
  ON public.employee_trainings FOR UPDATE
  USING (public.is_hr_or_admin());

CREATE POLICY "employee_trainings: hr/admin delete"
  ON public.employee_trainings FOR DELETE
  USING (public.is_hr_or_admin());

-- ============================================================
-- 12. notifications (uses user_id)
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: own read"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications: hr/admin insert"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "notifications: own delete"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

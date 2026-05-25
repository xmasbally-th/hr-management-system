-- ============================================================
-- E1: add WITH CHECK to every UPDATE policy in public.* whose
-- with_check was NULL (IDOR / ownership-reassign risk).
--
-- WITH CHECK = USING for each policy: the post-update row must
-- still satisfy the same ownership predicate as the pre-update
-- row.  This blocks rows being reassigned to a different
-- employee/owner via UPDATE.
--
-- Source: pg_policies query 2026-05-25 — 12 policies affected.
-- ============================================================

ALTER POLICY "departments: hr/admin update" ON public.departments
  WITH CHECK (public.is_hr_or_admin());

ALTER POLICY "document_tracking: hr/admin update" ON public.document_tracking
  WITH CHECK (public.is_hr_or_admin());

ALTER POLICY "employee_trainings: hr/admin update" ON public.employee_trainings
  WITH CHECK (public.is_hr_or_admin());

ALTER POLICY "leave_balances: hr/admin update" ON public.leave_balances
  WITH CHECK (public.is_hr_or_admin());

ALTER POLICY "leave_requests: manager+ update all" ON public.leave_requests
  WITH CHECK (public.is_manager_or_above());

ALTER POLICY "leave_types: admin update" ON public.leave_types
  WITH CHECK (public.get_my_role() = 'admin'::text);

ALTER POLICY "leave_vacation_details: update via request" ON public.leave_vacation_details
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.id = leave_vacation_details.request_id
        AND (lr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

ALTER POLICY "positions: hr/admin update" ON public.positions
  WITH CHECK (public.is_hr_or_admin());

ALTER POLICY "own_or_hr_update" ON public.profile_educations
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['hr'::user_role, 'admin'::user_role])
    )
  );

ALTER POLICY "Users can update own profile" ON public.profiles
  WITH CHECK (auth.uid() = id);

ALTER POLICY "travel_expenses: update via request" ON public.travel_expenses
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.travel_requests tr
      WHERE tr.id = travel_expenses.travel_request_id
        AND (tr.employee_id = auth.uid() OR public.is_hr_or_admin())
    )
  );

ALTER POLICY "travel_requests: manager+ update all" ON public.travel_requests
  WITH CHECK (public.is_manager_or_above());

-- ============================================================
-- Fix: employees cannot read their own document_tracking rows
--
-- document_tracking only had SELECT policies for hr/admin and manager,
-- so getMyDocuments() (RLS client) returned nothing for employees —
-- /dashboard/documents was empty for them. This adds an employee-own
-- SELECT policy, also required for W6 (employee document timeline).
--
-- Follows Supabase RLS guidance: scope with TO authenticated + an
-- ownership predicate, and wrap auth.uid() in a sub-select so the
-- planner caches it (initplan) instead of evaluating per row.
-- ============================================================

DROP POLICY IF EXISTS "document_tracking: employee read own" ON public.document_tracking;

CREATE POLICY "document_tracking: employee read own"
  ON public.document_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = document_tracking.reference_id
        AND lr.employee_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = document_tracking.reference_id
        AND tr.employee_id = (select auth.uid())
    )
  );

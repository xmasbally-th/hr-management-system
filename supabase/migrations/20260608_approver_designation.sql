-- ============================================================
-- Approver designation + acting delegation (Phase 1: schema only)
--
-- Foundation for:
--   • ประธานสาขาวิชา / ผอ. / คณบดี approver designation (admin-managed)
--   • รักษาราชการแทนคณบดี — temporary, date-ranged acting delegation
--   • new leave stage `awaiting_chair` (vacation + academic staff only)
--
-- Additive only. Workflow wiring + UI land in later phases.
-- ============================================================

-- 1. New leave stage: ประธานสาขาวิชา (sits before ผอ.) ─────────────
--    Run standalone (ADD VALUE) — idempotent via IF NOT EXISTS.
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'awaiting_chair' BEFORE 'awaiting_director';

-- 2. document_tracking: chair routing + signature timestamps ───────
ALTER TABLE public.document_tracking
  ADD COLUMN IF NOT EXISTS sent_to_chair_date timestamptz,
  ADD COLUMN IF NOT EXISTS chair_signed_date  timestamptz;

COMMENT ON COLUMN public.document_tracking.sent_to_chair_date IS
  'วันที่ส่งให้ประธานสาขาวิชาให้ความเห็น (เฉพาะลาพักผ่อนสายวิชาการ)';
COMMENT ON COLUMN public.document_tracking.chair_signed_date IS
  'วันที่ประธานสาขาวิชาให้ความเห็น/ลงนาม';

-- 3. workflow_approvers: who is chair / director / dean ────────────
CREATE TABLE IF NOT EXISTS public.workflow_approvers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approver_role text NOT NULL CHECK (approver_role IN ('chair', 'director', 'dean')),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- chair is scoped to a สาขา/department; ผอ./คณบดี are faculty-wide (single)
  CONSTRAINT chair_needs_department CHECK (
    (approver_role = 'chair'                   AND department_id IS NOT NULL) OR
    (approver_role IN ('director', 'dean')     AND department_id IS NULL)
  )
);

-- one chair per department; exactly one director and one dean (single faculty)
CREATE UNIQUE INDEX IF NOT EXISTS workflow_approvers_chair_uq
  ON public.workflow_approvers (department_id) WHERE approver_role = 'chair';
CREATE UNIQUE INDEX IF NOT EXISTS workflow_approvers_singleton_uq
  ON public.workflow_approvers (approver_role) WHERE approver_role IN ('director', 'dean');

COMMENT ON TABLE public.workflow_approvers IS
  'ผู้มีอำนาจลงนาม workflow การลา: chair (ต่อ department), director (ผอ.), dean (คณบดี) — กำหนดโดย admin';

-- 4. acting_delegations: รักษาราชการแทนคณบดี (temporary) ───────────
CREATE TABLE IF NOT EXISTS public.acting_delegations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approver_role    text NOT NULL DEFAULT 'dean' CHECK (approver_role = 'dean'),
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acting_valid_range CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.acting_delegations IS
  'รักษาราชการแทน (ชั่วคราวตามช่วงวันที่) — ปัจจุบันรองรับเฉพาะแทนคณบดี (dean)';

-- 5. RLS — read for any authenticated user (UI shows approver names);
--    writes are admin-only (server actions also gate at the app layer).
--    Matches the master-data RLS pattern in 20260505_rls_policies.sql.
ALTER TABLE public.workflow_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acting_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_approvers: authenticated read"
  ON public.workflow_approvers FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "workflow_approvers: admin insert"
  ON public.workflow_approvers FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "workflow_approvers: admin update"
  ON public.workflow_approvers FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "workflow_approvers: admin delete"
  ON public.workflow_approvers FOR DELETE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "acting_delegations: authenticated read"
  ON public.acting_delegations FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "acting_delegations: admin insert"
  ON public.acting_delegations FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "acting_delegations: admin update"
  ON public.acting_delegations FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "acting_delegations: admin delete"
  ON public.acting_delegations FOR DELETE
  USING (public.get_my_role() = 'admin');

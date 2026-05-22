-- ============================================================
-- leave_cancellation_requests — ยกเลิกใบลาที่ "เสร็จสิ้น (completed)" แล้ว
--
-- ใบลาที่ completed (ลงนามครบ/เก็บแฟ้มแล้ว) ยกเลิกตรง ๆ ไม่ได้ ต้องยื่น
-- "ใบขอยกเลิก" ที่เดินผ่าน workflow ลายเซ็นเดียวกัน:
--   pending → ผอ.เซ็น → คณบดีเซ็น → ส่งอธิการบดี(รับทราบ) → completed
-- (ส่งถึงอธิการบดีเสมอ แต่ไม่มีเอกสารตอบกลับ)
-- เมื่อใบขอยกเลิก completed → คืน balance + ตั้งใบลาเดิม status='cancelled'.
--
-- routing dates ใช้ document_tracking ร่วม (document_type='leave_cancellation',
-- reference_id = leave_cancellation_requests.id) — ไม่ต้องเพิ่มคอลัมน์ใหม่.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leave_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status public.user_status NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_cancel_leave  ON public.leave_cancellation_requests (leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_cancel_status ON public.leave_cancellation_requests (status);

COMMENT ON TABLE public.leave_cancellation_requests IS 'คำขอยกเลิกใบลาที่เสร็จสิ้นแล้ว — เดินผ่าน workflow ลายเซ็น (ผอ./คณบดี/อธิการบดี)';

ALTER TABLE public.leave_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- เจ้าของใบลา หรือผู้ยื่น อ่านได้
CREATE POLICY "leave_cancellation: own read"
  ON public.leave_cancellation_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_id AND lr.employee_id = (select auth.uid())
    )
  );

-- manager ขึ้นไป อ่านได้ทั้งหมด
CREATE POLICY "leave_cancellation: manager+ read all"
  ON public.leave_cancellation_requests FOR SELECT
  TO authenticated
  USING (public.is_manager_or_above());

-- เจ้าของใบลายื่นคำขอยกเลิกของตัวเองได้ · HR/Admin ยื่นแทนได้
CREATE POLICY "leave_cancellation: insert own or hr"
  ON public.leave_cancellation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_hr_or_admin()
    OR (
      requested_by = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.id = leave_request_id AND lr.employee_id = (select auth.uid())
      )
    )
  );

-- HR/Admin เดิน workflow (UPDATE ต้องมีทั้ง USING + WITH CHECK ตาม checklist)
CREATE POLICY "leave_cancellation: hr/admin update"
  ON public.leave_cancellation_requests FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

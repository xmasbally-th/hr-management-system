-- ============================================================
-- D5: travel_cancellation_requests — ยกเลิกคำขอเดินทางที่
-- "เสร็จสิ้น (completed)" แล้ว.
--
-- คำขอเดินทางที่ completed (ลงนามครบ/เก็บแฟ้มแล้ว) ยกเลิกตรง ๆ ไม่ได้
-- ต้องยื่น "ใบขอยกเลิก" ที่เดินผ่าน workflow ลายเซ็นเดียวกัน:
--   pending → ผอ.เซ็น → คณบดีเซ็น → ส่งอธิการบดี(รับทราบ) → completed
-- เมื่อใบขอยกเลิก completed → ตั้ง travel_requests.status='cancelled'.
--
-- routing dates ใช้ document_tracking ร่วม (document_type='travel_cancellation',
-- reference_id = travel_cancellation_requests.id) — ไม่ต้องเพิ่มคอลัมน์ใหม่.
-- โครงเลียนแบบ leave_cancellation_requests (20260601).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.travel_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status public.user_status NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_cancel_travel ON public.travel_cancellation_requests (travel_request_id);
CREATE INDEX IF NOT EXISTS idx_travel_cancel_status ON public.travel_cancellation_requests (status);

COMMENT ON TABLE public.travel_cancellation_requests IS
  'คำขอยกเลิกคำสั่งเดินทางที่เสร็จสิ้นแล้ว — เดินผ่าน workflow ลายเซ็น (ผอ./คณบดี/อธิการบดี).';

ALTER TABLE public.travel_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- เจ้าของคำขอเดินทาง หรือผู้ยื่นอ่านได้
CREATE POLICY "travel_cancellation: own read"
  ON public.travel_cancellation_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.travel_requests tr
      WHERE tr.id = travel_request_id AND tr.employee_id = (select auth.uid())
    )
  );

-- manager ขึ้นไป อ่านได้ทั้งหมด
CREATE POLICY "travel_cancellation: manager+ read all"
  ON public.travel_cancellation_requests FOR SELECT
  TO authenticated
  USING (public.is_manager_or_above());

-- เจ้าของคำขอเดินทางยื่นยกเลิกของตัวเองได้ · HR/Admin ยื่นแทนได้
CREATE POLICY "travel_cancellation: insert own or hr"
  ON public.travel_cancellation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_hr_or_admin()
    OR (
      requested_by = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.travel_requests tr
        WHERE tr.id = travel_request_id AND tr.employee_id = (select auth.uid())
      )
    )
  );

-- HR/Admin เดิน workflow (UPDATE ต้องมีทั้ง USING + WITH CHECK ตาม E1 checklist)
CREATE POLICY "travel_cancellation: hr/admin update"
  ON public.travel_cancellation_requests FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

-- ============================================================
-- Exam periods (ช่วงสอบปลายภาค)
-- ใช้แสดงคำเตือนเชิงข้อมูลบนฟอร์มขอเดินทาง/ลาพักผ่อน เมื่อวันที่ที่ขอ
-- คาบเกี่ยวช่วงสอบ และผู้ขอเป็นตำแหน่งที่มีภาระคุมสอบ (advisory เท่านั้น
-- ไม่บล็อกการส่งคำขอ และไม่กระทบ working-days/logic อนุมัติ)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exam_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.exam_periods IS 'ช่วงสอบปลายภาค — ใช้แจ้งเตือนภาระคุมสอบบนฟอร์มขอเดินทาง/ลาพักผ่อน';
COMMENT ON COLUMN public.exam_periods.fiscal_year IS 'ปีงบประมาณ (ค.ศ.) ที่ช่วงสอบนี้อยู่ เช่น 2026 = ปีงบฯ 2026';

ALTER TABLE public.exam_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_periods: authenticated read"
  ON public.exam_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "exam_periods: hr/admin insert"
  ON public.exam_periods FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "exam_periods: hr/admin update"
  ON public.exam_periods FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "exam_periods: hr/admin delete"
  ON public.exam_periods FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

CREATE INDEX IF NOT EXISTS idx_exam_periods_fiscal_year ON public.exam_periods (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_exam_periods_dates ON public.exam_periods (start_date, end_date);

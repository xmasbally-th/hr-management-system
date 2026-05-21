-- ============================================================
-- Leave System Enhancements
-- 1. holidays table (ปฏิทินวันหยุดราชการ)
-- 2. leave_types.code (SICK / PERSONAL / VACATION / MATERNITY)
-- 3. leave_requests.working_days (วันทำการที่คำนวณแล้ว)
-- 4. system_settings: leave online toggle
-- 5. system_settings: authenticated SELECT policy
-- ============================================================

-- ─── 1. Holidays table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  fiscal_year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(date)
);

COMMENT ON TABLE public.holidays IS 'ปฏิทินวันหยุดราชการ — ใช้สำหรับคำนวณวันทำการในระบบการลา';
COMMENT ON COLUMN public.holidays.fiscal_year IS 'ปีงบประมาณ (ค.ศ.) ที่วันหยุดนี้อยู่ เช่น 2026 = ปีงบฯ 2026 (1 ต.ค. 2025 – 30 ก.ย. 2026)';

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays: authenticated read"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "holidays: hr/admin insert"
  ON public.holidays FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "holidays: hr/admin update"
  ON public.holidays FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "holidays: hr/admin delete"
  ON public.holidays FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

-- Index for fiscal year queries
CREATE INDEX IF NOT EXISTS idx_holidays_fiscal_year ON public.holidays (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays (date);

-- ─── 2. leave_types.code ────────────────────────────────────

ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Add unique constraint only if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_code_key'
  ) THEN
    ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_code_key UNIQUE (code);
  END IF;
END $$;

COMMENT ON COLUMN public.leave_types.code IS 'รหัสอ้างอิง: SICK, PERSONAL, VACATION, MATERNITY — ใช้ใน business rules แทน regex match ชื่อ';

-- Seed codes for existing rows (idempotent — only updates NULL codes)
UPDATE public.leave_types SET code = 'SICK'      WHERE code IS NULL AND name ILIKE '%ป่วย%';
UPDATE public.leave_types SET code = 'PERSONAL'  WHERE code IS NULL AND name ILIKE '%กิจ%';
UPDATE public.leave_types SET code = 'VACATION'  WHERE code IS NULL AND name ILIKE '%พักผ่อน%';
UPDATE public.leave_types SET code = 'MATERNITY' WHERE code IS NULL AND name ILIKE '%คลอด%';

-- ─── 3. leave_requests.working_days ─────────────────────────

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS working_days INT;

COMMENT ON COLUMN public.leave_requests.working_days IS 'จำนวนวันทำการจริง (ตัดเสาร์-อาทิตย์ + วันหยุดราชการ) — snapshot ตอน submit';

-- ─── 4. System setting: leave online submission toggle ──────

INSERT INTO public.system_settings (key, value)
VALUES ('leave_online_submission_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── 5. Allow authenticated users to READ system_settings ───
-- (ปัจจุบัน admin-only ทั้ง read+write แต่ employee ต้องอ่าน toggle ได้)

CREATE POLICY "syssettings_authenticated_read"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

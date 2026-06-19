-- ============================================================
-- รองรับ "สรุปวันลารายปีงบประมาณ" ในโมดูลสรุปการมาปฏิบัติงานเดิม
-- ------------------------------------------------------------
-- ไฟล์ที่ HR มหาวิทยาลัยส่งมามี 2 แบบ:
--   * รายเดือน (period_type='monthly') — มี month + working_days
--   * รายปีงบประมาณ (period_type='annual') — มีช่วง start_date..end_date,
--     เซลล์เป็น "ครั้ง/วัน", มีลาช่วยเหลือภริยาคลอดบุตร + ขาดงาน
--
-- ทั้งสองใช้ตาราง attendance_periods/attendance_entries ร่วมกัน โดยแยกด้วย
-- period_type คอลัมน์ที่เป็น "รายปีเท่านั้น" จะปล่อยเป็น 0/NULL สำหรับรายเดือน
-- และกลับกัน
--
-- NOTE: ถ้าได้รัน 20260619 เวอร์ชันก่อนหน้าไปแล้ว (ที่ยังเป็น
-- late_online_count INT) ให้รันด้วย:
--   ALTER TABLE public.attendance_entries
--     RENAME COLUMN late_online_count TO late_online_days;
--   ALTER TABLE public.attendance_entries
--     ALTER COLUMN late_online_days TYPE NUMERIC(4,1);
-- (เวอร์ชันล่าสุดของ 20260619 ใช้ late_online_days NUMERIC อยู่แล้ว)
-- ============================================================

-- ------------------------------------------------------------
-- 1. attendance_periods — เพิ่มชนิดรอบ + รองรับช่วงรายปี
-- ------------------------------------------------------------
ALTER TABLE public.attendance_periods
  ADD COLUMN IF NOT EXISTS period_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- รายปีไม่มีเดือน/วันทำงานเดี่ยว → ผ่อนเป็น nullable (รายเดือนยังบังคับในชั้น app)
ALTER TABLE public.attendance_periods ALTER COLUMN month DROP NOT NULL;
ALTER TABLE public.attendance_periods ALTER COLUMN working_days DROP NOT NULL;

COMMENT ON COLUMN public.attendance_periods.period_type IS 'monthly=สรุปรายเดือน · annual=สรุปวันลารายปีงบประมาณ';
COMMENT ON COLUMN public.attendance_periods.start_date IS 'วันเริ่มช่วง (ใช้กับ annual เช่น 2568-10-01)';
COMMENT ON COLUMN public.attendance_periods.end_date IS 'วันสิ้นสุดช่วง (ใช้กับ annual เช่น 2569-03-31)';

-- เปลี่ยน uniqueness: รายเดือน 1 รอบ/เดือน, รายปี 1 รอบ/ปีงบฯ
ALTER TABLE public.attendance_periods
  DROP CONSTRAINT IF EXISTS attendance_periods_department_id_buddhist_year_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_periods_monthly
  ON public.attendance_periods (department_id, buddhist_year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_periods_annual
  ON public.attendance_periods (department_id, buddhist_year)
  WHERE period_type = 'annual';

-- ------------------------------------------------------------
-- 2. attendance_entries — คอลัมน์เฉพาะรายปี
-- ------------------------------------------------------------
ALTER TABLE public.attendance_entries
  -- จำนวน "ครั้ง" ของลาแต่ละประเภท (รายปีเก็บเป็น ครั้ง/วัน; "วัน" ใช้คอลัมน์เดิม)
  ADD COLUMN IF NOT EXISTS leave_sick_count       INT NOT NULL DEFAULT 0 CHECK (leave_sick_count >= 0),
  ADD COLUMN IF NOT EXISTS leave_personal_count   INT NOT NULL DEFAULT 0 CHECK (leave_personal_count >= 0),
  ADD COLUMN IF NOT EXISTS leave_vacation_count   INT NOT NULL DEFAULT 0 CHECK (leave_vacation_count >= 0),
  ADD COLUMN IF NOT EXISTS leave_maternity_count  INT NOT NULL DEFAULT 0 CHECK (leave_maternity_count >= 0),
  ADD COLUMN IF NOT EXISTS leave_ordination_count INT NOT NULL DEFAULT 0 CHECK (leave_ordination_count >= 0),
  -- ลาช่วยเหลือภริยาที่คลอดบุตร (ประเภทใหม่ มีเฉพาะไฟล์รายปี)
  ADD COLUMN IF NOT EXISTS leave_spouse_childbirth       NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_spouse_childbirth >= 0),
  ADD COLUMN IF NOT EXISTS leave_spouse_childbirth_count INT NOT NULL DEFAULT 0 CHECK (leave_spouse_childbirth_count >= 0),
  -- ขาดงาน (วัน) — มีเฉพาะไฟล์รายปี
  ADD COLUMN IF NOT EXISTS absent_days NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (absent_days >= 0);

COMMENT ON COLUMN public.attendance_entries.leave_spouse_childbirth IS 'ลาช่วยเหลือภริยาที่คลอดบุตร (วัน) — เฉพาะรายปี';
COMMENT ON COLUMN public.attendance_entries.leave_spouse_childbirth_count IS 'จำนวนครั้งลาช่วยเหลือภริยาที่คลอดบุตร — เฉพาะรายปี';
COMMENT ON COLUMN public.attendance_entries.absent_days IS 'ขาดงาน (วัน) — เฉพาะรายปี';
COMMENT ON COLUMN public.attendance_entries.leave_sick_count IS 'จำนวนครั้งลาป่วย — เฉพาะรายปี (วันใช้ leave_sick)';

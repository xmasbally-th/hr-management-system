-- ============================================================
-- สรุปการมาปฏิบัติงานรายเดือน (Monthly Attendance Summary)
-- ------------------------------------------------------------
-- เก็บข้อมูล "สรุปการมาปฏิบัติราชการของบุคลากร" ที่ HR ของมหาวิทยาลัย
-- ส่งมาเป็นไฟล์ PDF รายเดือน (1 แถว = บุคลากร 1 คน/เดือน) แยกต่างหาก
-- จากระบบใบลา (leave_requests) — เป็นยอดรวมรายเดือน ไม่ใช่รายคำขอ
--
-- ขอบเขตเริ่มต้น: คณะวิทยาการจัดการ (single faculty) แต่ schema เก็บ
-- department_id ไว้เพื่อขยายเป็นหลายคณะได้ภายหลังโดยไม่ต้องแก้โครงสร้าง
--
-- สิทธิ์ (RLS):
--   * HR/Admin  : จัดการเต็ม (สร้าง/แก้/ลบ/publish)
--   * Manager   : อ่านได้ทั้งหมด
--   * Employee  : อ่านได้เฉพาะแถวของตนเอง และเฉพาะรอบที่ published แล้ว
-- ============================================================

-- ------------------------------------------------------------
-- 1. attendance_periods — รอบเดือน (1 แถว = 1 คณะ/เดือน/ปี)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  -- ปี พ.ศ. ตามที่ระบุบนเอกสาร เช่น 2569 (เก็บตามต้นฉบับ ไม่แปลงเป็น ค.ศ.)
  buddhist_year INT NOT NULL CHECK (buddhist_year BETWEEN 2500 AND 2700),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- จำนวนวันทำงานของเดือน (คอลัมน์ "รวม" บนฟอร์ม เช่น 20) ใช้ตรวจยอด
  working_days NUMERIC(4,1) NOT NULL CHECK (working_days >= 0 AND working_days <= 31),
  title TEXT CHECK (title IS NULL OR char_length(title) <= 200),
  -- path ไฟล์ PDF ต้นฉบับใน Storage (เก็บไว้เป็นหลักฐาน — โฟกัสหน้า 2)
  source_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1 คณะ มีได้รอบเดียวต่อเดือน/ปี
  UNIQUE (department_id, buddhist_year, month)
);

COMMENT ON TABLE public.attendance_periods IS 'รอบสรุปการมาปฏิบัติงานรายเดือน (1 แถว = คณะ/เดือน/ปี) — ข้อมูลจากไฟล์ PDF ที่ HR มหาวิทยาลัยส่งมา';
COMMENT ON COLUMN public.attendance_periods.buddhist_year IS 'ปี พ.ศ. ตามต้นฉบับ เช่น 2569';
COMMENT ON COLUMN public.attendance_periods.working_days IS 'จำนวนวันทำงานของเดือน (คอลัมน์ "รวม" บนฟอร์ม) ใช้ตรวจยอดรวมของแต่ละแถว';
COMMENT ON COLUMN public.attendance_periods.source_file_url IS 'path ไฟล์ PDF ต้นฉบับใน Storage (หน้า 2 = ตารางข้อมูล)';
COMMENT ON COLUMN public.attendance_periods.status IS 'draft = HR กำลังกรอก/ตรวจ · published = เผยแพร่ให้พนักงาน/ผู้บริหารเห็น';

-- ------------------------------------------------------------
-- 2. attendance_entries — ข้อมูลรายคน/เดือน
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.attendance_periods(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- ชื่อตามที่ปรากฏในไฟล์ PDF (เก็บไว้ตรวจสอบการจับคู่กับ profiles)
  raw_name TEXT,
  -- สายงานตามหัวข้อในไฟล์: academic=สายวิชาการ, support=สายสนับสนุน, contract=ลูกจ้าง
  staff_line TEXT CHECK (staff_line IN ('academic', 'support', 'contract')),
  -- ลำดับแถวในไฟล์ (รักษาลำดับเดิมเพื่อแสดงผล/อ้างอิง)
  row_order INT,

  -- คอลัมน์วัน (NUMERIC เผื่อกรณีครึ่งวัน)
  work_days        NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (work_days >= 0),
  travel_days      NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (travel_days >= 0),
  leave_vacation   NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_vacation >= 0),
  leave_personal   NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_personal >= 0),
  leave_sick       NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_sick >= 0),
  leave_study      NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_study >= 0),
  leave_maternity  NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_maternity >= 0),
  leave_ordination NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (leave_ordination >= 0),
  total_days       NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (total_days >= 0),

  -- คอลัมน์วินัยการลงเวลา (แยกจากยอดวัน ไม่นำมารวมใน total_days)
  -- ลงเวลาสายนับเป็น "วัน" (สอดคล้องทั้งรายเดือน/รายปี); ไม่ลงเวลาออกนับเป็น "ครั้ง"
  late_online_days       NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (late_online_days >= 0),
  missing_checkout_count INT NOT NULL DEFAULT 0 CHECK (missing_checkout_count >= 0),

  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 1 คน มีได้แถวเดียวต่อรอบ
  UNIQUE (period_id, profile_id)
);

COMMENT ON TABLE public.attendance_entries IS 'ข้อมูลสรุปการมาปฏิบัติงานรายคน/เดือน (1 แถวต่อบุคลากรต่อรอบ)';
COMMENT ON COLUMN public.attendance_entries.raw_name IS 'ชื่อตามที่ปรากฏในไฟล์ PDF — ใช้ตรวจสอบความถูกต้องของการจับคู่กับ profiles';
COMMENT ON COLUMN public.attendance_entries.staff_line IS 'academic=สายวิชาการ, support=สายสนับสนุน, contract=ลูกจ้าง';
COMMENT ON COLUMN public.attendance_entries.total_days IS 'คอลัมน์ "รวม" จากไฟล์ = work+travel+ลาทุกประเภท (late/missing ไม่นับรวม) — ตรวจยอดในชั้น app';
COMMENT ON COLUMN public.attendance_entries.late_online_days IS 'จำนวนวันลงเวลาออนไลน์สาย (เกิน 8.30 น.)';
COMMENT ON COLUMN public.attendance_entries.missing_checkout_count IS 'จำนวนครั้งไม่ลงเวลาออกงาน';

-- ------------------------------------------------------------
-- 3. updated_at triggers (ใช้ฟังก์ชัน set_updated_at() เดิมของโปรเจกต์)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_attendance_periods_updated_at ON public.attendance_periods;
CREATE TRIGGER trg_attendance_periods_updated_at
  BEFORE UPDATE ON public.attendance_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_entries_updated_at ON public.attendance_entries;
CREATE TRIGGER trg_attendance_entries_updated_at
  BEFORE UPDATE ON public.attendance_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_periods_status
  ON public.attendance_periods (status);
CREATE INDEX IF NOT EXISTS idx_attendance_periods_dept_period
  ON public.attendance_periods (department_id, buddhist_year, month);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_period
  ON public.attendance_entries (period_id);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_profile
  ON public.attendance_entries (profile_id);

-- ------------------------------------------------------------
-- 5. RLS — attendance_periods
-- ------------------------------------------------------------
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;

-- อ่าน: manager+ เห็นทุกรอบ (รวม draft) · พนักงานทั่วไปเห็นเฉพาะรอบที่ published
CREATE POLICY "attendance_periods: read"
  ON public.attendance_periods FOR SELECT
  TO authenticated
  USING (public.is_manager_or_above() OR status = 'published');

CREATE POLICY "attendance_periods: hr/admin insert"
  ON public.attendance_periods FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "attendance_periods: hr/admin update"
  ON public.attendance_periods FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "attendance_periods: hr/admin delete"
  ON public.attendance_periods FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

-- ------------------------------------------------------------
-- 6. RLS — attendance_entries
-- ------------------------------------------------------------
ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;

-- อ่าน: manager+ เห็นทุกแถว · พนักงานเห็นเฉพาะแถวตนเองในรอบที่ published แล้ว
CREATE POLICY "attendance_entries: read"
  ON public.attendance_entries FOR SELECT
  TO authenticated
  USING (
    public.is_manager_or_above()
    OR (
      profile_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.attendance_periods p
        WHERE p.id = attendance_entries.period_id
          AND p.status = 'published'
      )
    )
  );

CREATE POLICY "attendance_entries: hr/admin insert"
  ON public.attendance_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "attendance_entries: hr/admin update"
  ON public.attendance_entries FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

CREATE POLICY "attendance_entries: hr/admin delete"
  ON public.attendance_entries FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

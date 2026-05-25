-- ============================================================
-- M3: data-driven vacation accumulation cap on employee_types
--
-- The hardcoded switch in getVacationAccumulationCap() silently returned
-- cap=0 for any name that didn't EXACTLY match one of three strings,
-- so real data like "พนักงานมหาวิทยาลัย(สายสนับสนุน)" lost its accumulation.
-- Make the cap a column HR can edit and seed sensible defaults that match
-- by Thai-government category (prefix-based for พนักงานมหาวิทยาลัย so the
-- "(สายสนับสนุน)" / "(สายวิชาการ)" variants are covered).
-- ============================================================

ALTER TABLE public.employee_types
  ADD COLUMN IF NOT EXISTS vacation_accumulation_cap INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employee_types.vacation_accumulation_cap IS
  'เพดานวันลาพักผ่อนสะสมที่ยกข้ามปีได้ (วัน) — ข้าราชการ 30, พนง.มหาวิทยาลัย 20, พนง.ราชการ 15, อื่น ๆ 0';

-- Seed defaults for known categories (idempotent — only fills rows still at 0)
UPDATE public.employee_types
SET vacation_accumulation_cap = 30
WHERE vacation_accumulation_cap = 0 AND name = 'ข้าราชการ';

UPDATE public.employee_types
SET vacation_accumulation_cap = 20
WHERE vacation_accumulation_cap = 0 AND name LIKE 'พนักงานมหาวิทยาลัย%';

UPDATE public.employee_types
SET vacation_accumulation_cap = 15
WHERE vacation_accumulation_cap = 0 AND name = 'พนักงานราชการ';

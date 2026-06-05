-- ============================================================
-- Holidays: category (type) + note
-- เพิ่มหมวดวันหยุด 3 ประเภท และช่องหมายเหตุ ให้แท็บ "วันหยุดราชการ"
--   type: general (ทั่วไป) | own_closure (รร.หยุดเอง) | special (พิเศษ)
--   note: หมายเหตุ (optional)
-- ทุกหมวดยังคงหักวันทำการในระบบการลา (working-days.ts ไม่เปลี่ยน)
-- ============================================================

ALTER TABLE public.holidays
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general'
    CHECK (type IN ('general', 'own_closure', 'special')),
  ADD COLUMN IF NOT EXISTS note TEXT
    CHECK (note IS NULL OR char_length(note) <= 500);

COMMENT ON COLUMN public.holidays.type IS 'หมวดวันหยุด: general=ทั่วไป, own_closure=รร.หยุดเอง, special=พิเศษ';
COMMENT ON COLUMN public.holidays.note IS 'หมายเหตุ (optional, ≤ 500 ตัวอักษร)';

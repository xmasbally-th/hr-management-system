-- ============================================================
-- document_templates — เทมเพลต .docx ที่ Admin อัปโหลด (mail-merge)
--
-- HR/Admin อัปโหลดแบบฟอร์มใบลา .docx ต้นฉบับ → ระบบเติมข้อมูลตอนดาวน์โหลด
-- (W3). เก็บไฟล์ใน private storage bucket 'templates' (เข้าถึงผ่าน
-- service-role เท่านั้น). ตารางนี้เป็น registry ของเทมเพลต.
-- จัดการได้เฉพาะ Admin (ตาม CLAUDE.md: Admin manages document templates).
-- ============================================================

-- private bucket สำหรับเทมเพลต (อ่าน/เขียนผ่าน service-role ใน server เท่านั้น)
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL DEFAULT 'leave',            -- 'leave' (อนาคต: travel ฯลฯ)
  leave_type_code TEXT,                              -- SICK/PERSONAL/VACATION/MATERNITY · NULL = ทั่วไป (fallback)
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  storage_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_lookup
  ON public.document_templates (doc_type, leave_type_code, is_active);

COMMENT ON TABLE public.document_templates IS 'Registry ของเทมเพลต .docx (mail-merge) — จัดการโดย Admin';
COMMENT ON COLUMN public.document_templates.leave_type_code IS 'SICK/PERSONAL/VACATION/MATERNITY · NULL = เทมเพลตทั่วไป (fallback)';

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- authenticated อ่าน metadata ได้ (HR เห็นรายการเทมเพลตในหน้าจัดการ/ดาวน์โหลด)
CREATE POLICY "document_templates: authenticated read"
  ON public.document_templates FOR SELECT
  TO authenticated
  USING (true);

-- จัดการได้เฉพาะ Admin (UPDATE มีทั้ง USING + WITH CHECK ตาม checklist)
CREATE POLICY "document_templates: admin insert"
  ON public.document_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "document_templates: admin update"
  ON public.document_templates FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "document_templates: admin delete"
  ON public.document_templates FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin');

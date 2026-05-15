-- Master catalogs (Phase S3)
--
-- Replaces hardcoded dropdown lists in the profile editor with DB-driven
-- catalogs that HR can curate from /dashboard/hr/master-data:
--   * employee_types     — ประเภทบุคลากร
--   * education_levels   — วุฒิการศึกษา
--   * decoration_catalog — เครื่องราชอิสริยาภรณ์ (dictionary for autocomplete)
--
-- Each table has the same shape: id + name (unique) + sort_order + timestamps.
-- decoration_catalog also tracks the standard Thai abbreviation.
--
-- Must be run in Supabase SQL Editor before deploying S3 code.

-- =============================================================================
-- 1. employee_types
-- =============================================================================
CREATE TABLE IF NOT EXISTS employee_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 2. education_levels
-- =============================================================================
CREATE TABLE IF NOT EXISTS education_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 3. decoration_catalog  (separate from profile_decorations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS decoration_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT,                 -- ป.ม. · ท.ช. · ฯลฯ
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 4. updated_at triggers
-- =============================================================================
-- Re-create the helper function locally (idempotent) so this migration is
-- self-contained — earlier 20260514 already defined it, but Supabase SQL
-- Editor sessions may run with a search_path that doesn't see the prior
-- run's function in the public schema.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_types_updated_at ON employee_types;
CREATE TRIGGER trg_employee_types_updated_at
  BEFORE UPDATE ON employee_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_education_levels_updated_at ON education_levels;
CREATE TRIGGER trg_education_levels_updated_at
  BEFORE UPDATE ON education_levels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_decoration_catalog_updated_at ON decoration_catalog;
CREATE TRIGGER trg_decoration_catalog_updated_at
  BEFORE UPDATE ON decoration_catalog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 5. RLS — any authenticated user can read; HR/Admin can write
-- =============================================================================
ALTER TABLE employee_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_levels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE decoration_catalog ENABLE ROW LEVEL SECURITY;

-- Helper macro pattern — applied per table below

DROP POLICY IF EXISTS "emptype_select_authenticated" ON employee_types;
DROP POLICY IF EXISTS "emptype_write_hr_admin"       ON employee_types;
CREATE POLICY "emptype_select_authenticated" ON employee_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "emptype_write_hr_admin" ON employee_types
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')));

DROP POLICY IF EXISTS "edulvl_select_authenticated" ON education_levels;
DROP POLICY IF EXISTS "edulvl_write_hr_admin"       ON education_levels;
CREATE POLICY "edulvl_select_authenticated" ON education_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "edulvl_write_hr_admin" ON education_levels
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')));

DROP POLICY IF EXISTS "deccat_select_authenticated" ON decoration_catalog;
DROP POLICY IF EXISTS "deccat_write_hr_admin"       ON decoration_catalog;
CREATE POLICY "deccat_select_authenticated" ON decoration_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deccat_write_hr_admin" ON decoration_catalog
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')));

-- =============================================================================
-- 6. Seed common values (idempotent via ON CONFLICT)
-- =============================================================================
INSERT INTO employee_types (name, sort_order) VALUES
  ('ข้าราชการ',              10),
  ('พนักงานมหาวิทยาลัย',     20),
  ('พนักงานราชการ',          30),
  ('พนักงานชั่วคราว',         40),
  ('ลูกจ้างประจำ',            50),
  ('อื่น ๆ',                   99)
ON CONFLICT (name) DO NOTHING;

INSERT INTO education_levels (name, sort_order) VALUES
  ('ประกาศนียบัตรวิชาชีพ (ปวช.)',                10),
  ('ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)',           20),
  ('ปริญญาตรี',                                   30),
  ('ปริญญาโท',                                    40),
  ('ปริญญาเอก',                                   50),
  ('อื่น ๆ',                                       99)
ON CONFLICT (name) DO NOTHING;

INSERT INTO decoration_catalog (name, abbreviation, sort_order) VALUES
  ('เบญจมาภรณ์มงกุฎไทย',         'บ.ม.',  10),
  ('เบญจมาภรณ์ช้างเผือก',        'บ.ช.',  20),
  ('จัตุรถาภรณ์มงกุฎไทย',        'จ.ม.',  30),
  ('จัตุรถาภรณ์ช้างเผือก',       'จ.ช.',  40),
  ('ตริตาภรณ์มงกุฎไทย',          'ต.ม.',  50),
  ('ตริตาภรณ์ช้างเผือก',         'ต.ช.',  60),
  ('ทวีติยาภรณ์มงกุฎไทย',        'ท.ม.',  70),
  ('ทวีติยาภรณ์ช้างเผือก',       'ท.ช.',  80),
  ('ประถมาภรณ์มงกุฎไทย',         'ป.ม.',  90),
  ('ประถมาภรณ์ช้างเผือก',        'ป.ช.', 100),
  ('มหาวชิรมงกุฎ',                'ม.ว.ม.', 110),
  ('มหาปรมาภรณ์ช้างเผือก',       'ม.ป.ช.', 120),
  ('เหรียญจักรพรรดิมาลา',         'ร.จ.พ.', 200)
ON CONFLICT (name) DO NOTHING;

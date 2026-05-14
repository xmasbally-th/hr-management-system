-- Faculty-grade profile extensions
-- Adds:
--   1. profiles.education_level (วุฒิการศึกษาปัจจุบัน)
--   2. profiles.profile_completed_at (first-login confirmation marker)
--   3. profile_educations         (ประวัติการศึกษา — multi-row)
--   4. profile_decorations        (เครื่องราชอิสริยาภรณ์ — multi-row)
--   5. profile_admin_positions    (ประวัติการบริหาร — multi-row)
--
-- Must be run in Supabase SQL Editor before deploying Phase M1+ code.

-- =============================================================================
-- 1. New profiles columns
-- =============================================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Case-insensitive uniqueness on email — required for first-login email linking.
-- Use a partial expression index so any duplicate (case-insensitive) is rejected.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uniq
  ON profiles ((lower(email)));

-- =============================================================================
-- 2. profile_educations — multi-row education history
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_educations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_year INT,
  graduation_year INT,
  institution TEXT NOT NULL,
  country TEXT,
  degree TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_educations_profile_id
  ON profile_educations(profile_id);

-- =============================================================================
-- 3. profile_decorations — royal decorations history
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_decorations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decoration_name TEXT NOT NULL,         -- เครื่องราชอิสริยาภรณ์
  abbreviation TEXT,                     -- ชื่อย่อ (ป.ม., ท.ช., ฯลฯ)
  document_reference TEXT,               -- เอกสารอ้างอิง (เลขที่ราชกิจจาฯ)
  approved_date DATE,                    -- อนุมัติเมื่อ
  position_at_grant TEXT,                -- ตำแหน่งราชการ ณ ขณะรับ
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_decorations_profile_id
  ON profile_decorations(profile_id);

-- =============================================================================
-- 4. profile_admin_positions — administrative positions history
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_admin_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_order_number TEXT,         -- เลขที่คำสั่งแต่งตั้ง
  position_title TEXT NOT NULL,          -- ตำแหน่ง
  responsible_unit TEXT,                 -- หน่วยงานที่รับผิดชอบ
  start_date DATE NOT NULL,
  end_date DATE,                         -- NULL = ปัจจุบัน
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_admin_positions_profile_id
  ON profile_admin_positions(profile_id);

-- =============================================================================
-- 5. updated_at triggers (idempotent)
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_educations_updated_at ON profile_educations;
CREATE TRIGGER trg_profile_educations_updated_at
  BEFORE UPDATE ON profile_educations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profile_decorations_updated_at ON profile_decorations;
CREATE TRIGGER trg_profile_decorations_updated_at
  BEFORE UPDATE ON profile_decorations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profile_admin_positions_updated_at ON profile_admin_positions;
CREATE TRIGGER trg_profile_admin_positions_updated_at
  BEFORE UPDATE ON profile_admin_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 6. RLS — own-row read/write + HR/Admin can read/write all
-- =============================================================================
ALTER TABLE profile_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_admin_positions ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller HR/Admin (read+write) or Manager (read only)?
-- Inlined to avoid creating a function (keeps the migration self-contained).

-- ─── profile_educations ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "educations_own_or_hr_select" ON profile_educations;
DROP POLICY IF EXISTS "educations_own_or_hr_insert" ON profile_educations;
DROP POLICY IF EXISTS "educations_own_or_hr_update" ON profile_educations;
DROP POLICY IF EXISTS "educations_own_or_hr_delete" ON profile_educations;

CREATE POLICY "educations_own_or_hr_select" ON profile_educations
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin','manager'))
  );
CREATE POLICY "educations_own_or_hr_insert" ON profile_educations
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "educations_own_or_hr_update" ON profile_educations
  FOR UPDATE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "educations_own_or_hr_delete" ON profile_educations
  FOR DELETE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );

-- ─── profile_decorations ────────────────────────────────────────────────
DROP POLICY IF EXISTS "decorations_own_or_hr_select" ON profile_decorations;
DROP POLICY IF EXISTS "decorations_own_or_hr_insert" ON profile_decorations;
DROP POLICY IF EXISTS "decorations_own_or_hr_update" ON profile_decorations;
DROP POLICY IF EXISTS "decorations_own_or_hr_delete" ON profile_decorations;

CREATE POLICY "decorations_own_or_hr_select" ON profile_decorations
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin','manager'))
  );
CREATE POLICY "decorations_own_or_hr_insert" ON profile_decorations
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "decorations_own_or_hr_update" ON profile_decorations
  FOR UPDATE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "decorations_own_or_hr_delete" ON profile_decorations
  FOR DELETE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );

-- ─── profile_admin_positions ────────────────────────────────────────────
DROP POLICY IF EXISTS "adminpos_own_or_hr_select" ON profile_admin_positions;
DROP POLICY IF EXISTS "adminpos_own_or_hr_insert" ON profile_admin_positions;
DROP POLICY IF EXISTS "adminpos_own_or_hr_update" ON profile_admin_positions;
DROP POLICY IF EXISTS "adminpos_own_or_hr_delete" ON profile_admin_positions;

CREATE POLICY "adminpos_own_or_hr_select" ON profile_admin_positions
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin','manager'))
  );
CREATE POLICY "adminpos_own_or_hr_insert" ON profile_admin_positions
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "adminpos_own_or_hr_update" ON profile_admin_positions
  FOR UPDATE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );
CREATE POLICY "adminpos_own_or_hr_delete" ON profile_admin_positions
  FOR DELETE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin'))
  );

-- =============================================================================
-- 7. Storage bucket for avatars (separate from documents)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- public-readable so signed URLs aren't required for display
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- Authenticated users may upload their own avatar (path = {auth.uid()}/...)
CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- =============================================================================
-- Notes
-- =============================================================================
-- * After running this migration, regenerate or hand-update types/supabase.ts.
-- * Application enforces avatar = 500×500 via client-side canvas resize.
-- * profile_completed_at = NULL → user must complete /dashboard/welcome
--   (enforced via proxy.ts middleware in Phase M3).

-- Whitelist-First Onboarding (Phase P-Onboard, Step 1)
--
-- เปลี่ยนระบบ onboarding ให้ HR กรอกข้อมูลล่วงหน้า → user login เพื่อยืนยัน
-- → ถ้าข้อมูลผิด ส่ง correction request ให้ HR แก้
--
-- รายละเอียดสถานะใหม่:
--   pre_registered         — HR import แล้ว ยังไม่เคย login
--   awaiting_confirmation  — login แล้ว ต้องกดยืนยันที่ /welcome
--   awaiting_correction    — ส่ง correction request แล้ว รอ HR แก้
--   approved               — ใช้งานได้ปกติ (เดิม)
--   rejected               — ปิดบัญชี (เดิม)
--   pending                — (legacy) ค่อย ๆ phase out — ยังคงไว้กัน FK พัง

-- ─────────────────────────────────────────────────────────────────
-- 1. ขยายค่าที่อนุญาตของ profiles.status
-- ─────────────────────────────────────────────────────────────────
-- ตรวจชนิดของ column ก่อน:
--   - ถ้าเป็น ENUM (USER-DEFINED) → ALTER TYPE ... ADD VALUE
--   - ถ้าเป็น TEXT + CHECK constraint → drop/recreate constraint
--   - ถ้าเป็น TEXT เปล่า ๆ → ไม่ต้องทำอะไร (จะ insert ค่าใหม่ได้เลย)
--
-- ทำเป็น DO block เพื่อให้ทำงานได้ทุกกรณี (idempotent)

DO $$
DECLARE
  col_udt_name TEXT;
  col_data_type TEXT;
BEGIN
  SELECT data_type, udt_name
    INTO col_data_type, col_udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'status';

  IF col_data_type = 'USER-DEFINED' THEN
    -- ENUM case — ใช้ udt_name (ชื่อจริงของ type) ในการ ALTER
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_udt_name, 'pre_registered'
    );
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_udt_name, 'awaiting_confirmation'
    );
    EXECUTE format(
      'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_udt_name, 'awaiting_correction'
    );
    RAISE NOTICE 'Extended enum % with 3 new values', col_udt_name;
  ELSIF col_data_type = 'text' THEN
    -- TEXT case — ตรวจว่ามี CHECK constraint จำกัดค่าหรือไม่
    -- ถ้ามีจะมี name pattern เช่น profiles_status_check
    -- ลบทุก check constraint ที่ involve column status แล้วใส่ใหม่ให้ครอบคลุม
    -- (ทำแบบ defensive — ถ้าไม่มีก็ผ่าน)
    BEGIN
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
      CHECK (status IN (
        'pending','approved','rejected',
        'pre_registered','awaiting_confirmation','awaiting_correction'
      ));
    RAISE NOTICE 'Updated CHECK constraint on profiles.status (text column)';
  ELSE
    RAISE NOTICE 'Unexpected column type % — no action taken', col_data_type;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. ตาราง profile_correction_requests
-- ─────────────────────────────────────────────────────────────────
-- เก็บคำขอแก้ไขโปรไฟล์จาก user ทั้ง 2 รูปแบบ:
--   scope='first_review'   — ก่อน confirm ครั้งแรก: ไม่มี payload แค่ message
--   scope='post_approval'  — หลัง approved แล้ว: มี proposed_payload เต็มรูปแบบ

CREATE TABLE IF NOT EXISTS profile_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason_text    TEXT NOT NULL,
  fields_flagged JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- สำหรับ post_approval: เก็บ payload ที่ user เสนอ (เช่น { phone: "...", address: "..." })
  proposed_payload JSONB,
  scope TEXT NOT NULL CHECK (scope IN ('first_review','post_approval')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','resolved','rejected','cancelled')),
  resolver_note TEXT,
  resolved_by   UUID REFERENCES profiles(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pcr_target_user
  ON profile_correction_requests(target_user_id);

CREATE INDEX IF NOT EXISTS idx_pcr_pending
  ON profile_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pcr_scope_status
  ON profile_correction_requests(scope, status);

-- ─────────────────────────────────────────────────────────────────
-- 3. RLS policies
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE profile_correction_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: เจ้าของดูของตัวเอง · HR/Admin ดูทั้งหมด
DROP POLICY IF EXISTS "pcr_select" ON profile_correction_requests;
CREATE POLICY "pcr_select" ON profile_correction_requests
  FOR SELECT TO authenticated
  USING (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('hr','admin')
    )
  );

-- INSERT: เจ้าของส่งของตัวเองเท่านั้น
DROP POLICY IF EXISTS "pcr_insert" ON profile_correction_requests;
CREATE POLICY "pcr_insert" ON profile_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND target_user_id = auth.uid()
  );

-- UPDATE: HR/Admin (resolve/reject) หรือเจ้าของ (cancel ของตัวเองตอน pending)
DROP POLICY IF EXISTS "pcr_update" ON profile_correction_requests;
CREATE POLICY "pcr_update" ON profile_correction_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('hr','admin')
    )
    OR (target_user_id = auth.uid() AND status = 'pending')
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. Updated-at trigger (re-use ของเดิมถ้ามี)
-- ─────────────────────────────────────────────────────────────────
-- ไม่ทำ updated_at ใน table นี้เพราะใช้ resolved_at + created_at ก็พอ
-- (lifecycle ของคำขอจบที่ resolved/rejected/cancelled — ไม่มี edit)

-- ─────────────────────────────────────────────────────────────────
-- Sanity check (uncomment เพื่อ verify หลังรัน)
-- ─────────────────────────────────────────────────────────────────
-- SELECT unnest(enum_range(NULL::profile_status));
-- SELECT * FROM profile_correction_requests LIMIT 1;

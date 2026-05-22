-- ============================================================
-- Leave Signature Workflow (Phase C+ / W1)
--
-- 1. document_tracking: 2-level signature columns (ผอ. → คณบดี)
--    + scanned_document_url + rejection fields
-- 2. user_status enum: add awaiting_director / awaiting_dean / completed
--
-- NOTES
-- • document_tracking is SHARED by leave_requests AND travel_requests.
--   All new columns are NULLABLE → existing travel rows are unaffected.
-- • `user_status` is a NATIVE enum SHARED by profiles, leave_requests, AND
--   travel_requests. New values become valid DB-wide, but TS types restrict
--   profile statuses separately so app code never assigns a workflow stage
--   to a profile. Travel adopts the same workflow later (Phase D5). Adding
--   values does not affect existing rows.
-- • Existing date columns are KEPT (no rename): `sent_for_signature_date`,
--   `returned_date`, `scanned_upload_date`, `sent_to_agency_date`
--   (= ส่ง HR มหาวิทยาลัย). Travel keeps using these as-is.
--
-- REVIEW BEFORE RUNNING. After applying, regenerate types/supabase.ts.
-- ============================================================

-- ─── 1. document_tracking: 2-level signature + scan + reject ─

ALTER TABLE public.document_tracking
  ADD COLUMN IF NOT EXISTS sent_to_director_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS director_signed_date    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_dean_date        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dean_signed_date         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_document_url     TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reject_reason            TEXT,
  ADD COLUMN IF NOT EXISTS reject_level             TEXT;

-- Constrain reject_level to the known stages (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_tracking_reject_level_check'
  ) THEN
    ALTER TABLE public.document_tracking
      ADD CONSTRAINT document_tracking_reject_level_check
      CHECK (reject_level IS NULL OR reject_level IN ('hr', 'director', 'dean'));
  END IF;
END $$;

COMMENT ON COLUMN public.document_tracking.sent_to_director_date IS 'วันที่ส่งให้ผู้อำนวยการเซ็น';
COMMENT ON COLUMN public.document_tracking.director_signed_date  IS 'วันที่ผู้อำนวยการเซ็นแล้ว';
COMMENT ON COLUMN public.document_tracking.sent_to_dean_date     IS 'วันที่ส่งให้คณบดีเซ็น';
COMMENT ON COLUMN public.document_tracking.dean_signed_date      IS 'วันที่คณบดีเซ็นแล้ว (= อนุมัติ)';
COMMENT ON COLUMN public.document_tracking.scanned_document_url  IS 'path ไฟล์สแกนใบลาที่เซ็นแล้ว (Supabase Storage)';
COMMENT ON COLUMN public.document_tracking.reject_level          IS 'ขั้นที่ปฏิเสธ: hr / director / dean';

-- Helpful index for per-reference lookups (timeline / employee tracking)
CREATE INDEX IF NOT EXISTS idx_document_tracking_reference
  ON public.document_tracking (reference_id);

-- ─── 2. user_status enum: add workflow stages ───────────────
-- NOTE: leave_requests.status, travel_requests.status, AND profiles.status
-- all share the `user_status` enum. Adding these values makes them valid
-- DB-wide, but the TS types restrict profile statuses separately, so app
-- code never assigns workflow stages to a profile.
-- ADD VALUE IF NOT EXISTS is idempotent. PG12+ permits ADD VALUE inside a
-- transaction as long as the value is not USED in the same transaction
-- (this migration only adds, never uses).

ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'awaiting_director';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'awaiting_dean';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'completed';

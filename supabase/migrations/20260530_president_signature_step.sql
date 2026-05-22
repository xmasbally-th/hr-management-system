-- ============================================================
-- Optional 3rd signature level: อธิการบดี (President)
--
-- HR request: after the Dean signs (status=approved), optionally route the
-- leave document to the President for signature, then store the signed
-- document returned from the President.
--
-- Modeled as document_tracking columns (NOT a leave_requests.status):
-- the step is OPTIONAL and POST-approval (approval/quota stays at the Dean,
-- reserve-on-submit). Flow: คณบดี(approved) → [optional ส่งอธิการบดี →
-- อธิการบดีเซ็น + เก็บเอกสาร] → ส่งมหาวิทยาลัย(completed).
--
-- All columns NULLABLE → existing rows + travel unaffected.
-- ============================================================

ALTER TABLE public.document_tracking
  ADD COLUMN IF NOT EXISTS sent_to_president_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS president_signed_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS president_document_url TEXT;

COMMENT ON COLUMN public.document_tracking.sent_to_president_date IS 'วันที่ส่งให้อธิการบดีเซ็น (ขั้นเสริม หลังคณบดี)';
COMMENT ON COLUMN public.document_tracking.president_signed_date  IS 'วันที่อธิการบดีเซ็นแล้ว';
COMMENT ON COLUMN public.document_tracking.president_document_url IS 'path เอกสารที่อธิการบดีเซ็นกลับมา (Supabase Storage)';

-- Allow 'president' as a rejection level
ALTER TABLE public.document_tracking
  DROP CONSTRAINT IF EXISTS document_tracking_reject_level_check;

ALTER TABLE public.document_tracking
  ADD CONSTRAINT document_tracking_reject_level_check
  CHECK (reject_level IS NULL OR reject_level IN ('hr', 'director', 'dean', 'president'));

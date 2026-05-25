-- ============================================================
-- Soft-delete for document_tracking (W9)
--
-- Replaces the hard DELETE in deleteDocumentTracking with an UPDATE that
-- stamps deleted_at, plus an audit log entry. Read queries filter
-- deleted_at IS NULL so soft-deleted rows are invisible.
-- ============================================================

ALTER TABLE public.document_tracking
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_document_tracking_not_deleted
  ON public.document_tracking (deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.document_tracking.deleted_at IS 'soft-delete timestamp — NULL = active row';

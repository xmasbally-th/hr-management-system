-- ============================================================
-- E3: cleanup document_tracking when the underlying request row
-- is deleted (defense in depth).
--
-- `document_tracking.reference_id` is polymorphic — it points to
-- either leave_requests / travel_requests / leave_cancellation_requests
-- depending on `document_type`. Because the reference can't be a
-- foreign key, deleting the parent row would leave the tracking
-- row orphaned. The app never hard-deletes these rows today, but
-- this trigger guards against future code paths and direct SQL.
--
-- Behaviour: soft-delete the tracking row by setting
-- `deleted_at = now()` (matches the W9 soft-delete convention).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_document_tracking_on_request_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  doc_types TEXT[];
BEGIN
  -- Map the deleted parent table to the relevant document_type values
  IF TG_TABLE_NAME = 'leave_requests' THEN
    doc_types := ARRAY['leave', 'leave_request'];
  ELSIF TG_TABLE_NAME = 'travel_requests' THEN
    doc_types := ARRAY['travel', 'travel_request'];
  ELSIF TG_TABLE_NAME = 'leave_cancellation_requests' THEN
    doc_types := ARRAY['leave_cancellation'];
  ELSE
    RETURN OLD;
  END IF;

  UPDATE public.document_tracking
  SET deleted_at = now()
  WHERE reference_id = OLD.id
    AND document_type = ANY (doc_types)
    AND deleted_at IS NULL;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_tracking_on_leave_delete ON public.leave_requests;
CREATE TRIGGER cleanup_tracking_on_leave_delete
  AFTER DELETE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_document_tracking_on_request_delete();

DROP TRIGGER IF EXISTS cleanup_tracking_on_travel_delete ON public.travel_requests;
CREATE TRIGGER cleanup_tracking_on_travel_delete
  AFTER DELETE ON public.travel_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_document_tracking_on_request_delete();

DROP TRIGGER IF EXISTS cleanup_tracking_on_cancel_delete ON public.leave_cancellation_requests;
CREATE TRIGGER cleanup_tracking_on_cancel_delete
  AFTER DELETE ON public.leave_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_document_tracking_on_request_delete();

COMMENT ON FUNCTION public.cleanup_document_tracking_on_request_delete IS
  'E3: soft-deletes document_tracking rows whose parent request was hard-deleted. SECURITY INVOKER + locked search_path to avoid the SECURITY DEFINER pitfalls in CLAUDE.md.';

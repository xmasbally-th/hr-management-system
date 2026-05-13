-- Storage bucket for document uploads (medical certificates, scanned travel orders, etc.)
-- Must be run in Supabase SQL Editor before file upload features can be used.
--
-- Bucket: documents (private)
-- Allowed file types enforced at application layer (PDF, JPG, PNG, WebP)
-- Max file size enforced at application layer (5 MB)

-- =============================================================================
-- 1. Create the bucket (idempotent)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 2. RLS policies on storage.objects for the 'documents' bucket
-- =============================================================================

-- Clean up any pre-existing policies with the same names to make this idempotent
DROP POLICY IF EXISTS "documents_hr_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_hr_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_hr_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_authenticated_select" ON storage.objects;

-- INSERT: only HR/Admin can upload to the documents bucket
CREATE POLICY "documents_hr_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('hr', 'admin')
  )
);

-- UPDATE: only HR/Admin can overwrite/move objects in the documents bucket
CREATE POLICY "documents_hr_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('hr', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('hr', 'admin')
  )
);

-- DELETE: only HR/Admin can remove objects from the documents bucket
CREATE POLICY "documents_hr_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('hr', 'admin')
  )
);

-- SELECT: any authenticated user can read (the app layer issues signed URLs;
-- access to specific files is mediated by the server actions that generate them).
-- For tighter restrictions, narrow this policy after auditing actual usage.
CREATE POLICY "documents_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- =============================================================================
-- Notes
-- =============================================================================
-- * Row-Level Security is already enabled by Supabase on storage.objects by default.
-- * The application layer (lib/actions/storage-actions.ts) also enforces:
--     - HR/Admin check before upload/delete
--     - File-size limit (5 MB)
--     - MIME-type allowlist
--     - Rate limiting per user
-- * Signed URLs are generated via getDocumentUrl() with a 1-hour TTL.

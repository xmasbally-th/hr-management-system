-- Avatars bucket — standalone fix
--
-- The original `avatars` bucket creation was bundled into
-- 20260514_profile_extensions.sql section 7, but production showed
-- "Bucket not found" on upload from /dashboard/profile. This file is
-- self-contained so you can re-run it in isolation if the original
-- section 7 didn't apply for any reason (mid-script failure, RLS edge
-- case, etc.). All statements are idempotent.
--
-- Run in Supabase SQL Editor.

-- 1. Create (or update) the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,         -- public-readable (no signed URL needed)
  2097152,      -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies (drop+create for idempotency)
DROP POLICY IF EXISTS "avatars_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"        ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"        ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read"         ON storage.objects;

-- Authenticated users may upload only into their own folder ({auth.uid()}/...)
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

-- Public read so the rendered <img src="..."> works without signed URLs.
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Sanity check (uncomment to run):
-- SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';

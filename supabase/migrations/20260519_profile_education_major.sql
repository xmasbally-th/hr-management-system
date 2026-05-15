-- Phase S7-A: split education degree from major field
--
-- Old shape: `degree` was a single text column where HR rolled the
-- level + the field together (e.g. "ปริญญาเอก สาขาการจัดการ"). This
-- makes filtering by level impossible and doesn't line up with the
-- education_levels catalog added in Phase S3.
--
-- New shape:
--   * degree       — level name only ("ปริญญาเอก"), should match a
--                    row in education_levels
--   * major_field  — free text, HR-entered ("การจัดการ")
--
-- Must be run in Supabase SQL Editor before deploying S7-A code.

ALTER TABLE profile_educations
  ADD COLUMN IF NOT EXISTS major_field TEXT;

-- Best-effort backfill: if the existing `degree` already contains the
-- word "สาขา", split on it. Order matters — we read the source value,
-- write the trailing portion to major_field, then trim degree.
UPDATE profile_educations
SET
  major_field = trim(replace(substring(degree FROM position('สาขา' IN degree)), 'สาขา', '')),
  degree      = trim(split_part(degree, 'สาขา', 1))
WHERE
  major_field IS NULL
  AND position('สาขา' IN degree) > 0;

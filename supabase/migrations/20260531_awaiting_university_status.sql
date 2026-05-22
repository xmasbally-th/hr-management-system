-- ============================================================
-- Add 'awaiting_university' status (optional university/President step)
--
-- Flow refinement: the President signature IS the university step (merged).
-- After the Dean approves, HR may OPTIONALLY send the document to the
-- university for the President to sign:
--   approved → (scan faculty doc) → ส่งมหาวิทยาลัย (awaiting_university)
--            → รับเอกสารคืน + เก็บแฟ้ม (completed)
-- or complete at faculty level directly (approved → completed).
--
-- Shared user_status enum (idempotent).
-- ============================================================

ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'awaiting_university';

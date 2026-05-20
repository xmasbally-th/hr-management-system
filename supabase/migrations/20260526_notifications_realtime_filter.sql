-- True Realtime message reduction (Phase S12).
--
-- Phase S11 added a per-type realtime_enabled toggle, but the client
-- still received the row over Realtime and merely suppressed the toast.
-- That still consumes a Supabase Realtime message. Here we stop the
-- broadcast at the source: a `realtime` flag column + a publication row
-- filter so rows with realtime=false never replicate.
--
-- Requires Postgres 15+ (publication row filters) — Supabase qualifies.
-- Idempotent.

-- 1. Add the per-row realtime flag (default true = current behaviour).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS realtime BOOLEAN NOT NULL DEFAULT true;

-- 2. Re-publish notifications with a row filter so only realtime=true
--    rows emit Realtime events. REPLICA IDENTITY FULL (set in S9) makes
--    every column available to the filter.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications WHERE (realtime = true);
  RAISE NOTICE 'notifications re-published with realtime=true row filter';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- Verification (run these AFTER the migration to confirm it works)
-- ─────────────────────────────────────────────────────────────────
--
-- 1. Confirm the row filter is attached to the publication:
--    Expect rowfilter = "(realtime = true)"
--
--    SELECT pubname, tablename, rowfilter
--    FROM pg_publication_tables
--    WHERE tablename = 'notifications';
--
-- 2. Confirm the column exists with the right default:
--
--    SELECT column_name, data_type, column_default, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'notifications' AND column_name = 'realtime';
--
-- 3. End-to-end smoke (in the app):
--    a) As admin, set a type's "Realtime" toggle OFF in
--       /dashboard/settings → การแจ้งเตือน
--    b) Trigger that notification; confirm a NEW row has realtime=false:
--         SELECT type, realtime, created_at FROM notifications
--         ORDER BY created_at DESC LIMIT 5;
--    c) Confirm the recipient's bell badge updates only on refresh/open
--       (no toast / no live push) — i.e. the row did NOT broadcast.
--    d) Flip the toggle back ON, trigger again; the new row has
--       realtime=true and the recipient gets a live toast.

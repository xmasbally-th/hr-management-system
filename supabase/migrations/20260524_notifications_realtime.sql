-- Enable Supabase Realtime (Postgres CDC) on the notifications table so
-- the client can subscribe to INSERT events instead of polling.
--
-- Used by Phase S9 — Real-time Notification Bell for HR/Admin. Non-HR
-- users keep the existing on-mount-only behaviour (no subscription).
--
-- Both statements are idempotent — safe to re-run.

-- 1. Add the table to the supabase_realtime publication if not already there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    RAISE NOTICE 'Added notifications to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'notifications already in supabase_realtime — nothing to do';
  END IF;
END $$;

-- 2. Ensure full row payloads are emitted so the client receives every
--    column on INSERT (default replica identity only sends primary key
--    on UPDATE/DELETE — INSERT always includes the new row).
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Sanity check (uncomment to verify after running):
-- SELECT pubname, tablename FROM pg_publication_tables
--   WHERE tablename = 'notifications';

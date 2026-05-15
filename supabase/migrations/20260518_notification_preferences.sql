-- Per-user notification preferences (Phase S6)
--
-- One row per user. `preferences` is a JSONB map of notification-type → boolean.
-- Missing keys default to TRUE (opt-out model — users get all notifications by
-- default unless they explicitly disable a type).
--
-- The createNotificationInternal() helper consults this table and silently
-- skips the INSERT when the matching preference is FALSE.
--
-- Must be run in Supabase SQL Editor before deploying S6 code.

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- updated_at trigger (function created in earlier migration; re-create for
-- self-containment, idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at
  ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- RLS — users manage only their own row
-- =============================================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifprefs_own_select" ON notification_preferences;
DROP POLICY IF EXISTS "notifprefs_own_insert" ON notification_preferences;
DROP POLICY IF EXISTS "notifprefs_own_update" ON notification_preferences;
DROP POLICY IF EXISTS "notifprefs_own_delete" ON notification_preferences;

CREATE POLICY "notifprefs_own_select" ON notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifprefs_own_insert" ON notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifprefs_own_update" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifprefs_own_delete" ON notification_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Note: the createNotificationInternal() helper runs with the
-- already-authenticated server-action client (caller's identity), so
-- SELECTing prefs for *another* user fails RLS. The helper falls back to
-- treating "missing pref" as "send notification" — safer default.

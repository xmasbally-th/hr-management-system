-- Centralised, admin-controlled notification settings (Phase S11).
--
-- Replaces the per-user opt-out model (notification_preferences) with a
-- single source of truth keyed by notification type. Admins control:
--   - enabled:          whether the type is sent at all
--   - realtime_enabled: whether clients show toast/flicker (bell badge
--                       always updates regardless)
--   - cooldown_seconds: minimum gap between same-type notifications to
--                       the same user (dedups rapid actions)
--   - recipient_roles:  which roles receive this type
--
-- notification_preferences is intentionally left in place (dead) so this
-- migration is non-destructive; it can be dropped in a later cleanup.

CREATE TABLE IF NOT EXISTS notification_type_settings (
  type TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  realtime_enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (cooldown_seconds >= 0 AND cooldown_seconds <= 86400),
  recipient_roles JSONB NOT NULL DEFAULT
    '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Seed the 14 known types with sensible defaults.
INSERT INTO notification_type_settings (type, cooldown_seconds, realtime_enabled, recipient_roles) VALUES
  ('new_leave_request',       0,  true,  '{"admin":false,"hr":true,"manager":true,"employee":false}'::jsonb),
  ('new_travel_request',      0,  true,  '{"admin":false,"hr":true,"manager":true,"employee":false}'::jsonb),
  ('leave_approved',          0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('leave_rejected',          0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('travel_approved',         0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('travel_rejected',         0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('account_approved',        0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('account_rejected',        0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('account_pending',         0,  false, '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('profile_edited_by_hr',    0,  false, '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('correction_resolved',     0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('correction_rejected',     0,  true,  '{"admin":true,"hr":true,"manager":true,"employee":true}'::jsonb),
  ('user_profile_confirmed',  10, true,  '{"admin":true,"hr":true,"manager":false,"employee":false}'::jsonb),
  ('new_correction_request',  5,  true,  '{"admin":true,"hr":true,"manager":false,"employee":false}'::jsonb)
ON CONFLICT (type) DO NOTHING;

-- RLS — everyone authenticated can read (client needs realtime_enabled),
-- only admins can write.
ALTER TABLE notification_type_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nts_select_all" ON notification_type_settings;
CREATE POLICY "nts_select_all" ON notification_type_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nts_admin_write" ON notification_type_settings;
CREATE POLICY "nts_admin_write" ON notification_type_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Composite index to make the cooldown lookup
-- (last notification of (user, type)) fast.
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON notifications(user_id, type, created_at DESC);

-- Sanity check (uncomment to verify):
-- SELECT type, enabled, realtime_enabled, cooldown_seconds FROM notification_type_settings ORDER BY type;

-- System Settings — Phase S4
--
-- Key/value store for system-wide flags that admins can edit from the UI
-- (/dashboard/settings → ความปลอดภัย). Replaces the env-only
-- ALLOWED_EMAIL_DOMAINS and AUTO_APPROVE_NEW_USERS — the env values
-- continue to act as fallback when a row is missing.
--
-- Must be run in Supabase SQL Editor before deploying S4 code.

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Seed defaults (idempotent)
INSERT INTO system_settings (key, value) VALUES
  ('allowed_email_domains',  '["g.lpru.ac.th"]'::jsonb),
  ('auto_approve_new_users', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Admin-only RLS (read AND write)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syssettings_admin_all" ON system_settings;
CREATE POLICY "syssettings_admin_all" ON system_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Note: the OAuth callback reads these via the service-role client
-- (bypasses RLS), so non-admin auth doesn't need read access here.

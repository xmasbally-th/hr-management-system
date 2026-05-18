-- Fix RLS UPDATE policy for profile_correction_requests
--
-- The original policy used only USING (which defaults WITH CHECK to the
-- same expression). When an owner cancels their own request — setting
-- status='cancelled' — the new row no longer matches `status = 'pending'`
-- and PG raises "new row violates row-level security policy".
--
-- The fix splits USING (which row is visible to update) from WITH CHECK
-- (what the new row must satisfy):
--   • USING: HR/Admin always, OR owner of a still-pending request
--   • WITH CHECK: HR/Admin always, OR owner setting it to pending|cancelled
--     (owner can't approve/reject — only HR can)

DROP POLICY IF EXISTS "pcr_update" ON profile_correction_requests;

CREATE POLICY "pcr_update" ON profile_correction_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('hr','admin')
    )
    OR (target_user_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('hr','admin')
    )
    OR (target_user_id = auth.uid() AND status IN ('pending','cancelled'))
  );

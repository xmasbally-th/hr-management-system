-- ============================================================
-- M5: seed leave_policy into system_settings
--
-- Centralises the per-leave-type thresholds HR may want to adjust without
-- a code release: medical-cert threshold for sick leave and the advance-
-- notice window for planned personal leave. enforceLeaveTypeRules and
-- leave-request-form read from this key (with the hardcoded defaults as
-- fallback if the row is missing).
-- ============================================================

INSERT INTO public.system_settings (key, value)
VALUES (
  'leave_policy',
  '{"sick_cert_threshold_working_days": 2, "personal_advance_notice_days": 3}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

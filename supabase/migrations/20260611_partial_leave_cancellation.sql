-- ============================================================
-- Partial leave cancellation (ยกเลิกวันลาบางช่วง)
--
-- Government form "แบบใบขอยกเลิกวันลา" allows cancelling a sub-range
-- ("ตั้งแต่…ถึง…รวม…วัน"), e.g. returning to work early. Store the
-- requested range on the cancellation request; NULL = cancel the whole
-- leave (existing behaviour). The original leave keeps its dates for the
-- record — on completion only its working_days shrink and the quota for
-- the cancelled range is released.
--
-- Additive only.
-- ============================================================

ALTER TABLE public.leave_cancellation_requests
  ADD COLUMN IF NOT EXISTS cancel_start_date date,
  ADD COLUMN IF NOT EXISTS cancel_end_date   date,
  ADD COLUMN IF NOT EXISTS cancel_working_days numeric;

COMMENT ON COLUMN public.leave_cancellation_requests.cancel_start_date IS
  'วันแรกของช่วงที่ขอยกเลิก (NULL = ยกเลิกทั้งใบ)';
COMMENT ON COLUMN public.leave_cancellation_requests.cancel_end_date IS
  'วันสุดท้ายของช่วงที่ขอยกเลิก (NULL = ยกเลิกทั้งใบ)';
COMMENT ON COLUMN public.leave_cancellation_requests.cancel_working_days IS
  'วันทำการในช่วงที่ขอยกเลิก — คำนวณตอนยื่น ใช้คืนสิทธิ์ตอน complete';

ALTER TABLE public.leave_cancellation_requests
  ADD CONSTRAINT cancel_range_paired CHECK (
    (cancel_start_date IS NULL) = (cancel_end_date IS NULL)
  );

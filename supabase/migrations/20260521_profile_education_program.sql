-- เพิ่ม "หลักสูตร" (program name, เช่น "ศิลปศาสตรบัณฑิต") แยกจาก degree level
-- ("ปริญญาตรี") และ major_field ("คอมพิวเตอร์ธุรกิจ") ที่มีอยู่แล้ว
--
-- ตัวอย่าง:
--   degree="ปริญญาตรี" · program_name="ศิลปศาสตรบัณฑิต" · major_field="คอมพิวเตอร์ธุรกิจ"
--   degree="ปริญญาโท" · program_name="บริหารธุรกิจมหาบัณฑิต" · major_field="การจัดการ"
--
-- ปล่อย NULL ได้ — แถวเดิมไม่ต้อง backfill (program เป็น optional)

ALTER TABLE profile_educations
  ADD COLUMN IF NOT EXISTS program_name TEXT;

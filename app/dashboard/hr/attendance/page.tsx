import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/actions/profile-actions";
import { getAttendancePeriods } from "@/lib/actions/attendance-actions";
import { AttendanceListClient } from "./attendance-list-client";

export const metadata = { title: "สรุปการมาปฏิบัติงาน" };

export default async function AttendanceHubPage() {
  const profile = await getMyProfile();
  const role = profile.role;
  if (role !== "admin" && role !== "hr" && role !== "manager") {
    redirect("/dashboard");
  }
  const canManage = role === "admin" || role === "hr";

  // Single-faculty system: no department picker. The create action resolves
  // the faculty automatically server-side.
  const periods = await getAttendancePeriods();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สรุปการมาปฏิบัติงาน</h1>
        <p className="text-muted-foreground">
          นำเข้าและจัดการข้อมูลสรุปการมาปฏิบัติราชการรายเดือนที่ HR มหาวิทยาลัยส่งมา
          (อัปโหลด PDF → ระบบอ่านตัวเลขให้อัตโนมัติ → ตรวจ/จับคู่ชื่อ → เผยแพร่)
        </p>
      </div>

      <AttendanceListClient periods={periods} canManage={canManage} />
    </div>
  );
}

import { getLeaveTypeSettings, getDepartmentList, getSystemStats } from "@/lib/actions/settings-actions";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "ตั้งค่าระบบ" };

export default async function SettingsPage() {
  const [leaveTypes, departments, systemStats] = await Promise.all([
    getLeaveTypeSettings(),
    getDepartmentList(),
    getSystemStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบ</h1>
        <p className="text-muted-foreground">จัดการประเภทการลา, แผนก และข้อมูลระบบ</p>
      </div>

      <SettingsClient
        leaveTypes={leaveTypes}
        departments={departments}
        systemStats={systemStats}
      />
    </div>
  );
}

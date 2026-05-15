import { getDepartments, getPositions } from "@/lib/actions/master-data-actions";
import { getLeaveTypeSettings } from "@/lib/actions/settings-actions";
import { MasterDataClient } from "./master-data-client";

export const metadata = {
  title: "ข้อมูลหลัก",
};

export default async function MasterDataPage() {
  const [departments, positions, leaveTypes] = await Promise.all([
    getDepartments(),
    getPositions(),
    getLeaveTypeSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ข้อมูลหลัก</h1>
        <p className="text-muted-foreground">
          จัดการหน่วยงาน ตำแหน่ง และประเภทการลา —
          ข้อมูลในหน้านี้จะถูกใช้ใน dropdown ของฟอร์มทั่วทั้งระบบ
        </p>
      </div>

      <MasterDataClient
        departments={departments}
        positions={positions}
        leaveTypes={leaveTypes}
      />
    </div>
  );
}

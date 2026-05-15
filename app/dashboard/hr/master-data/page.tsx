import {
  getDepartments,
  getPositions,
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { getLeaveTypeSettings } from "@/lib/actions/settings-actions";
import { MasterDataClient } from "./master-data-client";

export const metadata = {
  title: "ข้อมูลหลัก",
};

export default async function MasterDataPage() {
  const [
    departments,
    positions,
    leaveTypes,
    employeeTypes,
    educationLevels,
    decorationCatalog,
  ] = await Promise.all([
    getDepartments(),
    getPositions(),
    getLeaveTypeSettings(),
    getEmployeeTypes(),
    getEducationLevels(),
    getDecorationCatalog(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ข้อมูลหลัก</h1>
        <p className="text-muted-foreground">
          จัดการข้อมูลที่ถูกอ้างอิงในฟอร์มต่าง ๆ ทั้งระบบ —
          หน่วยงาน · ตำแหน่ง · ประเภทการลา · ประเภทบุคลากร · วุฒิการศึกษา · เครื่องราชอิสริยาภรณ์
        </p>
      </div>

      <MasterDataClient
        departments={departments}
        positions={positions}
        leaveTypes={leaveTypes}
        employeeTypes={employeeTypes}
        educationLevels={educationLevels}
        decorationCatalog={decorationCatalog}
      />
    </div>
  );
}

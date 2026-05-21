import {
  getDepartments,
  getPositions,
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { getLeaveTypeSettings, getLeaveOnlineEnabled } from "@/lib/actions/settings-actions";
import { getHolidays } from "@/lib/actions/holiday-actions";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { MasterDataClient } from "./master-data-client";

export const metadata = {
  title: "ข้อมูลหลัก",
};

export default async function MasterDataPage() {
  const curFy = currentFiscalYear();

  const [
    departments,
    positions,
    leaveTypes,
    leaveOnlineEnabled,
    holidays,
    employeeTypes,
    educationLevels,
    decorationCatalog,
  ] = await Promise.all([
    getDepartments(),
    getPositions(),
    getLeaveTypeSettings(),
    getLeaveOnlineEnabled(),
    getHolidays(curFy),
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
          หน่วยงาน · ตำแหน่ง · ประเภทการลา · วันหยุดราชการ · ประเภทบุคลากร · วุฒิการศึกษา · เครื่องราชอิสริยาภรณ์
        </p>
      </div>

      <MasterDataClient
        departments={departments}
        positions={positions}
        leaveTypes={leaveTypes}
        leaveOnlineEnabled={leaveOnlineEnabled}
        holidays={holidays}
        fiscalYearOptions={getFiscalYearOptions()}
        currentFiscalYear={curFy}
        employeeTypes={employeeTypes}
        educationLevels={educationLevels}
        decorationCatalog={decorationCatalog}
      />
    </div>
  );
}

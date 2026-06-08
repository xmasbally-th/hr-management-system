import {
  getDepartments,
  getPositions,
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { getLeaveTypeSettings, getLeaveOnlineEnabled, getLeavePolicy } from "@/lib/actions/settings-actions";
import { getHolidays } from "@/lib/actions/holiday-actions";
import { getExamPeriods } from "@/lib/actions/exam-period-actions";
import { getExamDutyPositions } from "@/lib/actions/settings-actions";
import { getLeaveTemplates } from "@/lib/actions/template-actions";
import { getMyProfile } from "@/lib/actions/profile-actions";
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
    examPeriods,
    examDutyPositions,
    employeeTypes,
    educationLevels,
    decorationCatalog,
    documentTemplates,
    profile,
    leavePolicy,
  ] = await Promise.all([
    getDepartments(),
    getPositions(),
    getLeaveTypeSettings(),
    getLeaveOnlineEnabled(),
    getHolidays(curFy),
    getExamPeriods(curFy),
    getExamDutyPositions(),
    getEmployeeTypes(),
    getEducationLevels(),
    getDecorationCatalog(),
    getLeaveTemplates(),
    getMyProfile(),
    getLeavePolicy(),
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
        examPeriods={examPeriods}
        examDutyPositions={examDutyPositions}
        fiscalYearOptions={getFiscalYearOptions()}
        currentFiscalYear={curFy}
        employeeTypes={employeeTypes}
        educationLevels={educationLevels}
        decorationCatalog={decorationCatalog}
        documentTemplates={documentTemplates}
        canManageTemplates={profile.role === "admin"}
        leavePolicy={leavePolicy}
      />
    </div>
  );
}

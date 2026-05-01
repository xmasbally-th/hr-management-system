import { getDepartments, getPositions } from "@/lib/actions/master-data-actions";
import { AddUserClient } from "./add-user-client";

export const metadata = {
  title: "เพิ่มพนักงานใหม่",
};

export default async function AddUserPage() {
  const departments = await getDepartments();
  const positions = await getPositions();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">เพิ่มพนักงานใหม่ (Pre-registration)</h1>
        <p className="text-muted-foreground">ลงทะเบียนบัญชีผู้ใช้งานล่วงหน้าสำหรับพนักงานใหม่</p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <AddUserClient departments={departments} positions={positions} />
      </div>
    </div>
  );
}

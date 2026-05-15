import { getSystemStats } from "@/lib/actions/settings-actions";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "ตั้งค่าระบบ" };

export default async function SettingsPage() {
  const systemStats = await getSystemStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบ</h1>
        <p className="text-muted-foreground">
          สถิติระบบ ธีม และส่งออกข้อมูล — จัดการประเภทการลา/หน่วยงาน ดูที่เมนู &quot;ข้อมูลหลัก&quot;
        </p>
      </div>

      <SettingsClient systemStats={systemStats} />
    </div>
  );
}

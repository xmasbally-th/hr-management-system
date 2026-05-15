import { getSystemStats } from "@/lib/actions/settings-actions";
import {
  getAllowedDomains,
  getAutoApproveNewUsers,
  getAllSystemSettings,
} from "@/lib/system-settings";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "ตั้งค่าระบบ" };

export default async function SettingsPage() {
  const [systemStats, domains, autoApprove, allSettings] = await Promise.all([
    getSystemStats(),
    getAllowedDomains(),
    getAutoApproveNewUsers(),
    getAllSystemSettings().catch(
      () => ({}) as Record<string, { value: unknown; updated_at: string }>,
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าระบบ</h1>
        <p className="text-muted-foreground">
          สถิติระบบ ธีม ความปลอดภัย และส่งออกข้อมูล —
          จัดการประเภทการลา/หน่วยงาน ดูที่เมนู &quot;ข้อมูลหลัก&quot;
        </p>
      </div>

      <SettingsClient
        systemStats={systemStats}
        allowedDomains={domains}
        autoApprove={autoApprove}
        lastUpdated={{
          allowed_email_domains:
            (allSettings.allowed_email_domains?.updated_at as string | undefined) ??
            null,
          auto_approve_new_users:
            (allSettings.auto_approve_new_users?.updated_at as string | undefined) ??
            null,
        }}
      />
    </div>
  );
}

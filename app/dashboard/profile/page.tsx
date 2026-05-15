import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import {
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { getMyNotificationPrefs } from "@/lib/actions/notification-actions";
import { NOTIFICATION_TYPE_META } from "@/lib/notification-types";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const [
    data,
    departments,
    employeeTypes,
    educationLevels,
    decorationCatalog,
    notificationPrefs,
  ] = await Promise.all([
    getMyProfileWithHistory(),
    getDepartmentList().catch(() => []),
    getEmployeeTypes().catch(() => []),
    getEducationLevels().catch(() => []),
    getDecorationCatalog().catch(() => []),
    // Fall back to all-on if the table doesn't exist yet (migration pending)
    getMyNotificationPrefs().catch(() => {
      const fallback = {} as Record<string, boolean>;
      for (const m of NOTIFICATION_TYPE_META) fallback[m.type] = true;
      return fallback as Awaited<ReturnType<typeof getMyNotificationPrefs>>;
    }),
  ]);

  return (
    <ProfileClient
      profile={data.profile}
      educations={data.educations}
      decorations={data.decorations}
      adminPositions={data.adminPositions}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      employeeTypes={employeeTypes.map((t) => t.name)}
      educationLevels={educationLevels.map((l) => l.name)}
      decorationCatalog={decorationCatalog.map((d) => ({
        name: d.name,
        abbreviation: d.abbreviation,
      }))}
      notificationPrefs={notificationPrefs}
    />
  );
}

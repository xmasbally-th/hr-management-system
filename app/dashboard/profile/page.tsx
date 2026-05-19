import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import { getMyNotificationPrefs } from "@/lib/actions/notification-actions";
import {
  getMyPendingCorrections,
  getMyCorrectionHistory,
} from "@/lib/actions/welcome-actions";
import { NOTIFICATION_TYPE_META } from "@/lib/notification-types";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const [data, notificationPrefs, pendingCorrections, correctionHistory] =
    await Promise.all([
      getMyProfileWithHistory(),
      // Fall back to all-on if the table doesn't exist yet (migration pending)
      getMyNotificationPrefs().catch(() => {
        const fallback = {} as Record<string, boolean>;
        for (const m of NOTIFICATION_TYPE_META) fallback[m.type] = true;
        return fallback as Awaited<ReturnType<typeof getMyNotificationPrefs>>;
      }),
      getMyPendingCorrections().catch(() => []),
      getMyCorrectionHistory(20).catch(() => []),
    ]);

  return (
    <ProfileClient
      profile={data.profile}
      educations={data.educations}
      decorations={data.decorations}
      adminPositions={data.adminPositions}
      notificationPrefs={notificationPrefs}
      pendingCorrectionsCount={pendingCorrections.length}
      correctionHistory={correctionHistory}
    />
  );
}

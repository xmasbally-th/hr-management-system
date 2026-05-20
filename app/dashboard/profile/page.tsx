import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import {
  getMyPendingCorrections,
  getMyCorrectionHistory,
} from "@/lib/actions/welcome-actions";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const [data, pendingCorrections, correctionHistory] = await Promise.all([
    getMyProfileWithHistory(),
    getMyPendingCorrections().catch(() => []),
    getMyCorrectionHistory(20).catch(() => []),
  ]);

  return (
    <ProfileClient
      profile={data.profile}
      educations={data.educations}
      decorations={data.decorations}
      adminPositions={data.adminPositions}
      pendingCorrectionsCount={pendingCorrections.length}
      correctionHistory={correctionHistory}
    />
  );
}

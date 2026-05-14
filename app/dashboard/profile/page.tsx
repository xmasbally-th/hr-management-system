import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const [data, departments] = await Promise.all([
    getMyProfileWithHistory(),
    getDepartmentList().catch(() => []),
  ]);

  return (
    <ProfileClient
      profile={data.profile}
      educations={data.educations}
      decorations={data.decorations}
      adminPositions={data.adminPositions}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}

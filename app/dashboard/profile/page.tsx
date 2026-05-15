import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import {
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const [data, departments, employeeTypes, educationLevels, decorationCatalog] =
    await Promise.all([
      getMyProfileWithHistory(),
      getDepartmentList().catch(() => []),
      getEmployeeTypes().catch(() => []),
      getEducationLevels().catch(() => []),
      getDecorationCatalog().catch(() => []),
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
    />
  );
}

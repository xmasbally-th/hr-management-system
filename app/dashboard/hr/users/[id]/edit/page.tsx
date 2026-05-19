import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserProfileWithHistory } from "@/lib/actions/hr-profile-actions";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import {
  getEmployeeTypes,
  getEducationLevels,
  getDecorationCatalog,
} from "@/lib/actions/master-data-actions";
import { EditUserClient } from "./edit-user-client";

export const metadata = { title: "แก้ไขโปรไฟล์ผู้ใช้" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
  const { id } = await params;

  // RBAC check — only HR/admin reach this page (proxy enforces too)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || (me.role !== "hr" && me.role !== "admin")) {
    redirect("/dashboard");
  }

  // Fetch target user's full profile + master-data catalogs in parallel
  let data;
  try {
    data = await getUserProfileWithHistory(id);
  } catch {
    notFound();
  }

  const [departments, employeeTypes, educationLevels, decorationCatalog] =
    await Promise.all([
      getDepartmentList().catch(() => []),
      getEmployeeTypes().catch(() => []),
      getEducationLevels().catch(() => []),
      getDecorationCatalog().catch(() => []),
    ]);

  return (
    <EditUserClient
      targetUserId={id}
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

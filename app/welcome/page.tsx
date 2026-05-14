import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/actions/profile-actions";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "ยินดีต้อนรับ" };

/**
 * First-login confirmation page.
 *
 * If profile_completed_at is already set, redirect straight to dashboard
 * (the user shouldn't see this twice). Otherwise show the form pre-filled
 * with whatever HR may have imported.
 */
export default async function WelcomePage() {
  const profile = await getMyProfile();

  if (profile.profile_completed_at) {
    redirect("/dashboard");
  }

  const departments = await getDepartmentList().catch(() => []);

  return (
    <WelcomeForm
      profile={profile}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}

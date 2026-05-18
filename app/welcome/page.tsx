import { redirect } from "next/navigation";
import { getMyProfileWithHistory } from "@/lib/actions/profile-actions";
import { getMyPendingFirstReviewCorrection } from "@/lib/actions/welcome-actions";
import { WelcomeClient } from "./welcome-client";

export const metadata = { title: "ตรวจสอบข้อมูลโปรไฟล์" };

export default async function WelcomePage() {
  const data = await getMyProfileWithHistory();

  // Route by status:
  //   approved → user is past onboarding, send to dashboard
  //   rejected → proxy already redirected; we shouldn't be here, but bail
  //   awaiting_confirmation / awaiting_correction → render UI
  //   pending / pre_registered → render UI (defensive — proxy routes these too)
  if (data.profile.status === "approved") {
    redirect("/dashboard");
  }

  const pendingCorrection =
    data.profile.status === "awaiting_correction"
      ? await getMyPendingFirstReviewCorrection()
      : null;

  return (
    <WelcomeClient
      profile={data.profile}
      educations={data.educations}
      decorations={data.decorations}
      adminPositions={data.adminPositions}
      pendingCorrection={pendingCorrection}
    />
  );
}

import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/actions/profile-actions";
import { getAttendanceAnalytics } from "@/lib/actions/attendance-actions";
import { AttendanceReportsClient } from "./attendance-reports-client";

export const metadata = { title: "รายงานการมาปฏิบัติงาน" };

export default async function AttendanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const profile = await getMyProfile();
  const role = profile.role;
  if (role !== "admin" && role !== "hr" && role !== "manager") {
    redirect("/dashboard");
  }

  const { year } = await searchParams;
  const y = year ? Number(year) : undefined;
  const analytics = await getAttendanceAnalytics(
    y && Number.isInteger(y) ? y : undefined,
  ).catch(() => null);

  return <AttendanceReportsClient analytics={analytics} />;
}

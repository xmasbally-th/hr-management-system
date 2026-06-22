import { redirect, notFound } from "next/navigation";
import { getMyProfile } from "@/lib/actions/profile-actions";
import {
  getAttendancePeriodDetail,
  getFacultyRoster,
} from "@/lib/actions/attendance-actions";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { AttendanceReviewClient } from "./attendance-review-client";
import { AnnualReviewClient } from "./annual-review-client";

export const metadata = { title: "นำเข้า/ตรวจสอบสรุปการมาปฏิบัติงาน" };

export default async function AttendancePeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getMyProfile();
  const role = profile.role;
  if (role !== "admin" && role !== "hr" && role !== "manager") {
    redirect("/dashboard");
  }
  const canManage = role === "admin" || role === "hr";

  let detail;
  try {
    detail = await getAttendancePeriodDetail(id);
  } catch {
    notFound();
  }
  const { period, entries } = detail;

  const [roster, sourceUrl] = await Promise.all([
    canManage ? getFacultyRoster(period.department_id) : Promise.resolve([]),
    period.source_file_url
      ? getDocumentUrl(period.source_file_url).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (period.period_type === "annual") {
    return (
      <AnnualReviewClient
        period={period}
        entries={entries}
        roster={roster}
        sourceUrl={sourceUrl}
        canManage={canManage}
      />
    );
  }

  return (
    <AttendanceReviewClient
      period={period}
      entries={entries}
      roster={roster}
      sourceUrl={sourceUrl}
      canManage={canManage}
    />
  );
}

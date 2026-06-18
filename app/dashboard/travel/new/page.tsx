import { Suspense } from "react";
import TravelFormLoading from "./loading";
import { TravelRequestForm } from "./travel-request-form";
import { getMyProfile } from "@/lib/actions/profile-actions";
import { getExamPeriods } from "@/lib/actions/exam-period-actions";
import { getExamDutyPositions } from "@/lib/actions/settings-actions";
import { currentFiscalYear } from "@/lib/date-ranges";
import { matchesExamDuty } from "@/lib/exam-period";

export const metadata = { title: "ยื่นคำขอเดินทางราชการ" };

export default function NewTravelPage() {
  return (
    <Suspense fallback={<TravelFormLoading />}>
      <NewTravelContent />
    </Suspense>
  );
}

async function NewTravelContent() {
  const curFy = currentFiscalYear();
  const [profile, examThisFy, examNextFy, dutyPositions] = await Promise.all([
    getMyProfile().catch(() => null),
    getExamPeriods(curFy).catch(() => []),
    getExamPeriods(curFy + 1).catch(() => []),
    getExamDutyPositions().catch(() => []),
  ]);

  const examPeriods = [...examThisFy, ...examNextFy];
  const hasExamDuty = matchesExamDuty(profile?.position_title ?? null, dutyPositions);

  return <TravelRequestForm examPeriods={examPeriods} hasExamDuty={hasExamDuty} />;
}

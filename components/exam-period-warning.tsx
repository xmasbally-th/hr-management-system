"use client";

import { AlertTriangle } from "lucide-react";
import { overlappingExamPeriods, type ExamPeriodLike } from "@/lib/exam-period";
import { formatThai } from "@/lib/date-ranges";

interface Props {
  periods: ExamPeriodLike[];
  start: string;
  end: string;
  /** Whether the requester's position carries exam-proctoring duty. */
  hasDuty: boolean;
}

/**
 * Advisory (non-blocking) banner shown on travel/vacation request forms when
 * the chosen date range overlaps a configured exam period AND the requester
 * holds an exam-duty position. Renders nothing otherwise.
 */
export function ExamPeriodWarning({ periods, start, end, hasDuty }: Props) {
  if (!hasDuty) return null;
  const overlaps = overlappingExamPeriods(start, end, periods);
  if (overlaps.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="space-y-0.5 text-xs leading-relaxed">
        <p className="font-semibold">อยู่ในช่วงสอบปลายภาค</p>
        <p>
          วันที่ที่เลือกคาบเกี่ยว:{" "}
          {overlaps
            .map((p) => `${p.name} (${formatThai(p.start_date)}–${formatThai(p.end_date)})`)
            .join(", ")}
        </p>
        <p>ตำแหน่งของคุณอาจมีภาระคุมสอบ คณบดีอาจไม่อนุมัติคำขอนี้ กรุณาตรวจสอบก่อนส่ง</p>
      </div>
    </div>
  );
}

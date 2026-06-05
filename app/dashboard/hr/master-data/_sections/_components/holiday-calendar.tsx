"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HolidayType } from "@/lib/holiday-types";

export interface CalendarHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
}

interface TypeMeta {
  label: string;
  dot: string;
  cell: string;
}

interface Props {
  year: number; // Gregorian
  month: number; // 0-indexed
  holidays: CalendarHoliday[];
  typeMeta: Record<HolidayType, TypeMeta>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function HolidayCalendar({
  year,
  month,
  holidays,
  typeMeta,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const byDate = new Map(holidays.map((h) => [h.date, h]));
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayIso();

  // Leading blanks + day numbers
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-4">
      {/* Header: month title + nav + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">
            {THAI_MONTHS[month]} {year + 543}
          </h3>
          <div className="inline-flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={onPrev} aria-label="เดือนก่อนหน้า">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onToday}>
              วันนี้
            </Button>
            <Button variant="outline" size="icon-sm" onClick={onNext} aria-label="เดือนถัดไป">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {(Object.keys(typeMeta) as HolidayType[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", typeMeta[t].dot)} />
              {typeMeta[t].label}
            </span>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="aspect-square" />;
          }
          const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const holiday = byDate.get(iso);
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={cn(
                "aspect-square rounded-md border p-1.5 text-left overflow-hidden flex flex-col",
                holiday
                  ? typeMeta[holiday.type].cell
                  : "border-border bg-background",
                isToday && "ring-2 ring-primary ring-offset-1",
              )}
            >
              <span className={cn("text-xs font-medium", !holiday && "text-foreground")}>
                {day}
              </span>
              {holiday && (
                <span className="mt-0.5 text-[0.625rem] leading-tight line-clamp-3">
                  {holiday.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

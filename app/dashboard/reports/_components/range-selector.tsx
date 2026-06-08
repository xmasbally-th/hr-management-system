"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  type RangePreset,
  resolveRange,
  formatThai,
  getFiscalYearOptions,
  currentFiscalYear,
} from "@/lib/date-ranges";
import { Button } from "@/components/ui/button";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Resolved range that the page is currently rendering. */
  current: { start: string; end: string; label: string };
  /** Current preset key from URL. */
  initialPreset: RangePreset;
  /** Current year from URL (Gregorian). */
  initialYear: number;
}

const PRESET_LABELS: Record<RangePreset, string> = {
  "calendar-year": "ปีปฏิทิน",
  "fiscal-year": "ปีงบประมาณ",
  "performance-h1": "รอบประเมิน 1",
  "performance-h2": "รอบประเมิน 2",
  custom: "กำหนดเอง",
};

const PRESET_ORDER: RangePreset[] = [
  "fiscal-year",
  "performance-h1",
  "performance-h2",
  "calendar-year",
  "custom",
];

export function RangeSelector({ current, initialPreset, initialYear }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [preset, setPreset] = useState<RangePreset>(initialPreset);
  const [year, setYear] = useState<number>(initialYear);
  const [customStart, setCustomStart] = useState<string>(
    preset === "custom" ? current.start : "",
  );
  const [customEnd, setCustomEnd] = useState<string>(
    preset === "custom" ? current.end : "",
  );

  const yearOptions = getFiscalYearOptions();

  // Base UI Select.Value needs an items map (value="2025" / label="ปี 2568").
  const yearItems = useMemo(
    () =>
      Object.fromEntries(
        yearOptions.map((y) => [
          String(y),
          preset === "calendar-year" ? `ปี ${y + 543}` : `ปีงบประมาณ ${y + 543}`,
        ]),
      ),
    [yearOptions, preset],
  );

  // Preview the range the user is *about* to apply (before clicking "ใช้รายงาน")
  const preview = resolveRange(preset, year, customStart, customEnd);

  function apply() {
    if (preset === "custom" && (!customStart || !customEnd)) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    params.set("year", String(year));
    if (preset === "custom") {
      params.set("start", customStart);
      params.set("end", customEnd);
    } else {
      params.delete("start");
      params.delete("end");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          ช่วงเวลา
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          เลือกช่วงเวลาสำหรับสรุปสถิติทั้งหน้า
        </div>
      </div>

      {/* Preset segmented control */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
        {PRESET_ORDER.map((p) => {
          const active = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              disabled={isPending}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* Year / custom dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {preset !== "custom" ? (
          <div className="space-y-1.5">
            <Label className="text-xs">ปี</Label>
            <Select
              items={yearItems}
              value={String(year)}
              onValueChange={(v) => setYear(Number(v) || currentFiscalYear())}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {preset === "calendar-year" ? `ปี ${y + 543}` : `ปีงบประมาณ ${y + 543}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">เริ่ม</Label>
              <ThaiDatePicker
                value={customStart}
                onChange={setCustomStart}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">สิ้นสุด</Label>
              <ThaiDatePicker
                value={customEnd}
                onChange={setCustomEnd}
                disabled={isPending}
              />
            </div>
          </>
        )}
        <div className="space-y-1.5 sm:col-start-3">
          <Label className="text-xs">&nbsp;</Label>
          <Button
            type="button"
            onClick={apply}
            disabled={
              isPending ||
              (preset === "custom" && (!customStart || !customEnd))
            }
            className="w-full"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            ใช้รายงานนี้
          </Button>
        </div>
      </div>

      {/* Preview / current range */}
      {preview && (
        <div className="rounded-md bg-muted/40 border border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{preview.label}</span>{" "}
          · {formatThai(preview.start)} – {formatThai(preview.end)}
        </div>
      )}
    </div>
  );
}

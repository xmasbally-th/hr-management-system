"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  getFiscalYearOptions,
  currentFiscalYear,
  currentCycle,
} from "@/lib/date-ranges";

/**
 * URL-driven fiscal-year + round (half-year) selectors for the leaves page.
 * Writes `?fy=` / `?round=` and resets `page` so the server re-fetches.
 * Plain native <select> to match the existing FY selector in leave-balances.
 */
export function LeavePeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fyOptions = getFiscalYearOptions();
  const fy = Number(searchParams.get("fy")) || currentFiscalYear();
  const round = (Number(searchParams.get("round")) || currentCycle().half) as 1 | 2;

  function update(key: "fy" | "round", value: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, String(value));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="ปีงบประมาณ"
        value={fy}
        onChange={(e) => update("fy", Number(e.target.value))}
        className={selectClass}
      >
        {fyOptions.map((y) => (
          <option key={y} value={y}>
            ปีงบ {y + 543}
          </option>
        ))}
      </select>
      <select
        aria-label="รอบ"
        value={round}
        onChange={(e) => update("round", Number(e.target.value))}
        className={selectClass}
      >
        <option value={1}>รอบ 1 (ต.ค. – มี.ค.)</option>
        <option value={2}>รอบ 2 (เม.ย. – ก.ย.)</option>
      </select>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Must stay in sync with EventCategory / CATEGORY_* maps in page.tsx. */
const CATEGORIES = [
  { key: "holiday", label: "วันหยุด", color: "bg-rose-100 text-rose-800 border-rose-300" },
  { key: "exam", label: "วันสอบ", color: "bg-violet-100 text-violet-800 border-violet-300" },
  { key: "leave", label: "การลา", color: "bg-sky-100 text-sky-800 border-sky-300" },
  { key: "travel", label: "เดินทางราชการ", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { key: "training", label: "อบรม/สัมมนา", color: "bg-lime-100 text-lime-800 border-lime-300" },
] as const;

const ALL_KEYS = CATEGORIES.map((c) => c.key);

interface Props {
  /** Currently active categories (defaults to all when none specified). */
  active: string[];
}

/**
 * Toggle which event categories appear on the calendar. Writes the active
 * subset back to the URL as `?cat=leave,travel` (preserving `?m` / `?dept`).
 * When every category is active the param is dropped (the implicit default).
 */
export function CategoryFilter({ active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSet = new Set(active);

  function toggle(key: string) {
    const next = new Set(activeSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.size === 0 || next.size === ALL_KEYS.length) {
      params.delete("cat");
    } else {
      params.set("cat", ALL_KEYS.filter((k) => next.has(k)).join(","));
    }
    const qs = params.toString();
    router.push(`/dashboard/personnel-calendar${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CATEGORIES.map((c) => {
        const on = activeSet.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              on
                ? c.color
                : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted line-through decoration-1",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

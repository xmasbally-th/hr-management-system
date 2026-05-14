"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface StatusOption {
  value: string;
  label: string;
  count: number;
  tone: "amber" | "sky" | "emerald" | "indigo" | "rose" | "slate";
}

interface Props {
  options: StatusOption[];
  /** Search-param name controlled by the strip (default: "status") */
  paramName?: string;
  className?: string;
}

const TONE_BG: Record<StatusOption["tone"], string> = {
  amber: "bg-amber-50 border-amber-100 hover:border-amber-200",
  sky: "bg-sky-50 border-sky-100 hover:border-sky-200",
  emerald: "bg-emerald-50 border-emerald-100 hover:border-emerald-200",
  indigo: "bg-indigo-50 border-indigo-100 hover:border-indigo-200",
  rose: "bg-rose-50 border-rose-100 hover:border-rose-200",
  slate: "bg-slate-50 border-slate-100 hover:border-slate-200",
};
const TONE_DOT: Record<StatusOption["tone"], string> = {
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};
const TONE_TEXT: Record<StatusOption["tone"], string> = {
  amber: "text-amber-700",
  sky: "text-sky-700",
  emerald: "text-emerald-700",
  indigo: "text-indigo-700",
  rose: "text-rose-700",
  slate: "text-slate-700",
};
const TONE_ACTIVE_BG: Record<StatusOption["tone"], string> = {
  amber: "bg-amber-100 border-amber-400 ring-2 ring-amber-200",
  sky: "bg-sky-100 border-sky-400 ring-2 ring-sky-200",
  emerald: "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200",
  indigo: "bg-indigo-100 border-indigo-400 ring-2 ring-indigo-200",
  rose: "bg-rose-100 border-rose-400 ring-2 ring-rose-200",
  slate: "bg-slate-100 border-slate-400 ring-2 ring-slate-200",
};

/**
 * Horizontal strip of clickable status counter cards.
 * Updates the URL search param (defaults to `status`) to filter the table below.
 * Highlights the active card based on the current URL.
 */
export function StatusStatStrip({ options, paramName = "status", className }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramName) ?? "all";

  function hrefFor(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(paramName);
    else next.set(paramName, value);
    next.delete("page"); // reset pagination on filter change
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-3",
        className,
      )}
    >
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            className={cn(
              "rounded-lg border-2 p-3 transition",
              active ? TONE_ACTIVE_BG[opt.tone] : cn(TONE_BG[opt.tone], "border-2"),
            )}
          >
            <div className={cn("flex items-center gap-1.5 text-[0.625rem] uppercase tracking-wider font-mono font-semibold", TONE_TEXT[opt.tone])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", TONE_DOT[opt.tone])} />
              <span className="truncate">{opt.label}</span>
            </div>
            <div className={cn("text-2xl font-bold tracking-tight mt-1 font-mono", TONE_TEXT[opt.tone])}>
              {opt.count}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

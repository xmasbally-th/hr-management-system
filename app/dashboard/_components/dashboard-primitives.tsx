import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "slate" | "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";

const valueTone: Record<Tone, string> = {
  slate: "text-slate-900",
  indigo: "text-indigo-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  sky: "text-sky-600",
  violet: "text-violet-600",
};

const iconBgTone: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
}

/**
 * Compact stat tile used across all role dashboards.
 * Matches HR Dashboard v2 design (slate-200 border, rounded-xl, soft shadow on hover).
 */
export function StatCard({ label, value, sub, hint, tone = "slate", icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition">
      <div className="flex items-start justify-between">
        <div className="text-[12px] text-slate-500 font-medium">{label}</div>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg grid place-items-center", iconBgTone[tone])}>
            <Icon className="h-[15px] w-[15px]" />
          </div>
        )}
      </div>
      <div className={cn("mt-2 text-[26px] font-bold tracking-tight", valueTone[tone])}>
        {value}
        {sub && <span className="text-[14px] font-medium text-slate-400 ml-1">{sub}</span>}
      </div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

interface PanelProps {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card container with header + optional sub-title and action slot.
 * Used to wrap section content in role dashboards.
 */
export function Panel({ title, sub, action, children, className }: PanelProps) {
  return (
    <div className={cn("bg-card border border-slate-200 rounded-xl", className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <div className="font-semibold text-slate-900 text-[14px]">{title}</div>
          {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

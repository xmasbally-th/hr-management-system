import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "slate" | "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";

const valueTone: Record<Tone, string> = {
  slate: "text-foreground",
  indigo: "text-indigo-600 dark:text-indigo-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
};

const iconBgTone: Record<Tone, string> = {
  slate: "bg-muted text-muted-foreground",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
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
 * Sizes use Tailwind rem-based scale so they respond to the root font-size
 * (driven by [data-density] + viewport clamp).
 */
export function StatCard({ label, value, sub, hint, tone = "slate", icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition">
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-lg grid place-items-center", iconBgTone[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className={cn("mt-2 text-3xl font-bold tracking-tight", valueTone[tone])}>
        {value}
        {sub && <span className="text-sm font-medium text-muted-foreground ml-1">{sub}</span>}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
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
 */
export function Panel({ title, sub, action, children, className }: PanelProps) {
  return (
    <div className={cn("bg-card border border-border rounded-xl", className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/70">
        <div>
          <div className="font-semibold text-foreground text-sm">{title}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * Aging classifier for pending profile-correction requests.
 *
 * Surfaces visual urgency so HR can prioritise stale requests. Thresholds
 * are project-wide constants — change here and every panel/queue picks it
 * up consistently.
 */

export type AgingTone = "fresh" | "stale" | "overdue";

export const AGING_THRESHOLDS_DAYS = {
  /** Below this is "fresh" (default grey). */
  stale: 3,
  /** At or above this is "overdue" (red). */
  overdue: 7,
} as const;

export interface AgingInfo {
  days: number;
  tone: AgingTone;
  /** Short Thai label e.g. "5 วัน", "วันนี้" */
  shortLabel: string;
  /** Tailwind classes for chip styling */
  chipClassName: string;
  /** Whether the row should pulse for attention (overdue only) */
  pulse: boolean;
}

/**
 * Compute aging info from an ISO date string. Returns fresh by default
 * on bad input so we never crash a list render.
 */
export function getAgingInfo(
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
): AgingInfo {
  if (!createdAt) {
    return {
      days: 0,
      tone: "fresh",
      shortLabel: "—",
      chipClassName:
        "bg-muted text-muted-foreground border border-border",
      pulse: false,
    };
  }
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return {
      days: 0,
      tone: "fresh",
      shortLabel: "—",
      chipClassName:
        "bg-muted text-muted-foreground border border-border",
      pulse: false,
    };
  }
  const days = Math.max(0, Math.floor((nowMs - created) / (24 * 60 * 60 * 1000)));

  let tone: AgingTone = "fresh";
  if (days >= AGING_THRESHOLDS_DAYS.overdue) tone = "overdue";
  else if (days >= AGING_THRESHOLDS_DAYS.stale) tone = "stale";

  const shortLabel =
    days === 0 ? "วันนี้" : days === 1 ? "เมื่อวาน" : `${days} วัน`;

  const chipClassName =
    tone === "overdue"
      ? "bg-rose-100 text-rose-800 border border-rose-300"
      : tone === "stale"
        ? "bg-amber-100 text-amber-800 border border-amber-300"
        : "bg-muted text-muted-foreground border border-border";

  return {
    days,
    tone,
    shortLabel,
    chipClassName,
    pulse: tone === "overdue",
  };
}

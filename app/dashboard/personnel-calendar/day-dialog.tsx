"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One row in the day-detail list (plain JSON — built server-side). */
export interface DayItem {
  categoryLabel: string;
  colorClass: string;
  /** Person or event name. */
  label: string;
  /** Secondary line: leave type / travel title / course name. */
  heading?: string;
  statusLabel?: string;
  href?: string;
  pending?: boolean;
}

interface DayDialogProps {
  /** "10 มิ.ย. 2569" */
  dateLabel: string;
  items: DayItem[];
  triggerLabel: string;
  triggerClassName: string;
}

/**
 * Full-day event list. Triggered from a calendar cell by either the
 * "+N อื่น ๆ" overflow button or the aggregated "ลา N คน" chip, so a busy
 * day is fully inspectable instead of being cut off at the chip cap.
 * Rows are grouped by category; rows with an href link to the detail page.
 */
export function DayDialog({
  dateLabel,
  items,
  triggerLabel,
  triggerClassName,
}: DayDialogProps) {
  const [open, setOpen] = useState(false);

  // Group rows by category, preserving first-seen order
  const groups: { label: string; items: DayItem[] }[] = [];
  const byLabel = new Map<string, DayItem[]>();
  for (const it of items) {
    let bucket = byLabel.get(it.categoryLabel);
    if (!bucket) {
      bucket = [];
      byLabel.set(it.categoryLabel, bucket);
      groups.push({ label: it.categoryLabel, items: bucket });
    }
    bucket.push(it);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>กิจกรรมวันที่ {dateLabel}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {g.label} ({g.items.length})
                </p>
                <ul className="space-y-1">
                  {g.items.map((it, i) => {
                    const row = (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
                          it.colorClass,
                          it.pending && "border-dashed opacity-80",
                          it.href && "hover:opacity-80",
                        )}
                      >
                        <span className="font-medium truncate">{it.label}</span>
                        {it.heading && (
                          <span className="truncate text-[0.7rem] opacity-80">
                            — {it.heading}
                          </span>
                        )}
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {it.statusLabel && (
                            <span className="text-[0.65rem] opacity-80">{it.statusLabel}</span>
                          )}
                          {it.href && <ArrowUpRight className="h-3 w-3" />}
                        </span>
                      </div>
                    );
                    return (
                      <li key={i}>
                        {it.href ? (
                          <Link href={it.href} onClick={() => setOpen(false)}>
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              ปิด
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

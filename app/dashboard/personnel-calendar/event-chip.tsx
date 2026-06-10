"use client";

import { useState } from "react";
import Link from "next/link";
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

/** Rich summary shown in the click-through popup. */
export interface EventDetail {
  /** Dialog heading (leave type name / travel title / course name). */
  heading: string;
  typeName?: string;
  employeeName?: string;
  location?: string;
  /** "1 มิ.ย. 2569 – 3 มิ.ย. 2569" */
  dateLabel: string;
  days?: number;
  statusLabel?: string;
}

interface EventChipProps {
  /** Chip text shown in the calendar cell (usually the person's name). */
  label: string;
  /** Tailwind colour classes for the chip + category badge. */
  colorClass: string;
  /** Human label for the event category ("การลา" / "เดินทางราชการ" / …). */
  categoryLabel: string;
  detail: EventDetail;
  /** Deep-link to the full detail page. */
  href?: string;
}

/**
 * Clickable calendar chip. Opens a lightweight Dialog summarising the event
 * (no extra fetch — everything is passed in from the server) with a button
 * through to the full detail page. Used for leave / travel / training events;
 * holidays and exam periods render as plain (non-clickable) chips.
 */
export function EventChip({
  label,
  colorClass,
  categoryLabel,
  detail,
  href,
}: EventChipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${detail.employeeName ?? ""} — ${detail.heading}`.trim()}
        className={cn(
          "block w-full text-left px-1 py-0.5 rounded border text-[0.65rem] truncate hover:opacity-80 cursor-pointer",
          colorClass,
        )}
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <span
              className={cn(
                "self-start inline-flex items-center rounded border px-2 py-0.5 text-[0.7rem]",
                colorClass,
              )}
            >
              {categoryLabel}
            </span>
            <DialogTitle>{detail.heading}</DialogTitle>
          </DialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {detail.employeeName && (
              <>
                <dt className="text-muted-foreground">ผู้เกี่ยวข้อง</dt>
                <dd>{detail.employeeName}</dd>
              </>
            )}
            {detail.typeName && (
              <>
                <dt className="text-muted-foreground">ประเภท</dt>
                <dd>{detail.typeName}</dd>
              </>
            )}
            <dt className="text-muted-foreground">ช่วงวันที่</dt>
            <dd>{detail.dateLabel}</dd>
            {typeof detail.days === "number" && (
              <>
                <dt className="text-muted-foreground">จำนวนวัน</dt>
                <dd>{detail.days} วัน</dd>
              </>
            )}
            {detail.location && (
              <>
                <dt className="text-muted-foreground">สถานที่</dt>
                <dd>{detail.location}</dd>
              </>
            )}
            {detail.statusLabel && (
              <>
                <dt className="text-muted-foreground">สถานะ</dt>
                <dd>{detail.statusLabel}</dd>
              </>
            )}
          </dl>

          <DialogFooter>
            <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
              ปิด
            </DialogClose>
            {href && (
              <Link href={href} className={cn(buttonVariants({ variant: "default" }))}>
                ดูรายละเอียด
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

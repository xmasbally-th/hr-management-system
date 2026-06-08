"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatThai } from "@/lib/date-ranges";
import {
  buddhistYear as be,
  clampDay,
  daysInMonth,
  firstWeekday,
  parseISODate as parseISO,
  toISODate as toISO,
  yearPageStart as calcYearPageStart,
} from "@/lib/thai-date";

/**
 * Buddhist-Era (พ.ศ.) calendar date picker.
 *
 * Drop-in replacement for `<Input type="date">`: the public value is always an
 * ISO `YYYY-MM-DD` Gregorian (ค.ศ.) string — same as a native date input — so
 * validation, working-days and EDD auto-fill logic stay untouched. Only the UI
 * (trigger label + calendar grid) is rendered in พ.ศ. with Thai month names.
 *
 * Supports three drill-down views (day → month → decade) so distant dates such
 * as birthdates are reachable without stepping one month at a time, plus full
 * keyboard navigation (arrows / Home / End / PageUp-Down / Enter).
 */

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type View = "day" | "month" | "year";

interface Props {
  /** ISO `YYYY-MM-DD` (Gregorian) — empty string for no selection. */
  value: string;
  /** Emits the selected date as an ISO `YYYY-MM-DD` (Gregorian) string. */
  onChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function ThaiDatePicker({
  value,
  onChange,
  disabled,
  id,
  placeholder = "เลือกวันที่",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("day");
  const selected = parseISO(value);

  const today = React.useMemo(() => new Date(), []);
  const todayParts = {
    y: today.getFullYear(),
    m: today.getMonth() + 1,
    d: today.getDate(),
  };

  // Calendar view month/year (Gregorian). Default to selection, else today.
  const [viewY, setViewY] = React.useState(selected?.y ?? todayParts.y);
  const [viewM, setViewM] = React.useState(selected?.m ?? todayParts.m);

  // Day that owns keyboard focus inside the grid (roving tabindex).
  const [focusDay, setFocusDay] = React.useState(selected?.d ?? todayParts.d);
  // Whether a focus move was driven by the keyboard (so we don't steal focus
  // from the trigger on the initial open render).
  const focusPending = React.useRef(false);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Sync the calendar view when the value changes externally (e.g. maternity
  // EDD auto-fills start/end). Done during render via the prev-prop pattern
  // rather than an effect so it never cascades an extra commit.
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (selected) {
      setViewY(selected.y);
      setViewM(selected.m);
      setFocusDay(selected.d);
    }
  }

  // Always reopen in day view, anchored on the current value.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setView("day");
      if (selected) {
        setViewY(selected.y);
        setViewM(selected.m);
        setFocusDay(selected.d);
      }
    }
  }

  // Move DOM focus to the day button that owns the roving tabindex, but only
  // in response to keyboard navigation.
  React.useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-day="${focusDay}"]`,
    );
    el?.focus();
  }, [focusDay, viewM, viewY]);

  const monthDays = daysInMonth(viewY, viewM);
  const firstDow = firstWeekday(viewY, viewM); // 0=Sun..6=Sat

  function commit(y: number, m: number, d: number) {
    onChange(toISO(y, m, clampDay(y, m, d)));
    setOpen(false);
  }

  function stepMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewM(m);
    setViewY(y);
  }

  /** Shift the keyboard-focused day by N calendar days, rolling months. */
  function moveFocus(deltaDays: number) {
    const next = new Date(viewY, viewM - 1, focusDay + deltaDays);
    focusPending.current = true;
    setViewY(next.getFullYear());
    setViewM(next.getMonth() + 1);
    setFocusDay(next.getDate());
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); moveFocus(-1); break;
      case "ArrowRight": e.preventDefault(); moveFocus(1); break;
      case "ArrowUp": e.preventDefault(); moveFocus(-7); break;
      case "ArrowDown": e.preventDefault(); moveFocus(7); break;
      case "Home":
        e.preventDefault();
        focusPending.current = true;
        setFocusDay(1);
        break;
      case "End":
        e.preventDefault();
        focusPending.current = true;
        setFocusDay(monthDays);
        break;
      case "PageUp": e.preventDefault(); focusPending.current = true; stepMonth(-1); break;
      case "PageDown": e.preventDefault(); focusPending.current = true; stepMonth(1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(viewY, viewM, focusDay);
        break;
    }
  }

  // Decade page for the year view: 12 years per page (one leading + decade + one).
  const yearPageStart = calcYearPageStart(viewY);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        data-slot="thai-date-picker-trigger"
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
          className,
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 text-left", !selected && "text-muted-foreground")}>
          {selected ? formatThai(value) : placeholder}
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="isolate z-50">
          <Popover.Popup
            data-slot="thai-date-picker-popup"
            initialFocus={() =>
              gridRef.current?.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]') ?? null
            }
            className="w-72 origin-(--transform-origin) rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-closed:hidden"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-1 pb-2">
              <NavBtn
                label={view === "year" ? "ทศวรรษก่อนหน้า" : view === "month" ? "ปีก่อนหน้า" : "เดือนก่อนหน้า"}
                onClick={() => {
                  if (view === "year") setViewY((y) => y - 12);
                  else if (view === "month") setViewY((y) => y - 1);
                  else stepMonth(-1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>

              <button
                type="button"
                onClick={() => setView(view === "day" ? "month" : view === "month" ? "year" : "day")}
                className="rounded-md px-2 py-1 text-sm font-semibold tabular-nums hover:bg-accent hover:text-accent-foreground"
              >
                {view === "day" && `${THAI_MONTHS[viewM - 1]} ${be(viewY)}`}
                {view === "month" && `${be(viewY)}`}
                {view === "year" && `${be(yearPageStart)} – ${be(yearPageStart + 11)}`}
              </button>

              <NavBtn
                label={view === "year" ? "ทศวรรษถัดไป" : view === "month" ? "ปีถัดไป" : "เดือนถัดไป"}
                onClick={() => {
                  if (view === "year") setViewY((y) => y + 12);
                  else if (view === "month") setViewY((y) => y + 1);
                  else stepMonth(1);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
            </div>

            {/* ── Day view ───────────────────────────────────────────── */}
            {view === "day" && (
              <>
                <div className="grid grid-cols-7 gap-0.5 pb-1" aria-hidden="true">
                  {THAI_DOW.map((d, i) => (
                    <div
                      key={d}
                      className={cn(
                        "text-center text-xs font-medium text-muted-foreground",
                        (i === 0 || i === 6) && "text-rose-500/80",
                      )}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div
                  ref={gridRef}
                  role="grid"
                  aria-label={`${THAI_MONTHS[viewM - 1]} ${be(viewY)}`}
                  onKeyDown={onGridKeyDown}
                  className="grid grid-cols-7 gap-0.5"
                >
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`e${i}`} role="gridcell" />
                  ))}
                  {Array.from({ length: monthDays }, (_, i) => i + 1).map((day) => {
                    const isSel = selected?.y === viewY && selected?.m === viewM && selected?.d === day;
                    const isToday = todayParts.y === viewY && todayParts.m === viewM && todayParts.d === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        role="gridcell"
                        data-day={day}
                        aria-label={`${day} ${THAI_MONTHS[viewM - 1]} ${be(viewY)}`}
                        aria-selected={isSel}
                        aria-current={isToday ? "date" : undefined}
                        tabIndex={focusDay === day ? 0 : -1}
                        onClick={() => commit(viewY, viewM, day)}
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none",
                          isSel
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "hover:bg-accent hover:text-accent-foreground",
                          !isSel && isToday && "ring-1 ring-inset ring-primary/50 font-semibold",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Month view ─────────────────────────────────────────── */}
            {view === "month" && (
              <div className="grid grid-cols-3 gap-1">
                {THAI_MONTHS_SHORT.map((label, i) => {
                  const m = i + 1;
                  const isSel = selected?.y === viewY && selected?.m === m;
                  const isCur = todayParts.y === viewY && todayParts.m === m;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${THAI_MONTHS[i]} ${be(viewY)}`}
                      aria-pressed={isSel}
                      onClick={() => { setViewM(m); setView("day"); }}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSel
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                        !isSel && isCur && "ring-1 ring-inset ring-primary/50 font-semibold",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Year (decade) view ─────────────────────────────────── */}
            {view === "year" && (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                  const isSel = selected?.y === y;
                  const isCur = todayParts.y === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      aria-label={`พ.ศ. ${be(y)}`}
                      aria-pressed={isSel}
                      onClick={() => { setViewY(y); setView("month"); }}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSel
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                        !isSel && isCur && "ring-1 ring-inset ring-primary/50 font-semibold",
                      )}
                    >
                      {be(y)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Today shortcut ─────────────────────────────────────── */}
            <div className="mt-2 flex justify-center border-t border-border pt-2">
              <button
                type="button"
                onClick={() => commit(todayParts.y, todayParts.m, todayParts.d)}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                วันนี้
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

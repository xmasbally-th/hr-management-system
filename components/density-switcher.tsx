"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  applyDensity,
  readDensity,
  DENSITY_OPTIONS,
  type Density,
} from "@/lib/density";

interface DensitySwitcherProps {
  /**
   * - `"segmented"`: pill segmented control (3 buttons). Default — use in Settings.
   * - `"compact"`: tighter 3-button row for menus/dropdowns.
   */
  variant?: "segmented" | "compact";
  className?: string;
}

/**
 * UI density picker — controls root font-size via [data-density] on <html>.
 * Tailwind text utilities are rem-based, so all text scales proportionally.
 */
export function DensitySwitcher({ variant = "segmented", className }: DensitySwitcherProps) {
  const [density, setDensityState] = useState<Density>("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDensityState(readDensity());
    setMounted(true);
  }, []);

  function handleSelect(d: Density) {
    setDensityState(d);
    applyDensity(d);
  }

  const current = mounted ? density : "normal";

  if (variant === "compact") {
    return (
      <div
        role="radiogroup"
        aria-label="ขนาดตัวอักษร"
        className={cn(
          "inline-flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/50",
          className
        )}
      >
        {DENSITY_OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="ขนาดตัวอักษร"
      className={cn(
        "inline-flex items-stretch gap-1 p-1 rounded-lg border border-border bg-muted/30",
        className
      )}
    >
      {DENSITY_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleSelect(opt.value)}
            className={cn(
              "flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-md text-sm transition min-w-[7rem]",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            <span className="font-semibold">{opt.label}</span>
            <span className="text-xs font-normal opacity-80 leading-tight">
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

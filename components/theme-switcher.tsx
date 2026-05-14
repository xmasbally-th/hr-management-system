"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Sun, Moon, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeKey = "light" | "dark" | "soft" | "bold";

interface ThemeOption {
  value: ThemeKey;
  label: string;
  description: string;
  /** Swatch colors for previewing — [background, sidebar, primary]. */
  swatch: [string, string, string];
  icon: React.ComponentType<{ className?: string }>;
}

const THEMES: ThemeOption[] = [
  {
    value: "light",
    label: "สว่าง",
    description: "พื้นหลังสว่าง · sidebar ขาว",
    swatch: ["#f8fafc", "#ffffff", "#4f46e5"],
    icon: Sun,
  },
  {
    value: "dark",
    label: "มืด",
    description: "พื้นหลังเข้ม · ลดความล้าตา",
    swatch: ["#0a0a0a", "#171717", "#6366f1"],
    icon: Moon,
  },
  {
    value: "soft",
    label: "สีอ่อน",
    description: "โทน indigo อ่อน · นุ่มตา",
    swatch: ["#eef2ff", "#e0e7ff", "#6366f1"],
    icon: Sparkles,
  },
  {
    value: "bold",
    label: "สีเข้ม",
    description: "sidebar indigo เข้ม · ดูเด่น",
    swatch: ["#f8fafc", "#3730a3", "#4338ca"],
    icon: Flame,
  },
];

interface ThemeSwitcherProps {
  /**
   * - `"full"`: 4 radio cards (2×2 grid). Use in Settings.
   * - `"compact"`: vertical list rows for menus/dropdowns.
   */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * Theme picker — reads/writes via next-themes (persists to `hr-theme` storage key).
 */
export function ThemeSwitcher({ variant = "full", className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — render after client mount
  useEffect(() => setMounted(true), []);

  const current = (mounted && theme) || "light";

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {THEMES.map((t) => {
          const active = t.value === current;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition",
                active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60 text-foreground"
              )}
            >
              <span className="flex items-center gap-0.5">
                <span
                  className="w-3 h-3 rounded-sm border border-border"
                  style={{ background: t.swatch[1] }}
                />
                <span
                  className="w-3 h-3 rounded-sm border border-border"
                  style={{ background: t.swatch[2] }}
                />
              </span>
              <span className="flex-1 text-left">{t.label}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      {THEMES.map((t) => {
        const active = t.value === current;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            className={cn(
              "group relative flex items-stretch gap-3 p-3 rounded-xl border-2 transition text-left",
              active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-accent/40"
            )}
            aria-pressed={active}
          >
            {/* Swatch preview */}
            <div
              className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 grid grid-cols-3"
              aria-hidden
            >
              <span style={{ background: t.swatch[1] }} />
              <span style={{ background: t.swatch[0] }} className="col-span-2" />
              <span
                style={{ background: t.swatch[2] }}
                className="col-span-3 h-2 self-end"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="font-semibold text-sm">{t.label}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {t.description}
              </div>
            </div>
            {/* Radio dot */}
            <span
              className={cn(
                "absolute top-2 right-2 w-4 h-4 rounded-full border-2 grid place-items-center transition",
                active ? "border-primary bg-primary" : "border-border"
              )}
              aria-hidden
            >
              {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

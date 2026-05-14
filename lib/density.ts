"use client";

/**
 * UI density preference — controls root font-size via [data-density] on <html>.
 *
 * Tailwind's text-xs/sm/base/etc are rem-based, so changing the root font-size
 * scales all text in the app proportionally.
 */

export type Density = "compact" | "normal" | "large";

export const DENSITY_STORAGE_KEY = "hr-density";
export const DENSITY_DEFAULT: Density = "normal";
export const DENSITY_OPTIONS: ReadonlyArray<{
  value: Density;
  label: string;
  description: string;
}> = [
  { value: "compact", label: "กระชับ", description: "ตัวอักษรเล็ก เน้นข้อมูลแน่น" },
  { value: "normal", label: "ปกติ", description: "ขนาดมาตรฐาน เหมาะกับทุกหน้าจอ" },
  { value: "large", label: "ใหญ่", description: "ตัวอักษรใหญ่ อ่านง่าย" },
];

/**
 * Apply density to <html> and persist to localStorage.
 * Safe to call on the server (no-op).
 */
export function applyDensity(d: Density): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = d;
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, d);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

/**
 * Read stored density preference. Returns the default if missing/invalid.
 * Safe to call on the server (returns default).
 */
export function readDensity(): Density {
  if (typeof window === "undefined") return DENSITY_DEFAULT;
  try {
    const v = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (v === "compact" || v === "normal" || v === "large") return v;
  } catch {
    /* ignore */
  }
  return DENSITY_DEFAULT;
}

/**
 * Pre-paint script: applies the stored density to <html> *before* React hydration
 * to avoid a flash of the default density. Inject as a <script dangerouslySetInnerHTML>
 * inside <head>.
 */
export const DENSITY_INIT_SCRIPT = `
(function() {
  try {
    var d = localStorage.getItem(${JSON.stringify(DENSITY_STORAGE_KEY)}) || ${JSON.stringify(DENSITY_DEFAULT)};
    if (d === "compact" || d === "normal" || d === "large") {
      document.documentElement.dataset.density = d;
    }
  } catch (e) {}
})();
`.trim();

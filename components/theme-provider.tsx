"use client";

import { ThemeProvider as NextThemes, type ThemeProviderProps } from "next-themes";
import { useEffect } from "react";
import { readDensity, applyDensity } from "@/lib/density";

/**
 * Application theme + density provider.
 *
 * - Wraps `next-themes` with our 4-theme palette (light/dark/soft/bold) keyed
 *   via `data-theme` on <html>.
 * - On mount, re-applies the stored density (the pre-paint script in <head>
 *   sets it before hydration; this is a belt-and-braces re-apply).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    applyDensity(readDensity());
  }, []);

  return (
    <NextThemes
      attribute="data-theme"
      defaultTheme="light"
      themes={["light", "dark", "soft", "bold"]}
      enableSystem={false}
      storageKey="hr-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemes>
  );
}

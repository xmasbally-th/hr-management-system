import { describe, it, expect } from "vitest";

describe("Vitest smoke test", () => {
  it("runs arithmetic correctly", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves @ path alias", async () => {
    // If this import resolves, the alias works
    const mod = await import("@/lib/navigation");
    expect(mod.navigationGroups).toBeDefined();
    expect(Array.isArray(mod.navigationGroups)).toBe(true);
  });

  it("getNavigationForRole returns filtered groups", async () => {
    const { getNavigationForRole } = await import("@/lib/navigation");
    const employeeNav = getNavigationForRole("employee");
    // Employee should NOT see HR management items
    const hrGroup = employeeNav.find((g) =>
      g.items.some((i) => i.href.startsWith("/dashboard/hr"))
    );
    expect(hrGroup).toBeUndefined();
  });
});

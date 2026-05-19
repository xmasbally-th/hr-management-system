import { describe, it, expect } from "vitest";
import { completionPct, COMPLETION_FIELDS } from "@/lib/profile-completion";

describe("completionPct", () => {
  it("returns 0 for an empty profile", () => {
    expect(completionPct({})).toBe(0);
  });

  it("returns 0 for null/undefined profile defensively", () => {
    expect(completionPct(null as unknown as Record<string, unknown>)).toBe(0);
  });

  it("returns 100 when every tracked field is set", () => {
    const profile: Record<string, unknown> = {};
    for (const f of COMPLETION_FIELDS) profile[f] = "x";
    expect(completionPct(profile)).toBe(100);
  });

  it("ignores null, undefined, and whitespace-only values", () => {
    const profile: Record<string, unknown> = {
      title_th: "นาย",
      first_name_th: "  ", // whitespace only — should not count
      last_name_th: "",
      title_en: null,
      first_name_en: undefined,
    };
    // Only title_th counts → 1 / 17 ≈ 6
    expect(completionPct(profile)).toBe(6);
  });

  it("rounds to the nearest integer", () => {
    // 8 out of 17 filled → 47.058...% → rounds to 47
    const profile: Record<string, unknown> = {};
    const filled = COMPLETION_FIELDS.slice(0, 8);
    for (const f of filled) profile[f] = "x";
    expect(completionPct(profile)).toBe(47);
  });

  it("counts boolean-ish and numeric values when truthy as string", () => {
    // department_id might be a UUID string; numeric phone is fine
    const profile = {
      department_id: "abc-123",
      phone: "0812345678",
    };
    expect(completionPct(profile)).toBe(12); // 2 / 17 ≈ 12%
  });
});

import { describe, it, expect } from "vitest";
import {
  getAgingInfo,
  AGING_THRESHOLDS_DAYS,
} from "@/lib/correction-aging";

const DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * DAY).toISOString();
}

describe("getAgingInfo", () => {
  const now = Date.parse("2026-05-20T00:00:00.000Z");

  it("handles null/undefined gracefully", () => {
    const info = getAgingInfo(null);
    expect(info.tone).toBe("fresh");
    expect(info.shortLabel).toBe("—");
    expect(info.pulse).toBe(false);
  });

  it("handles invalid date string", () => {
    const info = getAgingInfo("not-a-date");
    expect(info.tone).toBe("fresh");
    expect(info.days).toBe(0);
  });

  it("today → 'วันนี้' + fresh", () => {
    const info = getAgingInfo(isoDaysAgo(now, 0), now);
    expect(info.days).toBe(0);
    expect(info.tone).toBe("fresh");
    expect(info.shortLabel).toBe("วันนี้");
  });

  it("yesterday → 'เมื่อวาน' + fresh", () => {
    const info = getAgingInfo(isoDaysAgo(now, 1), now);
    expect(info.days).toBe(1);
    expect(info.shortLabel).toBe("เมื่อวาน");
    expect(info.tone).toBe("fresh");
  });

  it(`stale threshold (${AGING_THRESHOLDS_DAYS.stale} days) flips to amber`, () => {
    const info = getAgingInfo(isoDaysAgo(now, AGING_THRESHOLDS_DAYS.stale), now);
    expect(info.tone).toBe("stale");
    expect(info.shortLabel).toBe(`${AGING_THRESHOLDS_DAYS.stale} วัน`);
    expect(info.pulse).toBe(false);
  });

  it(`one day before stale → still fresh`, () => {
    const info = getAgingInfo(
      isoDaysAgo(now, AGING_THRESHOLDS_DAYS.stale - 1),
      now,
    );
    expect(info.tone).toBe("fresh");
  });

  it(`overdue threshold (${AGING_THRESHOLDS_DAYS.overdue} days) flips to red + pulses`, () => {
    const info = getAgingInfo(
      isoDaysAgo(now, AGING_THRESHOLDS_DAYS.overdue),
      now,
    );
    expect(info.tone).toBe("overdue");
    expect(info.pulse).toBe(true);
    expect(info.chipClassName).toContain("rose");
  });

  it("very old request stays overdue", () => {
    const info = getAgingInfo(isoDaysAgo(now, 60), now);
    expect(info.tone).toBe("overdue");
    expect(info.days).toBe(60);
    expect(info.shortLabel).toBe("60 วัน");
  });

  it("future timestamp (clock skew) clamps to 0 days", () => {
    const info = getAgingInfo(new Date(now + 10 * 1000).toISOString(), now);
    expect(info.days).toBe(0);
    expect(info.tone).toBe("fresh");
  });
});

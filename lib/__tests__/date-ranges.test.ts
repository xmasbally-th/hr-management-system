import { describe, it, expect } from "vitest";
import {
  calendarYearRange,
  fiscalYearRange,
  performanceCycleRange,
  currentFiscalYear,
  currentCycle,
  resolveRange,
  formatThai,
} from "../date-ranges";

describe("calendarYearRange", () => {
  it("returns Jan 1 – Dec 31", () => {
    expect(calendarYearRange(2025)).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
      label: "ปี 2568",
    });
  });
});

describe("fiscalYearRange", () => {
  it("FY (ค.ศ.) 2026 → Oct 1 2025 – Sep 30 2026", () => {
    expect(fiscalYearRange(2026)).toEqual({
      start: "2025-10-01",
      end: "2026-09-30",
      label: "ปีงบประมาณ 2569",
    });
  });

  it("accepts พ.ศ. input (>2500)", () => {
    expect(fiscalYearRange(2569).start).toBe("2025-10-01");
    expect(fiscalYearRange(2569).end).toBe("2026-09-30");
  });
});

describe("performanceCycleRange", () => {
  it("half=1 (Oct–Mar)", () => {
    expect(performanceCycleRange(2026, 1)).toEqual({
      start: "2025-10-01",
      end: "2026-03-31",
      label: "รอบประเมินที่ 1 ปีงบประมาณ 2569",
    });
  });

  it("half=2 (Apr–Sep)", () => {
    expect(performanceCycleRange(2026, 2)).toEqual({
      start: "2026-04-01",
      end: "2026-09-30",
      label: "รอบประเมินที่ 2 ปีงบประมาณ 2569",
    });
  });

  it("accepts พ.ศ. input", () => {
    expect(performanceCycleRange(2569, 1).start).toBe("2025-10-01");
  });
});

describe("currentFiscalYear", () => {
  it("Sep 30 of year N → FY N", () => {
    expect(currentFiscalYear(new Date("2025-09-30T00:00:00"))).toBe(2025);
  });
  it("Oct 1 of year N → FY N+1", () => {
    expect(currentFiscalYear(new Date("2025-10-01T00:00:00"))).toBe(2026);
  });
  it("Jan of year N → FY N", () => {
    expect(currentFiscalYear(new Date("2026-01-15T00:00:00"))).toBe(2026);
  });
});

describe("currentCycle", () => {
  it("Oct → cycle 1 of next FY", () => {
    expect(currentCycle(new Date("2025-10-15T00:00:00"))).toEqual({
      year: 2026,
      half: 1,
    });
  });
  it("Mar 31 → still cycle 1", () => {
    expect(currentCycle(new Date("2026-03-31T00:00:00"))).toEqual({
      year: 2026,
      half: 1,
    });
  });
  it("Apr 1 → cycle 2", () => {
    expect(currentCycle(new Date("2026-04-01T00:00:00"))).toEqual({
      year: 2026,
      half: 2,
    });
  });
  it("Sep 30 → still cycle 2", () => {
    expect(currentCycle(new Date("2026-09-30T00:00:00"))).toEqual({
      year: 2026,
      half: 2,
    });
  });
});

describe("resolveRange", () => {
  it("preset='custom' without dates → null", () => {
    expect(resolveRange("custom", 2025)).toBeNull();
  });

  it("preset='custom' with dates → range", () => {
    const r = resolveRange("custom", 2025, "2025-05-01", "2025-05-31");
    expect(r?.start).toBe("2025-05-01");
    expect(r?.end).toBe("2025-05-31");
  });

  it("preset='calendar-year' → calendar range", () => {
    expect(resolveRange("calendar-year", 2025)?.start).toBe("2025-01-01");
  });
});

describe("formatThai", () => {
  it("formats with พ.ศ. year and Thai abbreviated month", () => {
    expect(formatThai("2025-10-01")).toBe("1 ต.ค. 2568");
    expect(formatThai("2026-03-31")).toBe("31 มี.ค. 2569");
  });
});

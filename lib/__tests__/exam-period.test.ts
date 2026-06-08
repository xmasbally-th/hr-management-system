import { describe, it, expect } from "vitest";
import {
  rangesOverlap,
  matchesExamDuty,
  overlappingExamPeriods,
} from "@/lib/exam-period";

describe("rangesOverlap", () => {
  it("overlaps when ranges intersect", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-10", "2026-06-05", "2026-06-15")).toBe(true);
  });
  it("overlaps when one range contains the other", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-30", "2026-06-10", "2026-06-12")).toBe(true);
  });
  it("overlaps when bounds touch (inclusive)", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-10", "2026-06-10", "2026-06-20")).toBe(true);
  });
  it("does not overlap when fully separate", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-06", "2026-06-10")).toBe(false);
  });
  it("returns false when a bound is missing", () => {
    expect(rangesOverlap("", "2026-06-10", "2026-06-05", "2026-06-15")).toBe(false);
    expect(rangesOverlap("2026-06-01", "2026-06-10", "2026-06-05", "")).toBe(false);
  });
});

describe("matchesExamDuty", () => {
  const duty = ["อาจารย์", "เจ้าหน้าที่"];
  it("matches when title contains a duty keyword", () => {
    expect(matchesExamDuty("อาจารย์", duty)).toBe(true);
    expect(matchesExamDuty("ผู้ช่วยอาจารย์ประจำสาขา", duty)).toBe(true);
    expect(matchesExamDuty("เจ้าหน้าที่บริหารงานทั่วไป", duty)).toBe(true);
  });
  it("does not match unrelated titles", () => {
    expect(matchesExamDuty("ผู้อำนวยการ", duty)).toBe(false);
  });
  it("returns false for null/blank title", () => {
    expect(matchesExamDuty(null, duty)).toBe(false);
    expect(matchesExamDuty("   ", duty)).toBe(false);
  });
  it("returns false when duty list is empty or blank-only", () => {
    expect(matchesExamDuty("อาจารย์", [])).toBe(false);
    expect(matchesExamDuty("อาจารย์", ["  "])).toBe(false);
  });
});

describe("overlappingExamPeriods", () => {
  const periods = [
    { name: "สอบปลายภาค 1/2569", start_date: "2026-03-02", end_date: "2026-03-13" },
    { name: "สอบปลายภาค 2/2569", start_date: "2026-09-21", end_date: "2026-10-02" },
  ];
  it("returns periods overlapping the request range", () => {
    const r = overlappingExamPeriods("2026-03-10", "2026-03-11", periods);
    expect(r.map((p) => p.name)).toEqual(["สอบปลายภาค 1/2569"]);
  });
  it("returns [] when no overlap", () => {
    expect(overlappingExamPeriods("2026-06-01", "2026-06-05", periods)).toEqual([]);
  });
  it("returns [] when start/end missing", () => {
    expect(overlappingExamPeriods("", "2026-03-11", periods)).toEqual([]);
  });
});

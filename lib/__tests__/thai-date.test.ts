import { describe, it, expect } from "vitest";
import {
  buddhistYear,
  parseISODate,
  toISODate,
  daysInMonth,
  firstWeekday,
  clampDay,
  yearPageStart,
} from "@/lib/thai-date";

describe("thai-date helpers", () => {
  describe("buddhistYear", () => {
    it("adds 543 to the Gregorian year", () => {
      expect(buddhistYear(2026)).toBe(2569);
      expect(buddhistYear(1967)).toBe(2510);
    });
  });

  describe("parseISODate", () => {
    it("parses a valid YYYY-MM-DD into numeric parts", () => {
      expect(parseISODate("2026-06-15")).toEqual({ y: 2026, m: 6, d: 15 });
      expect(parseISODate("1967-03-05")).toEqual({ y: 1967, m: 3, d: 5 });
    });

    it("returns null for empty / malformed / unpadded input", () => {
      expect(parseISODate("")).toBeNull();
      // @ts-expect-error guarding against null at runtime
      expect(parseISODate(null)).toBeNull();
      expect(parseISODate("2026-6-1")).toBeNull(); // not zero-padded
      expect(parseISODate("15/06/2026")).toBeNull();
      expect(parseISODate("garbage")).toBeNull();
    });

    it("rejects out-of-range month/day", () => {
      expect(parseISODate("2026-13-01")).toBeNull();
      expect(parseISODate("2026-00-10")).toBeNull();
      expect(parseISODate("2026-06-00")).toBeNull();
      expect(parseISODate("2026-06-32")).toBeNull();
    });

    it("does NOT shift the day across time zones (no Date() parsing)", () => {
      // new Date('2026-01-01') would be midnight UTC → previous day in -TZ.
      // Our parser is purely lexical, so the day is always exact.
      expect(parseISODate("2026-01-01")).toEqual({ y: 2026, m: 1, d: 1 });
      expect(parseISODate("2026-12-31")).toEqual({ y: 2026, m: 12, d: 31 });
    });
  });

  describe("toISODate", () => {
    it("zero-pads month and day", () => {
      expect(toISODate(2026, 6, 5)).toBe("2026-06-05");
      expect(toISODate(1967, 3, 5)).toBe("1967-03-05");
      expect(toISODate(2026, 12, 31)).toBe("2026-12-31");
    });

    it("round-trips with parseISODate", () => {
      for (const iso of ["2026-06-15", "2024-02-29", "1900-01-01"]) {
        const p = parseISODate(iso)!;
        expect(toISODate(p.y, p.m, p.d)).toBe(iso);
      }
    });
  });

  describe("daysInMonth", () => {
    it("handles 30/31-day months", () => {
      expect(daysInMonth(2026, 1)).toBe(31);
      expect(daysInMonth(2026, 6)).toBe(30);
    });

    it("handles February in common and leap years", () => {
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2024, 2)).toBe(29); // divisible by 4
      expect(daysInMonth(2000, 2)).toBe(29); // divisible by 400
      expect(daysInMonth(1900, 2)).toBe(28); // divisible by 100, not 400
    });
  });

  describe("firstWeekday", () => {
    it("returns 0=Sun … 6=Sat for the 1st of the month", () => {
      // 2000-01-01 was a Saturday (well-known anchor).
      expect(firstWeekday(2000, 1)).toBe(6);
      // 2026-06-01 is a Monday.
      expect(firstWeekday(2026, 6)).toBe(1);
    });
  });

  describe("clampDay", () => {
    it("caps the day at the month length", () => {
      expect(clampDay(2026, 2, 31)).toBe(28); // Feb common year
      expect(clampDay(2024, 2, 31)).toBe(29); // Feb leap year
      expect(clampDay(2026, 6, 31)).toBe(30); // June has 30
    });

    it("leaves valid days untouched", () => {
      expect(clampDay(2026, 6, 15)).toBe(15);
      expect(clampDay(2026, 1, 1)).toBe(1);
    });
  });

  describe("yearPageStart", () => {
    it("aligns the decade page to multiples of 12", () => {
      expect(yearPageStart(2016)).toBe(2016);
      expect(yearPageStart(2026)).toBe(2016);
      expect(yearPageStart(2027)).toBe(2016);
      expect(yearPageStart(2028)).toBe(2028);
    });
  });
});

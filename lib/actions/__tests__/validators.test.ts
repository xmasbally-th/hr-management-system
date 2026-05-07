import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UUID_RE,
  ISO_DATE_RE,
  validateUUID,
  validateRequestDates,
  validateEmployeeExists,
} from "../validators";

/* ================================================================
 * UUID_RE
 * ================================================================ */
describe("UUID_RE", () => {
  it.each([
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11",
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ])("matches valid UUID: %s", (uuid) => {
    expect(UUID_RE.test(uuid)).toBe(true);
  });

  it.each([
    "",
    "not-a-uuid",
    "a0eebc99-9c0b-4ef8-bb6d",
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a1",    // too short
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a111",   // too long
    "g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",    // invalid hex char
    "a0eebc999c0b4ef8bb6d6bb9bd380a11",         // no dashes
    "123",
  ])("rejects invalid UUID: %s", (value) => {
    expect(UUID_RE.test(value)).toBe(false);
  });
});

/* ================================================================
 * ISO_DATE_RE
 * ================================================================ */
describe("ISO_DATE_RE", () => {
  it.each([
    "2026-01-01",
    "2026-12-31",
    "1999-06-15",
    "2000-02-29",
  ])("matches valid date: %s", (date) => {
    expect(ISO_DATE_RE.test(date)).toBe(true);
  });

  it.each([
    "",
    "01-01-2026",
    "2026/01/01",
    "2026-1-1",
    "20260101",
    "not-a-date",
  ])("rejects non-ISO format: %s", (value) => {
    expect(ISO_DATE_RE.test(value)).toBe(false);
  });
});

/* ================================================================
 * validateUUID
 * ================================================================ */
describe("validateUUID", () => {
  it("does not throw for valid UUID", () => {
    expect(() => validateUUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).not.toThrow();
  });

  it("throws for invalid UUID with default label", () => {
    expect(() => validateUUID("bad")).toThrow("รหัสไม่ถูกต้อง");
  });

  it("throws for invalid UUID with custom label", () => {
    expect(() => validateUUID("bad", "รหัสประเภทลา")).toThrow("รหัสประเภทลาไม่ถูกต้อง");
  });

  it("throws for empty string", () => {
    expect(() => validateUUID("")).toThrow();
  });
});

/* ================================================================
 * validateRequestDates
 * ================================================================ */
describe("validateRequestDates", () => {
  const VALID_START = "2026-05-01";
  const VALID_END = "2026-05-03";
  const VALID_DAYS = 3;

  describe("valid inputs", () => {
    it("does not throw for valid dates and days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, VALID_DAYS)).not.toThrow();
    });

    it("accepts same start and end date", () => {
      expect(() => validateRequestDates("2026-05-01", "2026-05-01", 1)).not.toThrow();
    });

    it("accepts fractional total_days (e.g. 0.5 for half day)", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, 0.5)).not.toThrow();
    });
  });

  describe("date format validation", () => {
    it("throws for non-ISO start_date", () => {
      expect(() => validateRequestDates("05/01/2026", VALID_END, VALID_DAYS)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });

    it("throws for non-ISO end_date", () => {
      expect(() => validateRequestDates(VALID_START, "2026/05/03", VALID_DAYS)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });

    it("throws for empty start_date", () => {
      expect(() => validateRequestDates("", VALID_END, VALID_DAYS)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });

    it("throws for empty end_date", () => {
      expect(() => validateRequestDates(VALID_START, "", VALID_DAYS)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });

    it("throws for date without zero-padding", () => {
      expect(() => validateRequestDates("2026-5-1", VALID_END, VALID_DAYS)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });
  });

  describe("date ordering", () => {
    it("throws when start_date is after end_date", () => {
      expect(() => validateRequestDates("2026-05-10", "2026-05-01", VALID_DAYS)).toThrow(
        "วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด"
      );
    });

    it("throws when start year is after end year", () => {
      expect(() => validateRequestDates("2027-01-01", "2026-12-31", 1)).toThrow(
        "วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด"
      );
    });
  });

  describe("total_days validation", () => {
    it("throws for zero total_days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, 0)).toThrow(
        "จำนวนวันต้องมากกว่า 0"
      );
    });

    it("throws for negative total_days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, -1)).toThrow(
        "จำนวนวันต้องมากกว่า 0"
      );
    });

    it("throws for NaN total_days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, NaN)).toThrow(
        "จำนวนวันต้องมากกว่า 0"
      );
    });

    it("throws for Infinity total_days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, Infinity)).toThrow(
        "จำนวนวันต้องมากกว่า 0"
      );
    });

    it("throws for -Infinity total_days", () => {
      expect(() => validateRequestDates(VALID_START, VALID_END, -Infinity)).toThrow(
        "จำนวนวันต้องมากกว่า 0"
      );
    });
  });

  describe("validation priority (format checked before ordering)", () => {
    it("reports format error even when ordering is also wrong", () => {
      expect(() => validateRequestDates("bad", "also-bad", -1)).toThrow(
        "รูปแบบวันที่ไม่ถูกต้อง"
      );
    });
  });
});

/* ================================================================
 * validateEmployeeExists
 * ================================================================ */
describe("validateEmployeeExists", () => {
  const VALID_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  function createMockSupabase(profileData: unknown) {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "single"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockReturnValue({ data: profileData });

    return {
      from: vi.fn().mockReturnValue(chain),
      auth: { getUser: vi.fn() },
      _chain: chain,
    };
  }

  it("does not throw when employee exists with approved status", async () => {
    const supabase = createMockSupabase({ id: VALID_ID });
    await expect(
      validateEmployeeExists(supabase as never, VALID_ID)
    ).resolves.toBeUndefined();
  });

  it("calls from('profiles') with correct filters", async () => {
    const supabase = createMockSupabase({ id: VALID_ID });
    await validateEmployeeExists(supabase as never, VALID_ID);

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase._chain.eq).toHaveBeenCalledWith("id", VALID_ID);
    expect(supabase._chain.eq).toHaveBeenCalledWith("status", "approved");
  });

  it("throws for invalid UUID (does not query DB)", async () => {
    const supabase = createMockSupabase(null);
    await expect(
      validateEmployeeExists(supabase as never, "not-valid")
    ).rejects.toThrow("รหัสพนักงานไม่ถูกต้อง");

    // Should not even hit DB
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws when employee not found (null data)", async () => {
    const supabase = createMockSupabase(null);
    await expect(
      validateEmployeeExists(supabase as never, VALID_ID)
    ).rejects.toThrow("ไม่พบพนักงานในระบบ");
  });

  it("throws when employee exists but not approved", async () => {
    // When status != approved, the .eq("status","approved") filter
    // returns null data from Supabase
    const supabase = createMockSupabase(null);
    await expect(
      validateEmployeeExists(supabase as never, VALID_ID)
    ).rejects.toThrow("ไม่พบพนักงานในระบบ หรือบัญชียังไม่ได้รับการอนุมัติ");
  });

  it("throws for empty string employee ID", async () => {
    const supabase = createMockSupabase(null);
    await expect(
      validateEmployeeExists(supabase as never, "")
    ).rejects.toThrow("รหัสพนักงานไม่ถูกต้อง");
  });
});

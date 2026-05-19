import { describe, it, expect, beforeEach } from "vitest";
import {
  validateRow,
  REQUIRED_FIELDS,
  REQUIRED_FIELD_LABELS,
  type ImportValidationRow,
} from "@/lib/import-validation";

function fullRow(overrides: Partial<ImportValidationRow> = {}): ImportValidationRow {
  return {
    email: "test@example.com",
    title_th: "นาย",
    first_name_th: "สมชาย",
    last_name_th: "ใจดี",
    position_title: "อาจารย์",
    employee_type: "พนักงานมหาวิทยาลัย",
    department_name: "วิทยาการคอมพิวเตอร์",
    ...overrides,
  };
}

describe("validateRow — required fields", () => {
  let seenEmails: Map<string, number>;
  beforeEach(() => {
    seenEmails = new Map();
  });

  it("passes when all required fields are present", () => {
    expect(validateRow(fullRow(), 0, seenEmails)).toEqual([]);
  });

  for (const f of REQUIRED_FIELDS) {
    it(`flags missing ${f}`, () => {
      const row = fullRow({ [f]: "" } as Partial<ImportValidationRow>);
      const errs = validateRow(row, 0, seenEmails);
      expect(errs).toContain(`ขาด${REQUIRED_FIELD_LABELS[f]}`);
    });
  }

  it("treats whitespace-only as missing", () => {
    const errs = validateRow(fullRow({ first_name_th: "   " }), 0, seenEmails);
    expect(errs).toContain("ขาดชื่อ (ไทย)");
  });
});

describe("validateRow — email format", () => {
  it("flags malformed emails", () => {
    const seen = new Map<string, number>();
    expect(validateRow(fullRow({ email: "no-at-sign" }), 0, seen)).toContain(
      "รูปแบบอีเมลไม่ถูกต้อง",
    );
    expect(validateRow(fullRow({ email: "missing@dot" }), 0, seen)).toContain(
      "รูปแบบอีเมลไม่ถูกต้อง",
    );
  });

  it("accepts standard emails", () => {
    const errs = validateRow(fullRow({ email: "a@b.co" }), 0, new Map());
    expect(errs).toEqual([]);
  });
});

describe("validateRow — duplicates within batch", () => {
  it("flags the second occurrence and references the first row", () => {
    const seen = new Map<string, number>();
    expect(validateRow(fullRow({ email: "x@y.com" }), 0, seen)).toEqual([]);
    const errs = validateRow(fullRow({ email: "x@y.com" }), 1, seen);
    expect(errs).toContain("อีเมลซ้ำกับแถว 1");
  });

  it("is case-insensitive on email comparison", () => {
    const seen = new Map<string, number>();
    validateRow(fullRow({ email: "Mixed@CASE.com" }), 0, seen);
    const errs = validateRow(fullRow({ email: "mixed@case.com" }), 1, seen);
    expect(errs).toContain("อีเมลซ้ำกับแถว 1");
  });
});

describe("validateRow — optional date fields", () => {
  it("accepts ISO YYYY-MM-DD dates", () => {
    const errs = validateRow(
      fullRow({ birth_date: "1990-01-15", hire_date: "2020-06-30" }),
      0,
      new Map(),
    );
    expect(errs).toEqual([]);
  });

  it("rejects non-ISO date strings", () => {
    expect(
      validateRow(fullRow({ birth_date: "15/01/1990" }), 0, new Map()),
    ).toContain("birth_date ต้องเป็นรูปแบบ YYYY-MM-DD");
    expect(
      validateRow(fullRow({ hire_date: "2020-6-30" }), 0, new Map()),
    ).toContain("hire_date ต้องเป็นรูปแบบ YYYY-MM-DD");
  });

  it("accepts an empty date field as 'no value'", () => {
    expect(
      validateRow(fullRow({ birth_date: "", hire_date: "" }), 0, new Map()),
    ).toEqual([]);
  });
});

describe("validateRow — role allowlist", () => {
  for (const r of ["admin", "hr", "manager", "employee"]) {
    it(`accepts role '${r}'`, () => {
      const errs = validateRow(fullRow({ role: r }), 0, new Map());
      expect(errs).toEqual([]);
    });
  }

  it("rejects unknown roles", () => {
    expect(
      validateRow(fullRow({ role: "superadmin" }), 0, new Map()),
    ).toContain("role ต้องเป็น admin / hr / manager / employee");
  });

  it("normalizes case", () => {
    expect(validateRow(fullRow({ role: "HR" }), 0, new Map())).toEqual([]);
  });

  it("treats empty role as 'default to employee' (no error)", () => {
    expect(validateRow(fullRow({ role: "" }), 0, new Map())).toEqual([]);
  });
});

describe("validateRow — combined errors", () => {
  it("returns multiple errors in a single pass", () => {
    const errs = validateRow(
      {
        email: "broken-email",
        // missing everything else
        role: "wrong-role",
        birth_date: "01/01/1990",
      },
      0,
      new Map(),
    );
    // Required missing: 6 (everything except email which is present-but-invalid)
    // Plus email format + role + birth_date
    expect(errs.length).toBeGreaterThanOrEqual(6);
    expect(errs).toContain("รูปแบบอีเมลไม่ถูกต้อง");
    expect(errs).toContain("role ต้องเป็น admin / hr / manager / employee");
    expect(errs).toContain("birth_date ต้องเป็นรูปแบบ YYYY-MM-DD");
  });
});

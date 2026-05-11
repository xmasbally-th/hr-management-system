import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabase,
  createMockChain,
  profileRow,
  VALID_UUID,
  INVALID_UUID,
} from "./helpers";

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import {
  getMyTrainings,
  getAllTrainings,
  createTraining,
  updateTraining,
  deleteTraining,
  type CreateTrainingInput,
} from "../training-actions";

import { getTrainingTypeLabel, getTrainingTypes } from "@/lib/training-types";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function mockSupabase(overrides: Parameters<typeof createMockSupabase>[0] = {}) {
  const sb = createMockSupabase(overrides);
  vi.mocked(createClient).mockResolvedValue(sb as never);
  return sb;
}

function validInput(overrides: Partial<CreateTrainingInput> = {}): CreateTrainingInput {
  return {
    employee_id: VALID_UUID,
    course_name: "AI Fundamentals",
    training_type: "external",
    location: "Bangkok",
    start_date: "2026-06-01",
    end_date: "2026-06-03",
    total_hours: 18,
    total_cost: 5000,
    ...overrides,
  };
}

/* ── getTrainingTypeLabel ────────────────────────────────────────────── */

describe("getTrainingTypeLabel", () => {
  it("returns Thai label for known type", () => {
    expect(getTrainingTypeLabel("internal")).toBe("อบรมภายใน");
    expect(getTrainingTypeLabel("external")).toBe("อบรมภายนอก");
    expect(getTrainingTypeLabel("seminar")).toBe("สัมมนา");
  });

  it("returns raw value for unknown type", () => {
    expect(getTrainingTypeLabel("unknown")).toBe("unknown");
  });
});

describe("getTrainingTypes", () => {
  it("returns array of { value, label } pairs", () => {
    const types = getTrainingTypes();
    expect(types.length).toBeGreaterThan(0);
    expect(types[0]).toHaveProperty("value");
    expect(types[0]).toHaveProperty("label");
  });
});

/* ── getMyTrainings ──────────────────────────────────────────────────── */

describe("getMyTrainings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated data on success", async () => {
    const chain = createMockChain({ data: [{ id: "t-1", course_name: "AI" }] });
    mockSupabase({ fromOverrides: { employee_trainings: chain } });

    const result = await getMyTrainings();
    expect(result.data).toEqual([{ id: "t-1", course_name: "AI" }]);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("throws on error", async () => {
    const chain = createMockChain({ data: null, error: { message: "err" } });
    mockSupabase({ fromOverrides: { employee_trainings: chain } });

    await expect(getMyTrainings()).rejects.toThrow("ไม่สามารถดึงข้อมูลการอบรมได้");
  });
});

/* ── getAllTrainings ──────────────────────────────────────────────────── */

describe("getAllTrainings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated data for HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const trainingChain = createMockChain({ data: [{ id: "t-all" }] });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        employee_trainings: trainingChain,
      },
    });

    const result = await getAllTrainings();
    expect(result.data).toEqual([{ id: "t-all" }]);
    expect(result.page).toBe(1);
  });

  it("rejects non-HR/admin/manager", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(getAllTrainings()).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("throws on DB error", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const trainingChain = createMockChain({ data: null, error: { message: "err" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        employee_trainings: trainingChain,
      },
    });

    await expect(getAllTrainings()).rejects.toThrow("ไม่สามารถดึงข้อมูลการอบรมทั้งหมดได้");
  });
});

/* ── createTraining ──────────────────────────────────────────────────── */

describe("createTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds with valid input", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const employeeCheckChain = createMockChain({ data: { id: VALID_UUID } });
    const trainingChain = createMockChain({ data: { id: "t-new" } });

    let profileCallCount = 0;
    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "employee_trainings") return trainingChain;
      if (table === "profiles") {
        profileCallCount++;
        return profileCallCount === 1 ? profileChain : employeeCheckChain;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const result = await createTraining(validInput());
    expect(result).toEqual({ success: true, id: "t-new" });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("rejects invalid employee UUID", async () => {
    mockSupabase();
    await expect(createTraining(validInput({ employee_id: INVALID_UUID }))).rejects.toThrow(
      "รหัสพนักงานไม่ถูกต้อง"
    );
  });

  it("rejects empty course name", async () => {
    mockSupabase();
    await expect(createTraining(validInput({ course_name: "" }))).rejects.toThrow(
      "กรุณาระบุชื่อหลักสูตร"
    );
  });

  it("rejects if caller is not HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({
      authUser: { id: "emp-1" },
      fromOverrides: { profiles: profileChain },
    });

    await expect(createTraining(validInput())).rejects.toThrow(
      "Forbidden: Insufficient permissions"
    );
  });

  it("rejects if start_date > end_date", async () => {
    mockSupabase();
    await expect(
      createTraining(validInput({ start_date: "2026-06-05", end_date: "2026-06-01" }))
    ).rejects.toThrow("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  });
});

/* ── updateTraining ──────────────────────────────────────────────────── */

describe("updateTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid training UUID", async () => {
    mockSupabase();
    await expect(updateTraining(INVALID_UUID, {})).rejects.toThrow("รหัสการอบรมไม่ถูกต้อง");
  });

  it("rejects if caller is not HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(updateTraining(VALID_UUID, { course_name: "New Name" })).rejects.toThrow(
      "Forbidden: Insufficient permissions"
    );
  });

  it("succeeds for HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const trainingChain = createMockChain({ data: null, error: null });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        employee_trainings: trainingChain,
      },
    });

    await updateTraining(VALID_UUID, { course_name: "Updated Course" });
    expect(trainingChain.update).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });
});

/* ── deleteTraining ──────────────────────────────────────────────────── */

describe("deleteTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid training UUID", async () => {
    mockSupabase();
    await expect(deleteTraining(INVALID_UUID)).rejects.toThrow("รหัสการอบรมไม่ถูกต้อง");
  });

  it("rejects if caller is not HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(deleteTraining(VALID_UUID)).rejects.toThrow(
      "Forbidden: Insufficient permissions"
    );
  });

  it("succeeds for HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("admin") });
    const trainingChain = createMockChain({ data: null, error: null });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        employee_trainings: trainingChain,
      },
    });

    await deleteTraining(VALID_UUID);
    expect(trainingChain.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });
});

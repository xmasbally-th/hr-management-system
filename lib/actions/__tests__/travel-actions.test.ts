import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabase,
  createMockChain,
  profileRow,
  VALID_UUID,
  INVALID_UUID,
  type MockClientOverrides,
} from "./helpers";

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/actions/notification-actions", () => ({
  createNotificationInternal: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "@/lib/actions/notification-actions";

import {
  createTravelRequest,
  createTravelRequestByHr,
  updateActualExpense,
  getMyTravelRequests,
  getAllTravelRequests,
  type CreateTravelRequestInput,
} from "../travel-actions";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const REQUEST_ID = VALID_UUID;

function validInput(overrides: Partial<CreateTravelRequestInput> = {}): CreateTravelRequestInput {
  return {
    travel_type: "training",
    title: "Annual conference",
    location: "Bangkok",
    start_date: "2026-07-01",
    end_date: "2026-07-03",
    total_days: 3,
    submission_channel: "digital",
    expenses: [
      { expense_category: "transportation", estimated_amount: 5000 },
    ],
    ...overrides,
  };
}

function mockSupabase(overrides: MockClientOverrides = {}) {
  const sb = createMockSupabase(overrides);
  vi.mocked(createClient).mockResolvedValue(sb as never);
  return sb;
}

/* ── createTravelRequest ──────────────────────────────────────────────── */

describe("createTravelRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { success: true, id } on success", async () => {
    const travelChain = createMockChain({ data: { id: "tr-1", employee_id: "user-1" } });
    const expenseChain = createMockChain({ data: null, error: null });
    const hrChain = createMockChain({ data: [{ id: "hr-1" }] });

    const sb = createMockSupabase();
    sb.from = vi.fn((table: string) => {
      if (table === "travel_requests") return travelChain;
      if (table === "travel_expenses") return expenseChain;
      if (table === "profiles") return hrChain;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const result = await createTravelRequest(validInput());
    expect(result).toEqual({ success: true, id: "tr-1" });
    expect(sb.from).toHaveBeenCalledWith("travel_requests");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("inserts expenses on success", async () => {
    const travelChain = createMockChain({ data: { id: "tr-1" } });
    const expenseChain = createMockChain({ data: null, error: null });
    const hrChain = createMockChain({ data: [] });

    const sb = createMockSupabase();
    sb.from = vi.fn((table: string) => {
      if (table === "travel_requests") return travelChain;
      if (table === "travel_expenses") return expenseChain;
      if (table === "profiles") return hrChain;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await createTravelRequest(validInput());
    expect(sb.from).toHaveBeenCalledWith("travel_expenses");
    expect(expenseChain.insert).toHaveBeenCalled();
  });

  it("sends notifications to HR users on success", async () => {
    const travelChain = createMockChain({ data: { id: "tr-1" } });
    const expenseChain = createMockChain({ data: null, error: null });
    const hrChain = createMockChain({ data: [{ id: "hr-1" }, { id: "hr-2" }] });

    const sb = createMockSupabase();
    sb.from = vi.fn((table: string) => {
      if (table === "travel_requests") return travelChain;
      if (table === "travel_expenses") return expenseChain;
      if (table === "profiles") return hrChain;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await createTravelRequest(validInput());
    expect(createNotificationInternal).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid dates", async () => {
    mockSupabase();
    await expect(
      createTravelRequest(validInput({ start_date: "07/01/2026" }))
    ).rejects.toThrow("รูปแบบวันที่ไม่ถูกต้อง");
  });

  it("rejects if start_date > end_date", async () => {
    mockSupabase();
    await expect(
      createTravelRequest(validInput({ start_date: "2026-07-05", end_date: "2026-07-01" }))
    ).rejects.toThrow("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  });

  it("rejects if total_days <= 0", async () => {
    mockSupabase();
    await expect(createTravelRequest(validInput({ total_days: -1 }))).rejects.toThrow(
      "จำนวนวันต้องมากกว่า 0"
    );
  });

  it("throws generic error on insert failure", async () => {
    const travelChain = createMockChain({
      data: null,
      error: { message: "unique constraint violation xyz_pkey" },
    });

    mockSupabase({ fromOverrides: { travel_requests: travelChain } });

    await expect(createTravelRequest(validInput())).rejects.toThrow(
      "ไม่สามารถส่งคำขอเดินทางได้"
    );
  });
});

/* ── createTravelRequestByHr ──────────────────────────────────────────── */

describe("createTravelRequestByHr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds with valid employee when caller is HR", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const employeeCheck = createMockChain({ data: { id: VALID_UUID } });
    const travelChain = createMockChain({ data: { id: "tr-2" } });
    const expenseChain = createMockChain({ data: null, error: null });

    let profileCallCount = 0;
    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "travel_requests") return travelChain;
      if (table === "travel_expenses") return expenseChain;
      if (table === "profiles") {
        profileCallCount++;
        return profileCallCount === 1 ? profileChain : employeeCheck;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const { submission_channel: _, ...inputWithoutChannel } = validInput();
    const result = await createTravelRequestByHr(VALID_UUID, inputWithoutChannel);
    expect(result).toEqual({ success: true, id: "tr-2" });
  });

  it("rejects if caller is not HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    const { submission_channel: _, ...inputWithoutChannel } = validInput();
    await expect(
      createTravelRequestByHr(VALID_UUID, inputWithoutChannel)
    ).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("validates employee exists", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const noEmployee = createMockChain({ data: null });

    let profileCallCount = 0;
    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        return profileCallCount === 1 ? profileChain : noEmployee;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const { submission_channel: _, ...inputWithoutChannel } = validInput();
    await expect(
      createTravelRequestByHr(VALID_UUID, inputWithoutChannel)
    ).rejects.toThrow("ไม่พบพนักงานในระบบ");
  });

  it("validates dates", async () => {
    mockSupabase();
    const { submission_channel: _, ...inputWithoutChannel } = validInput({
      start_date: "2026-07-05",
      end_date: "2026-07-01",
    });
    await expect(
      createTravelRequestByHr(VALID_UUID, inputWithoutChannel)
    ).rejects.toThrow("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  });
});

/* D5: tests for the removed legacy approveTravelRequest / rejectTravelRequest
   / completeTravelRequest were dropped along with those functions. The new
   workflow stages live in travel-actions.ts but aren't covered by mocked
   tests yet — verification happens end-to-end through the UI (see plan). */

/* ── updateActualExpense ──────────────────────────────────────────────── */

describe("updateActualExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when request is approved/completed", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const expenseLookup = createMockChain({ data: { travel_request_id: "tr-1" } });
    const requestLookup = createMockChain({ data: { status: "approved" } });
    const expenseUpdate = createMockChain({ data: null, error: null });

    let travelExpenseCallCount = 0;
    let travelRequestCallCount = 0;

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "travel_expenses") {
        travelExpenseCallCount++;
        return travelExpenseCallCount === 1 ? expenseLookup : expenseUpdate;
      }
      if (table === "travel_requests") return requestLookup;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await updateActualExpense(VALID_UUID, 4500);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("rejects invalid UUID", async () => {
    mockSupabase();
    await expect(updateActualExpense(INVALID_UUID, 100)).rejects.toThrow(
      "รหัสค่าใช้จ่ายไม่ถูกต้อง"
    );
  });

  it("rejects negative amount", async () => {
    mockSupabase();
    await expect(updateActualExpense(VALID_UUID, -100)).rejects.toThrow(
      "จำนวนเงินต้องเป็นตัวเลขที่ไม่ติดลบ"
    );
  });

  it("rejects if travel request is not approved/completed", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const expenseLookup = createMockChain({ data: { travel_request_id: "tr-1" } });
    const requestLookup = createMockChain({ data: { status: "pending" } });

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "travel_expenses") return expenseLookup;
      if (table === "travel_requests") return requestLookup;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await expect(updateActualExpense(VALID_UUID, 100)).rejects.toThrow(
      "สถานะคำขอไม่เหมาะสม"
    );
  });

  it("rejects if expense not found", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const noExpense = createMockChain({ data: null });

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "travel_expenses") return noExpense;
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await expect(updateActualExpense(VALID_UUID, 100)).rejects.toThrow(
      "ไม่พบรายการค่าใช้จ่าย"
    );
  });
});

/* ── Read-only actions ────────────────────────────────────────────────── */

describe("getMyTravelRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const chain = createMockChain({ data: [{ id: "tr-1" }] });
    mockSupabase({ fromOverrides: { travel_requests: chain } });

    const result = await getMyTravelRequests();
    expect(result.data).toEqual([{ id: "tr-1" }]);
    expect(result.page).toBe(1);
  });

  it("throws on error", async () => {
    const chain = createMockChain({ data: null, error: { message: "err" } });
    mockSupabase({ fromOverrides: { travel_requests: chain } });

    await expect(getMyTravelRequests()).rejects.toThrow("ไม่สามารถดึงข้อมูลการเดินทางได้");
  });
});

describe("getAllTravelRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data for HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const travelChain = createMockChain({ data: [{ id: "tr-all" }] });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        travel_requests: travelChain,
      },
    });

    const result = await getAllTravelRequests();
    expect(result.data).toEqual([{ id: "tr-all" }]);
    expect(result.page).toBe(1);
  });

  it("rejects non-HR/admin/manager", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(getAllTravelRequests()).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("throws on DB error", async () => {
    const profileChain = createMockChain({ data: profileRow("admin") });
    const travelChain = createMockChain({ data: null, error: { message: "err" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        travel_requests: travelChain,
      },
    });

    await expect(getAllTravelRequests()).rejects.toThrow("ไม่สามารถดึงข้อมูลการเดินทางทั้งหมดได้");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockChain,
  createMockSupabase,
  TEST_USER,
  TEST_HR_USER,
  profileRow,
} from "./helpers";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  exportEmployees,
  exportLeaveRequests,
  exportTravelRequests,
} from "../export-actions";

const mockedCreateClient = vi.mocked(createClient);

function setupMock(overrides: Parameters<typeof createMockSupabase>[0] = {}) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as any);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------- exportEmployees ---------------------------------------------- */

describe("exportEmployees", () => {
  it("HR gets data without role field (H10 fix)", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const employeeData = [
      {
        full_name: "John Doe",
        title_th: "นาย",
        first_name_th: "จอห์น",
        last_name_th: "โด",
        title_en: "Mr.",
        first_name_en: "John",
        last_name_en: "Doe",
        email: "john@test.com",
        phone: "0812345678",
        status: "approved",
        position_number: "P001",
        position_title: "Developer",
        employee_type: "permanent",
        department_id: "d1",
        departments: { name: "IT" },
        hire_date: "2020-01-01",
      },
    ];
    // profiles is called twice: once for role check, once for data export
    const exportChain = createMockChain({ data: employeeData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    let profileCallCount = 0;
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        // First call is role check (returns via .single()), second is data export
        if (profileCallCount === 1) return profileChain;
        return exportChain;
      }
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await exportEmployees();
    expect(result).toHaveLength(1);
    // H10: no 'role' field in export
    expect(result[0]).not.toHaveProperty("role");
    expect(result[0].fullName).toBe("John Doe");
    expect(result[0].department).toBe("IT");
  });

  it("rejects non-HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(exportEmployees()).rejects.toThrow("Forbidden");
  });
});

/* ---------- exportLeaveRequests ------------------------------------------ */

describe("exportLeaveRequests", () => {
  it("HR gets data without reason field (H10 fix)", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveData = [
      {
        id: "lr-1",
        start_date: "2025-01-01",
        end_date: "2025-01-03",
        total_days: 3,
        status: "approved",
        submission_channel: "online",
        created_at: "2025-01-01T00:00:00Z",
        leave_types: { name: "Sick" },
        profiles: { full_name: "John Doe" },
      },
    ];
    const leaveChain = createMockChain({ data: leaveData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await exportLeaveRequests();
    expect(result).toHaveLength(1);
    // H10: no 'reason' field in export
    expect(result[0]).not.toHaveProperty("reason");
    expect(result[0].name).toBe("John Doe");
    expect(result[0].leaveType).toBe("Sick");
    expect(result[0].totalDays).toBe(3);
  });

  it("rejects non-HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(exportLeaveRequests()).rejects.toThrow("Forbidden");
  });
});

/* ---------- exportTravelRequests ----------------------------------------- */

describe("exportTravelRequests", () => {
  it("HR gets data with budget totals", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const travelData = [
      {
        id: "tr-1",
        travel_type: "training",
        title: "Workshop",
        location: "Bangkok",
        start_date: "2025-02-01",
        end_date: "2025-02-03",
        total_days: 3,
        status: "approved",
        submission_channel: "paper",
        created_at: "2025-02-01T00:00:00Z",
        profiles: { full_name: "Jane Smith" },
        travel_expenses: [
          { expense_category: "transport", estimated_amount: 1000, actual_amount: 900 },
          { expense_category: "lodging", estimated_amount: 2000, actual_amount: 1800 },
        ],
      },
    ];
    const travelChain = createMockChain({ data: travelData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "travel_requests") return travelChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await exportTravelRequests();
    expect(result).toHaveLength(1);
    expect(result[0].estimatedBudget).toBe(3000);
    expect(result[0].actualBudget).toBe(2700);
    expect(result[0].name).toBe("Jane Smith");
    expect(result[0].channel).toBe("paper");
  });

  it("rejects non-HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(exportTravelRequests()).rejects.toThrow("Forbidden");
  });
});

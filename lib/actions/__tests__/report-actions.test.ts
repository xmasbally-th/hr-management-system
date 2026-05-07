import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockChain,
  createMockSupabase,
  TEST_USER,
  TEST_HR_USER,
  TEST_ADMIN_USER,
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
  getDashboardStats,
  getLeaveBalanceSummary,
  getReportLeaveByType,
  getReportTravelBudget,
  getReportMonthlyLeaves,
  getRecentActivity,
  getCalendarEvents,
} from "../report-actions";

const mockedCreateClient = vi.mocked(createClient);

function setupMock(overrides: Parameters<typeof createMockSupabase>[0] = {}) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as any);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------- getDashboardStats -------------------------------------------- */

describe("getDashboardStats", () => {
  it("HR/admin gets full stats", async () => {
    const profileChain = createMockChain({ data: profileRow("hr"), count: 50 });
    const leaveChain = createMockChain({ data: null, count: 5 });
    const travelChain = createMockChain({ data: null, count: 3 });
    const notifChain = createMockChain({ data: null, count: 2 });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      if (table === "notifications") return notifChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getDashboardStats();
    expect(result.role).toBe("hr");
    expect(result.totalEmployees).toBe(50);
    expect(result.pendingLeaves).toBe(5);
    expect(result.pendingTravel).toBe(3);
  });

  it("employee gets only own stats (totalEmployees=0)", async () => {
    const profileChain = createMockChain({ data: profileRow("employee"), count: 0 });
    const leaveChain = createMockChain({ data: null, count: 1 });
    const travelChain = createMockChain({ data: null, count: 0 });
    const notifChain = createMockChain({ data: null, count: 4 });

    const sb = createMockSupabase({ authUser: TEST_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      if (table === "notifications") return notifChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getDashboardStats();
    expect(result.role).toBe("employee");
    // Employee path: profilesRes resolves with { count: 0 }
    expect(result.totalEmployees).toBe(0);
  });
});

/* ---------- getLeaveBalanceSummary --------------------------------------- */

describe("getLeaveBalanceSummary", () => {
  it("returns mapped balance data", async () => {
    const balanceData = [
      { leave_type_id: "lt-1", total_days: 10, used_days: 3, leave_types: { name: "Sick" } },
      { leave_type_id: "lt-2", total_days: 15, used_days: 5, leave_types: { name: "Vacation" } },
    ];
    const balanceChain = createMockChain({ data: balanceData });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { leave_balances: balanceChain },
    });

    const result = await getLeaveBalanceSummary();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      leaveType: "Sick",
      totalDays: 10,
      usedDays: 3,
      remainingDays: 7,
    });
    expect(result[1]).toEqual({
      leaveType: "Vacation",
      totalDays: 15,
      usedDays: 5,
      remainingDays: 10,
    });
  });
});

/* ---------- getReportLeaveByType ----------------------------------------- */

describe("getReportLeaveByType", () => {
  it("manager+ gets grouped data", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    const leaveData = [
      { leave_type_id: "lt-1", status: "pending", leave_types: { name: "Sick" } },
      { leave_type_id: "lt-1", status: "approved", leave_types: { name: "Sick" } },
      { leave_type_id: "lt-2", status: "rejected", leave_types: { name: "Vacation" } },
    ];
    const leaveChain = createMockChain({ data: leaveData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getReportLeaveByType();
    expect(result).toHaveLength(2);
    const sick = result.find((r: any) => r.name === "Sick");
    expect(sick).toEqual({ name: "Sick", pending: 1, approved: 1, rejected: 0 });
  });

  it("employee rejected", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getReportLeaveByType()).rejects.toThrow("Forbidden");
  });
});

/* ---------- getReportTravelBudget ---------------------------------------- */

describe("getReportTravelBudget", () => {
  it("manager+ gets grouped data", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const expenseData = [
      { expense_category: "transport", estimated_amount: 1000, actual_amount: 800 },
      { expense_category: "transport", estimated_amount: 500, actual_amount: 600 },
      { expense_category: "lodging", estimated_amount: 2000, actual_amount: 1800 },
    ];
    const expenseChain = createMockChain({ data: expenseData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "travel_expenses") return expenseChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getReportTravelBudget();
    expect(result).toHaveLength(2);
    const transport = result.find((r: any) => r.category === "transport");
    expect(transport).toEqual({ category: "transport", estimated: 1500, actual: 1400 });
  });

  it("employee rejected", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getReportTravelBudget()).rejects.toThrow("Forbidden");
  });
});

/* ---------- getReportMonthlyLeaves --------------------------------------- */

describe("getReportMonthlyLeaves", () => {
  it("returns 12 months", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    const leaveData = [
      { start_date: `${new Date().getFullYear()}-01-15`, status: "approved" },
      { start_date: `${new Date().getFullYear()}-01-20`, status: "approved" },
      { start_date: `${new Date().getFullYear()}-03-10`, status: "approved" },
    ];
    const leaveChain = createMockChain({ data: leaveData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getReportMonthlyLeaves();
    expect(result).toHaveLength(12);
    expect(result[0].count).toBe(2); // January
    expect(result[2].count).toBe(1); // March
    expect(result[5].count).toBe(0); // June
  });

  it("employee rejected", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getReportMonthlyLeaves()).rejects.toThrow("Forbidden");
  });
});

/* ---------- getRecentActivity -------------------------------------------- */

describe("getRecentActivity", () => {
  it("HR sees all activity", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveData = [
      {
        id: "l1",
        status: "pending",
        start_date: "2025-01-01",
        end_date: "2025-01-02",
        created_at: "2025-01-01T00:00:00Z",
        leave_types: { name: "Sick" },
        profiles: { first_name_th: "John", last_name_th: "Doe" },
      },
    ];
    const travelData = [
      {
        id: "t1",
        status: "approved",
        travel_type: "training",
        location: "Bangkok",
        created_at: "2025-01-02T00:00:00Z",
        profiles: { first_name_th: "Jane", last_name_th: "Smith" },
      },
    ];
    const leaveChain = createMockChain({ data: leaveData });
    const travelChain = createMockChain({ data: travelData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getRecentActivity();
    expect(result).toHaveLength(2);
    // Sorted descending by date — travel (Jan 2) first
    expect(result[0].type).toBe("travel");
    expect(result[1].type).toBe("leave");
  });

  it("employee sees only own activity", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    const leaveChain = createMockChain({ data: [] });
    const travelChain = createMockChain({ data: [] });

    const sb = createMockSupabase({ authUser: TEST_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getRecentActivity();
    expect(result).toEqual([]);
    // Verify .eq was called (filters for employee_id)
    expect(leaveChain.eq).toHaveBeenCalled();
    expect(travelChain.eq).toHaveBeenCalled();
  });
});

/* ---------- getCalendarEvents -------------------------------------------- */

describe("getCalendarEvents", () => {
  it("manager+ gets events", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    const leaveData = [
      {
        id: "l1",
        start_date: "2025-06-01",
        end_date: "2025-06-03",
        status: "approved",
        leave_types: { name: "Sick" },
        profiles: { first_name_th: "A", last_name_th: "B" },
      },
    ];
    const travelData = [
      {
        id: "t1",
        start_date: "2025-06-10",
        end_date: "2025-06-12",
        status: "pending",
        travel_type: "training",
        location: "Chiang Mai",
        profiles: { first_name_th: "C", last_name_th: "D" },
      },
    ];
    const leaveChain = createMockChain({ data: leaveData });
    const travelChain = createMockChain({ data: travelData });

    const sb = createMockSupabase({ authUser: TEST_HR_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getCalendarEvents(2025, 6);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "l1", type: "leave", label: "Sick" });
    expect(result[1]).toMatchObject({ id: "t1", type: "travel", label: "Chiang Mai" });
  });

  it("employee rejected", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getCalendarEvents(2025, 6)).rejects.toThrow("Forbidden");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockChain,
  createMockSupabase,
  TEST_USER,
  TEST_HR_USER,
  TEST_ADMIN_USER,
  profileRow,
  VALID_UUID,
  INVALID_UUID,
} from "./helpers";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getLeaveTypeSettings,
  updateLeaveType,
  getDepartmentList,
  getSystemStats,
} from "../settings-actions";

const mockedCreateClient = vi.mocked(createClient);

function setupMock(overrides: Parameters<typeof createMockSupabase>[0] = {}) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as any);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------- getLeaveTypeSettings ----------------------------------------- */

describe("getLeaveTypeSettings", () => {
  it("admin gets data", async () => {
    const profileChain = createMockChain({ data: profileRow("admin") });
    const leaveTypesData = [
      { id: "lt-1", name: "Sick", max_days_per_year: 30 },
      { id: "lt-2", name: "Vacation", max_days_per_year: 10 },
    ];
    const leaveTypesChain = createMockChain({ data: leaveTypesData });
    setupMock({
      authUser: TEST_ADMIN_USER,
      fromOverrides: { profiles: profileChain, leave_types: leaveTypesChain },
    });

    const result = await getLeaveTypeSettings();
    expect(result).toEqual(leaveTypesData);
  });

  it("rejects non-admin (employee)", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getLeaveTypeSettings()).rejects.toThrow("Forbidden");
  });

  it("allows HR (leave types are now master data)", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveTypeData = [{ id: "lt1", name: "Sick", max_days_per_year: 30 }];
    const leaveTypesChain = createMockChain({ data: leaveTypeData });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, leave_types: leaveTypesChain },
    });

    const result = await getLeaveTypeSettings();
    expect(result).toEqual(leaveTypeData);
  });

  it("rejects manager", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getLeaveTypeSettings()).rejects.toThrow("Forbidden");
  });
});

/* ---------- updateLeaveType ---------------------------------------------- */

describe("updateLeaveType", () => {
  it("valid update succeeds", async () => {
    const profileChain = createMockChain({ data: profileRow("admin") });
    const leaveTypesChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_ADMIN_USER,
      fromOverrides: { profiles: profileChain, leave_types: leaveTypesChain },
    });

    await updateLeaveType(VALID_UUID, { name: "Updated Sick", max_days_per_year: 15 });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/master-data");
  });

  it("rejects invalid UUID", async () => {
    await expect(
      updateLeaveType(INVALID_UUID, { name: "Test" })
    ).rejects.toThrow("รหัสประเภทลาไม่ถูกต้อง");
  });

  it("rejects empty name", async () => {
    await expect(
      updateLeaveType(VALID_UUID, { name: "   " })
    ).rejects.toThrow("ชื่อประเภทลาต้องมี 1-100 ตัวอักษร");
  });

  it("rejects name > 100 chars", async () => {
    const longName = "a".repeat(101);
    await expect(
      updateLeaveType(VALID_UUID, { name: longName })
    ).rejects.toThrow("ชื่อประเภทลาต้องมี 1-100 ตัวอักษร");
  });

  it("rejects max_days not integer", async () => {
    await expect(
      updateLeaveType(VALID_UUID, { max_days_per_year: 10.5 })
    ).rejects.toThrow("จำนวนวันต้องเป็นจำนวนเต็ม 0-365");
  });

  it("rejects max_days > 365", async () => {
    await expect(
      updateLeaveType(VALID_UUID, { max_days_per_year: 400 })
    ).rejects.toThrow("จำนวนวันต้องเป็นจำนวนเต็ม 0-365");
  });

  it("rejects non-admin", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(
      updateLeaveType(VALID_UUID, { name: "Test" })
    ).rejects.toThrow("Forbidden");
  });
});

/* ---------- getDepartmentList -------------------------------------------- */

describe("getDepartmentList", () => {
  it("admin gets data", async () => {
    const profileChain = createMockChain({ data: profileRow("admin") });
    const deptData = [{ id: "d1", name: "IT" }, { id: "d2", name: "HR" }];
    const deptChain = createMockChain({ data: deptData });
    setupMock({
      authUser: TEST_ADMIN_USER,
      fromOverrides: { profiles: profileChain, departments: deptChain },
    });

    const result = await getDepartmentList();
    expect(result).toEqual(deptData);
  });

  it("any authenticated user can read (used by profile/welcome forms)", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    const deptChain = createMockChain({ data: [] });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain, departments: deptChain },
    });

    const result = await getDepartmentList();
    expect(result).toEqual([]);
  });
});

/* ---------- getSystemStats ----------------------------------------------- */

describe("getSystemStats", () => {
  it("admin gets counts", async () => {
    const profileChain = createMockChain({ data: profileRow("admin"), count: 100 });
    const leaveChain = createMockChain({ data: null, count: 50 });
    const travelChain = createMockChain({ data: null, count: 30 });
    const deptChain = createMockChain({ data: null, count: 5 });

    const sb = createMockSupabase({ authUser: TEST_ADMIN_USER });
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      if (table === "departments") return deptChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getSystemStats();
    expect(result).toEqual({
      totalUsers: 100,
      totalLeaveRequests: 50,
      totalTravelRequests: 30,
      totalDepartments: 5,
    });
  });

  it("rejects non-admin", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getSystemStats()).rejects.toThrow("Forbidden");
  });
});

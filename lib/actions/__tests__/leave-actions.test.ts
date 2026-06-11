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

// getAdminClient() in leave-actions reads env then calls @supabase/supabase-js
// createClient. We mock both so tests that reach the success path (which
// reserves balance + creates document_tracking via the admin client) don't
// throw "Missing env" or hit the network.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      "select", "insert", "update", "upsert", "delete",
      "eq", "in", "gte", "lte", "order", "limit",
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    (chain as Record<string, unknown>).then = (
      resolve: (v: unknown) => void,
    ) => resolve({ data: null, error: null });
    return { from: vi.fn(() => chain) };
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "@/lib/actions/notification-actions";

import {
  createLeaveRequest,
  createLeaveRequestByHr,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getMyLeaveRequests,
  getMyLeaveBalances,
  getAllLeaveRequests,
  getLeaveTypes,
  getEmployeesForSelection,
  markDirectorSigned,
  markDeanSigned,
  rejectLeaveAtStage,
  type CreateLeaveRequestInput,
} from "../leave-actions";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const REQUEST_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function validInput(overrides: Partial<CreateLeaveRequestInput> = {}): CreateLeaveRequestInput {
  return {
    leave_type_id: VALID_UUID,
    start_date: "2026-06-01",
    end_date: "2026-06-03",
    total_days: 3,
    reason: "Personal matters",
    contact_number: "0812345678",
    submission_channel: "digital",
    ...overrides,
  };
}

function mockSupabase(overrides: MockClientOverrides = {}) {
  const sb = createMockSupabase(overrides);
  vi.mocked(createClient).mockResolvedValue(sb as never);
  return sb;
}

/* ── createLeaveRequest ───────────────────────────────────────────────── */

describe("createLeaveRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { success: true, id } on success", async () => {
    const leaveChain = createMockChain({
      data: { id: "req-1", employee_id: "user-1" },
    });
    const hrChain = createMockChain({ data: [{ id: "hr-1" }] });

    const sb = mockSupabase({
      fromOverrides: {
        leave_requests: leaveChain,
        profiles: hrChain,
      },
    });

    const result = await createLeaveRequest(validInput());
    expect(result).toEqual({ success: true, id: "req-1" });
    expect(sb.from).toHaveBeenCalledWith("leave_requests");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("sends notifications to HR users on success", async () => {
    const leaveChain = createMockChain({
      data: { id: "req-1", employee_id: "user-1" },
    });
    const hrChain = createMockChain({ data: [{ id: "hr-1" }, { id: "hr-2" }] });

    mockSupabase({
      fromOverrides: {
        leave_requests: leaveChain,
        profiles: hrChain,
      },
    });

    await createLeaveRequest(validInput());
    expect(createNotificationInternal).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid UUID for leave_type_id", async () => {
    mockSupabase();
    await expect(createLeaveRequest(validInput({ leave_type_id: INVALID_UUID }))).rejects.toThrow(
      "รหัสประเภทลาไม่ถูกต้อง"
    );
  });

  it("rejects if start_date > end_date", async () => {
    mockSupabase();
    await expect(
      createLeaveRequest(validInput({ start_date: "2026-06-05", end_date: "2026-06-01" }))
    ).rejects.toThrow("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  });

  it("rejects if total_days <= 0", async () => {
    mockSupabase();
    await expect(createLeaveRequest(validInput({ total_days: 0 }))).rejects.toThrow(
      "จำนวนวันต้องมากกว่า 0"
    );
  });

  it("rejects invalid date format", async () => {
    mockSupabase();
    await expect(
      createLeaveRequest(validInput({ start_date: "06/01/2026" }))
    ).rejects.toThrow("รูปแบบวันที่ไม่ถูกต้อง");
  });

  it("throws generic error (not DB details) on insert failure", async () => {
    const leaveChain = createMockChain({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });

    mockSupabase({ fromOverrides: { leave_requests: leaveChain } });

    await expect(createLeaveRequest(validInput())).rejects.toThrow(
      "ไม่สามารถส่งคำขอลาได้"
    );
  });
});

/* ── createLeaveRequestByHr ───────────────────────────────────────────── */

describe("createLeaveRequestByHr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds with valid employee when caller is HR", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    // For validateEmployeeExists + enforceLeaveTypeRules employee-profile read.
    const employeeCheckChain = createMockChain({ data: { id: VALID_UUID } });
    // The HR-notification list query (`.in("role", ["hr","admin"])`) is
    // awaited without `.single()` — chain.then resolves data as an array.
    const hrListChain = createMockChain({ data: [{ id: "hr-1" }] });
    const leaveChain = createMockChain({
      data: { id: "req-2", employee_id: VALID_UUID },
    });

    // from("profiles") sequence: 1=getProfile(role check),
    // 2=validateEmployeeExists, 3=enforceLeaveTypeRules emp profile,
    // 4=HR notification list (uses .in, no .single).
    let profileCallCount = 0;
    const sb = createMockSupabase({
      authUser: { id: "hr-1" },
    });
    sb.from = vi.fn((table: string) => {
      if (table === "leave_requests") return leaveChain;
      if (table === "profiles") {
        profileCallCount++;
        if (profileCallCount === 1) return profileChain;
        if (profileCallCount >= 4) return hrListChain;
        return employeeCheckChain;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const result = await createLeaveRequestByHr(VALID_UUID, validInput());
    expect(result).toEqual({ success: true, id: "req-2" });
  });

  it("rejects if caller is not HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(
      createLeaveRequestByHr(VALID_UUID, validInput())
    ).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("rejects if employeeId is invalid UUID", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    mockSupabase({
      authUser: { id: "hr-1" },
      fromOverrides: { profiles: profileChain },
    });

    await expect(
      createLeaveRequestByHr(INVALID_UUID, validInput())
    ).rejects.toThrow("รหัสพนักงานไม่ถูกต้อง");
  });

  it("rejects if employee does not exist or is not approved", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    // validateEmployeeExists returns null (employee not found)
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

    await expect(
      createLeaveRequestByHr(VALID_UUID, validInput())
    ).rejects.toThrow("ไม่พบพนักงานในระบบ");
  });

  it("validates dates same as createLeaveRequest", async () => {
    mockSupabase();
    await expect(
      createLeaveRequestByHr(VALID_UUID, validInput({ start_date: "2026-06-05", end_date: "2026-06-01" }))
    ).rejects.toThrow("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  });
});

/* ── approveLeaveRequest ──────────────────────────────────────────────── */

describe("approveLeaveRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status to approved atomically with status guard", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: { employee_id: "emp-1" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await approveLeaveRequest(REQUEST_ID);
    expect(leaveChain.update).toHaveBeenCalled();
    expect(leaveChain.eq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(leaveChain.eq).toHaveBeenCalledWith("status", "pending");
    expect(leaveChain.single).toHaveBeenCalled();
  });

  it("sends notification to employee on success", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: { employee_id: "emp-1" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await approveLeaveRequest(REQUEST_ID);
    expect(createNotificationInternal).toHaveBeenCalledWith(
      expect.anything(),
      "emp-1",
      "leave_approved",
      expect.any(String)
    );
  });

  it("rejects invalid UUID", async () => {
    mockSupabase();
    await expect(approveLeaveRequest(INVALID_UUID)).rejects.toThrow("รหัสคำขอไม่ถูกต้อง");
  });

  it("rejects if caller is not HR/admin/manager", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(approveLeaveRequest(REQUEST_ID)).rejects.toThrow(
      "Forbidden: Insufficient permissions"
    );
  });

  it("throws if request is not pending (already processed)", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    const leaveChain = createMockChain({
      data: null,
      error: { message: "No rows returned" },
    });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await expect(approveLeaveRequest(REQUEST_ID)).rejects.toThrow("อาจถูกดำเนินการแล้ว");
  });
});

/* ── rejectLeaveRequest ───────────────────────────────────────────────── */

describe("rejectLeaveRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status to rejected with status guard", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: { employee_id: "emp-1" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await rejectLeaveRequest(REQUEST_ID, "Insufficient balance");
    expect(leaveChain.update).toHaveBeenCalled();
    expect(leaveChain.eq).toHaveBeenCalledWith("status", "pending");
    expect(createNotificationInternal).toHaveBeenCalledWith(
      expect.anything(),
      "emp-1",
      "leave_rejected",
      expect.any(String)
    );
  });

  it("throws if already processed", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: null, error: { message: "conflict" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await expect(rejectLeaveRequest(REQUEST_ID)).rejects.toThrow("อาจถูกดำเนินการแล้ว");
  });
});

/* ── cancelLeaveRequest ───────────────────────────────────────────────── */

describe("cancelLeaveRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockCancel(role: string, status = "pending") {
    const profileChain = createMockChain({ data: profileRow(role) });
    const leaveChain = createMockChain({
      data: {
        id: REQUEST_ID,
        status,
        employee_id: "emp-1",
        leave_type_id: "lt-1",
        working_days: 1,
        total_days: 1,
      },
    });
    mockSupabase({
      fromOverrides: { profiles: profileChain, leave_requests: leaveChain },
    });
    return leaveChain;
  }

  it("HR cancels a faculty-level (pending) request with a reason", async () => {
    const leaveChain = mockCancel("hr");
    await cancelLeaveRequest(REQUEST_ID, "พนักงานแจ้งของดลา");
    expect(leaveChain.update).toHaveBeenCalled();
    expect(leaveChain.eq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(leaveChain.eq).toHaveBeenCalledWith("status", "pending");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("rejects when the caller is not HR/Admin (even the owner)", async () => {
    mockCancel("employee");
    await expect(cancelLeaveRequest(REQUEST_ID, "เหตุผล")).rejects.toThrow(/Forbidden/);
  });

  it("rejects when no reason is given", async () => {
    mockCancel("hr");
    await expect(cancelLeaveRequest(REQUEST_ID, "   ")).rejects.toThrow(/กรุณาระบุเหตุผล/);
  });

  it("rejects once the leave has been sent to the university", async () => {
    mockCancel("hr", "awaiting_university");
    await expect(cancelLeaveRequest(REQUEST_ID, "เหตุผล")).rejects.toThrow(/ส่งให้มหาวิทยาลัยแล้ว/);
  });
});

/* ── Read-only actions ────────────────────────────────────────────────── */

describe("getLeaveTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const chain = createMockChain({ data: [{ id: "lt-1", name: "Sick" }] });
    mockSupabase({ fromOverrides: { leave_types: chain } });

    const result = await getLeaveTypes();
    expect(result).toEqual([{ id: "lt-1", name: "Sick" }]);
  });

  it("throws on error", async () => {
    const chain = createMockChain({ data: null, error: { message: "db error" } });
    mockSupabase({ fromOverrides: { leave_types: chain } });

    await expect(getLeaveTypes()).rejects.toThrow("ไม่สามารถดึงข้อมูลประเภทการลาได้");
  });
});

describe("getMyLeaveRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const chain = createMockChain({ data: [{ id: "req-1" }] });
    mockSupabase({ fromOverrides: { leave_requests: chain } });

    const result = await getMyLeaveRequests();
    expect(result.data).toEqual([{ id: "req-1" }]);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("throws on error", async () => {
    const chain = createMockChain({ data: null, error: { message: "err" } });
    mockSupabase({ fromOverrides: { leave_requests: chain } });

    await expect(getMyLeaveRequests()).rejects.toThrow("ไม่สามารถดึงข้อมูลการลาได้");
  });
});

describe("getMyLeaveBalances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const chain = createMockChain({ data: [{ id: "bal-1" }] });
    mockSupabase({ fromOverrides: { leave_balances: chain } });

    const result = await getMyLeaveBalances();
    expect(result).toEqual([{ id: "bal-1" }]);
  });

  it("throws on error", async () => {
    const chain = createMockChain({ data: null, error: { message: "err" } });
    mockSupabase({ fromOverrides: { leave_balances: chain } });

    await expect(getMyLeaveBalances()).rejects.toThrow("ไม่สามารถดึงข้อมูลวันลาคงเหลือได้");
  });
});

describe("getAllLeaveRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data for HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: [{ id: "req-all" }] });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    const result = await getAllLeaveRequests();
    expect(result.data).toEqual([{ id: "req-all" }]);
    expect(result.page).toBe(1);
  });

  it("rejects non-HR/admin/manager", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(getAllLeaveRequests()).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("throws on DB error", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const leaveChain = createMockChain({ data: null, error: { message: "err" } });

    mockSupabase({
      fromOverrides: {
        profiles: profileChain,
        leave_requests: leaveChain,
      },
    });

    await expect(getAllLeaveRequests()).rejects.toThrow("ไม่สามารถดึงข้อมูลการลาทั้งหมดได้");
  });
});

describe("getEmployeesForSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data for HR user", async () => {
    const profileRoleChain = createMockChain({ data: profileRow("hr") });
    const employeeListChain = createMockChain({ data: [{ id: "e-1", full_name: "Jane" }] });

    let profileCallCount = 0;
    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        return profileCallCount === 1 ? profileRoleChain : employeeListChain;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    const result = await getEmployeesForSelection();
    expect(result).toEqual([{ id: "e-1", full_name: "Jane" }]);
  });

  it("rejects non-HR/admin", async () => {
    const profileChain = createMockChain({ data: profileRow("manager") });
    mockSupabase({ fromOverrides: { profiles: profileChain } });

    await expect(getEmployeesForSelection()).rejects.toThrow("Forbidden: Insufficient permissions");
  });

  it("throws on DB error", async () => {
    // getProfile returns hr, but the second profiles call errors
    let callCount = 0;
    const hrProfile = createMockChain({ data: profileRow("hr") });
    const errChain = createMockChain({ data: null, error: { message: "err" } });

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        callCount++;
        return callCount === 1 ? hrProfile : errChain;
      }
      return createMockChain();
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);

    await expect(getEmployeesForSelection()).rejects.toThrow("ไม่สามารถดึงรายชื่อพนักงานได้");
  });
});

/* ── workflow stage authorization (runLeaveStage) ─────────────────────── */

describe("workflow stage authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockStage(opts: {
    actorId: string;
    role: string;
    status: string;
    approverUserId?: string; // workflow_approvers.user_id for the stage
    actingDelegates?: string[]; // acting_delegations delegate ids
    employeeDeptId?: string | null;
  }) {
    const sb = createMockSupabase({
      authUser: { id: opts.actorId },
      fromOverrides: {
        profiles: createMockChain({
          data: { role: opts.role, department_id: opts.employeeDeptId ?? null },
        }),
        leave_requests: createMockChain({
          data: { employee_id: "emp-1", leave_type_id: VALID_UUID, status: opts.status },
        }),
        workflow_approvers: createMockChain({
          data: opts.approverUserId ? { user_id: opts.approverUserId } : null,
        }),
        acting_delegations: createMockChain({
          data: (opts.actingDelegates ?? []).map((id) => ({ delegate_user_id: id })),
        }),
      },
    });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    return sb;
  }

  // director stage — markDirectorSigned has no status change, so the mutation
  // path is a clean no-op under the admin mock (isolates the authz check).

  it("HR may sign the director stage", async () => {
    mockStage({ actorId: "hr-1", role: "hr", status: "awaiting_director" });
    await expect(markDirectorSigned(REQUEST_ID)).resolves.toBeUndefined();
  });

  it("the designated director (a non-HR manager) may sign their own stage", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_director", approverUserId: "mgr-1" });
    await expect(markDirectorSigned(REQUEST_ID)).resolves.toBeUndefined();
  });

  it("a non-HR user who is not the designated approver is forbidden", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_director", approverUserId: "someone-else" });
    await expect(markDirectorSigned(REQUEST_ID)).rejects.toThrow(/Forbidden/);
  });

  it("a non-HR user with no approver assigned for the role is forbidden", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_director" });
    await expect(markDirectorSigned(REQUEST_ID)).rejects.toThrow(/Forbidden/);
  });

  it("rejects when the request is not at the expected stage", async () => {
    mockStage({ actorId: "hr-1", role: "hr", status: "pending" });
    await expect(markDirectorSigned(REQUEST_ID)).rejects.toThrow(/สถานะไม่ถูกต้อง/);
  });

  // dean stage — รักษาราชการแทน (acting delegation)

  it("an active acting-delegate passes dean authorization (reaches the mutation)", async () => {
    // dean is dean-x; mgr-1 is an active delegate → authz passes, then the
    // status mutation (admin mock no-op) fails — proving authz succeeded.
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_dean", approverUserId: "dean-x", actingDelegates: ["mgr-1"] });
    await expect(markDeanSigned(REQUEST_ID)).rejects.toThrow(/ไม่สามารถดำเนินการได้/);
  });

  it("a non-delegate non-dean is forbidden at the dean stage", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_dean", approverUserId: "dean-x", actingDelegates: [] });
    await expect(markDeanSigned(REQUEST_ID)).rejects.toThrow(/Forbidden/);
  });

  // reject at stage — designated approver may reject their own stage

  it("the designated director may reject at their stage (reaches the mutation)", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_director", approverUserId: "mgr-1" });
    await expect(rejectLeaveAtStage(REQUEST_ID, "director", "ไม่เหมาะสม")).rejects.toThrow(/ไม่สามารถปฏิเสธ/);
  });

  it("a non-approver may not reject a stage", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_director", approverUserId: "someone-else" });
    await expect(rejectLeaveAtStage(REQUEST_ID, "director", "x")).rejects.toThrow(/Forbidden/);
  });

  it("an approver may not reject a stage the request is not at", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "awaiting_dean", approverUserId: "mgr-1" });
    await expect(rejectLeaveAtStage(REQUEST_ID, "director", "x")).rejects.toThrow(/สถานะไม่ถูกต้อง/);
  });

  it("a non-HR user may not reject at the HR level", async () => {
    mockStage({ actorId: "mgr-1", role: "manager", status: "pending" });
    await expect(rejectLeaveAtStage(REQUEST_ID, "hr", "x")).rejects.toThrow(/Forbidden/);
  });
});

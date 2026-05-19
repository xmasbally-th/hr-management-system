import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockChain, createMockSupabase, profileRow } from "./helpers";

// ---- module mocks ----
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  getProfiles,
  updateUserStatus,
  updateUserRole,
  createUserByAdmin,
} from "../user-actions";

const mockedCreateClient = vi.mocked(createClient);
const mockedSupabaseClient = vi.mocked(createSupabaseClient);

/** Set up the normal (SSR) supabase mock */
function setSupabase(
  overrides: Parameters<typeof createMockSupabase>[0] = {},
) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

/** Build an admin supabase mock for createUserByAdmin */
function setAdminSupabase(opts: {
  createUserResult?: { data: unknown; error: unknown };
  deleteUserResult?: { data: unknown; error: unknown };
  profileInsertError?: { message: string } | null;
} = {}) {
  const profileChain = createMockChain({
    error: opts.profileInsertError ?? null,
  });

  const adminSb = {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue(
          opts.createUserResult ?? { data: { user: { id: "new-user-1" } }, error: null },
        ),
        deleteUser: vi.fn().mockResolvedValue(
          opts.deleteUserResult ?? { data: null, error: null },
        ),
      },
    },
    from: vi.fn().mockReturnValue(profileChain),
  };

  mockedSupabaseClient.mockReturnValue(adminSb as never);
  return adminSb;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Set env vars that createUserByAdmin needs
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

// Helper: set up an HR-authed SSR client
function setHrClient() {
  return setSupabase({
    authUser: { id: "hr-1", email: "hr@example.com" },
    fromOverrides: {
      profiles: createMockChain({ data: profileRow("hr") }),
    },
  });
}

// ===================================================================
// getProfiles
// ===================================================================
describe("getProfiles", () => {
  it("HR/admin gets data", async () => {
    const profilesData = [{ id: "u1", full_name: "Test" }];
    const profilesChain = createMockChain({ data: profileRow("hr") });
    // The profiles table is called twice: once for role check, once for listing.
    // We need to return the role check first, then the listing.
    let callCount = 0;
    const listChain = createMockChain({ data: profilesData });

    const sb = createMockSupabase({
      authUser: { id: "hr-1" },
    });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        callCount++;
        // First call is the role check (uses .single()), second is listing
        if (callCount === 1) return profilesChain as never;
        return listChain as never;
      }
      return createMockChain() as never;
    });
    mockedCreateClient.mockResolvedValue(sb as never);

    const result = await getProfiles();
    expect(result.data).toEqual(profilesData);
    expect(result.page).toBe(1);
  });

  it("employee is rejected", async () => {
    setSupabase({
      authUser: { id: "emp-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("employee") }),
      },
    });

    await expect(getProfiles()).rejects.toThrow("Forbidden");
  });

  it("unauthenticated is rejected", async () => {
    setSupabase({ authUser: null });
    await expect(getProfiles()).rejects.toThrow("Unauthorized");
  });
});

// ===================================================================
// updateUserStatus
// ===================================================================
describe("updateUserStatus", () => {
  it("HR/admin updates status", async () => {
    const profilesChain = createMockChain({ data: profileRow("hr") });
    let callCount = 0;
    const updateChain = createMockChain();

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        callCount++;
        if (callCount === 1) return profilesChain as never;
        return updateChain as never;
      }
      return createMockChain() as never;
    });
    mockedCreateClient.mockResolvedValue(sb as never);

    await updateUserStatus("user-x", "approved" as never);

    expect(updateChain.update).toHaveBeenCalledWith({ status: "approved" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "user-x");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/users");
  });

  it("non-HR is rejected", async () => {
    setSupabase({
      authUser: { id: "emp-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("employee") }),
      },
    });

    await expect(updateUserStatus("u1", "approved" as never)).rejects.toThrow("Forbidden");
  });

  it("throws on DB error", async () => {
    const profilesChain = createMockChain({ data: profileRow("hr") });
    let callCount = 0;
    const updateChain = createMockChain({ error: { message: "DB fail" } });

    const sb = createMockSupabase({ authUser: { id: "hr-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        callCount++;
        if (callCount === 1) return profilesChain as never;
        return updateChain as never;
      }
      return createMockChain() as never;
    });
    mockedCreateClient.mockResolvedValue(sb as never);

    await expect(updateUserStatus("u1", "approved" as never)).rejects.toThrow("Failed to update status");
  });
});

// ===================================================================
// updateUserRole
// ===================================================================
describe("updateUserRole", () => {
  it("HR/admin updates role", async () => {
    const profilesChain = createMockChain({ data: profileRow("admin") });
    let callCount = 0;
    const updateChain = createMockChain();

    const sb = createMockSupabase({ authUser: { id: "admin-1" } });
    sb.from = vi.fn((table: string) => {
      if (table === "profiles") {
        callCount++;
        if (callCount === 1) return profilesChain as never;
        return updateChain as never;
      }
      return createMockChain() as never;
    });
    mockedCreateClient.mockResolvedValue(sb as never);

    await updateUserRole("user-x", "manager" as never);

    expect(updateChain.update).toHaveBeenCalledWith({ role: "manager" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/users");
  });

  it("non-HR is rejected", async () => {
    setSupabase({
      authUser: { id: "emp-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("employee") }),
      },
    });

    await expect(updateUserRole("u1", "hr" as never)).rejects.toThrow("Forbidden");
  });
});

// ===================================================================
// createUserByAdmin
// ===================================================================
describe("createUserByAdmin", () => {
  const newUserData = {
    email: "new@example.com",
    fullName: "New User",
    role: "employee" as never,
    departmentId: "dept-1",
    // Cross-field validation tested in a dedicated case below — keep
    // the shared fixture position-free so generic flows don't trip the
    // positions lookup.
    positionId: null,
  };

  it("creates auth user + profile", async () => {
    setHrClient();
    const adminSb = setAdminSupabase();

    const result = await createUserByAdmin(newUserData);

    expect(result).toEqual({ success: true });
    expect(adminSb.auth.admin.createUser).toHaveBeenCalled();
    expect(adminSb.from).toHaveBeenCalledWith("profiles");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/users");
  });

  it("non-HR is rejected", async () => {
    setSupabase({
      authUser: { id: "emp-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("employee") }),
      },
    });

    await expect(createUserByAdmin(newUserData)).rejects.toThrow("Forbidden");
  });

  it("throws on missing SERVICE_ROLE_KEY", async () => {
    setHrClient();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(createUserByAdmin(newUserData)).rejects.toThrow("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rolls back auth user if profile insert fails", async () => {
    setHrClient();
    const adminSb = setAdminSupabase({
      profileInsertError: { message: "unique violation" },
    });

    await expect(createUserByAdmin(newUserData)).rejects.toThrow("บันทึกข้อมูลพนักงานไม่สำเร็จ");
    expect(adminSb.auth.admin.deleteUser).toHaveBeenCalledWith("new-user-1");
  });

  it("handles 'already registered' error", async () => {
    setHrClient();
    setAdminSupabase({
      createUserResult: {
        data: { user: null },
        error: { message: "User already registered", status: 422 },
      },
    });

    await expect(createUserByAdmin(newUserData)).rejects.toThrow("อีเมลนี้มีอยู่ในระบบแล้ว");
  });

  it("rejects positionId without departmentId", async () => {
    setHrClient();
    await expect(
      createUserByAdmin({ ...newUserData, departmentId: null, positionId: "pos-1" }),
    ).rejects.toThrow("ต้องเลือกแผนกก่อน");
  });

  it("rejects position not belonging to selected department", async () => {
    // Position belongs to dept-2 but user picked dept-1
    setSupabase({
      authUser: { id: "hr-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("hr") }),
        positions: createMockChain({
          data: { id: "pos-1", department_id: "dept-2" },
        }),
      },
    });

    await expect(
      createUserByAdmin({
        ...newUserData,
        departmentId: "dept-1",
        positionId: "pos-1",
      }),
    ).rejects.toThrow("ตำแหน่งที่เลือกไม่ได้อยู่ในแผนกที่เลือก");
  });

  it("accepts position that does belong to selected department", async () => {
    setSupabase({
      authUser: { id: "hr-1" },
      fromOverrides: {
        profiles: createMockChain({ data: profileRow("hr") }),
        positions: createMockChain({
          data: { id: "pos-1", department_id: "dept-1" },
        }),
      },
    });
    setAdminSupabase();

    const result = await createUserByAdmin({
      ...newUserData,
      departmentId: "dept-1",
      positionId: "pos-1",
    });
    expect(result).toEqual({ success: true });
  });
});

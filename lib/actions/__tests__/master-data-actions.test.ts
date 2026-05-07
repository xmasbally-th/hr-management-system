import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockChain, createMockSupabase, profileRow } from "./helpers";

// ---- module mocks ----
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getDepartments,
  getPositions,
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
} from "../master-data-actions";

const mockedCreateClient = vi.mocked(createClient);

/**
 * Build a supabase mock where the first .from("profiles") call returns the
 * role-check result and subsequent calls hit the given `tableChain`.
 */
function setHrClientWithTable(
  table: string,
  tableChain: ReturnType<typeof createMockChain>,
  role = "hr",
) {
  const roleChain = createMockChain({ data: profileRow(role) });
  let profileCallCount = 0;

  const sb = createMockSupabase({ authUser: { id: "hr-1" } });
  sb.from = vi.fn((t: string) => {
    if (t === "profiles") {
      profileCallCount++;
      return roleChain as never;
    }
    if (t === table) return tableChain as never;
    return createMockChain() as never;
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

function setEmployeeClient() {
  const sb = createMockSupabase({
    authUser: { id: "emp-1" },
    fromOverrides: {
      profiles: createMockChain({ data: profileRow("employee") }),
    },
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

function setNonHrClient() {
  const sb = createMockSupabase({
    authUser: { id: "mgr-1" },
    fromOverrides: {
      profiles: createMockChain({ data: profileRow("manager") }),
    },
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===================================================================
// getDepartments
// ===================================================================
describe("getDepartments", () => {
  it("HR/admin gets data", async () => {
    const rows = [{ id: "d1", name: "IT" }];
    const chain = createMockChain({ data: rows });
    setHrClientWithTable("departments", chain);

    const result = await getDepartments();
    expect(result).toEqual(rows);
  });

  it("non-HR is rejected", async () => {
    setEmployeeClient();
    await expect(getDepartments()).rejects.toThrow("Forbidden");
  });
});

// ===================================================================
// getPositions
// ===================================================================
describe("getPositions", () => {
  it("HR/admin gets data", async () => {
    const rows = [{ id: "p1", name: "Engineer" }];
    const chain = createMockChain({ data: rows });
    setHrClientWithTable("positions", chain);

    const result = await getPositions();
    expect(result).toEqual(rows);
  });

  it("non-HR is rejected", async () => {
    setNonHrClient();
    await expect(getPositions()).rejects.toThrow("Forbidden");
  });
});

// ===================================================================
// createDepartment
// ===================================================================
describe("createDepartment", () => {
  it("HR creates a department", async () => {
    const chain = createMockChain();
    const sb = setHrClientWithTable("departments", chain);

    await createDepartment("Finance");

    expect(chain.insert).toHaveBeenCalledWith({ name: "Finance" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/master-data");
  });

  it("non-HR is rejected", async () => {
    setEmployeeClient();
    await expect(createDepartment("Finance")).rejects.toThrow("Forbidden");
  });

  it("throws on DB error", async () => {
    const chain = createMockChain({ error: { message: "duplicate" } });
    setHrClientWithTable("departments", chain);

    await expect(createDepartment("Finance")).rejects.toThrow("Failed to create department");
  });
});

// ===================================================================
// createPosition
// ===================================================================
describe("createPosition", () => {
  it("HR creates a position", async () => {
    const chain = createMockChain();
    setHrClientWithTable("positions", chain);

    await createPosition("Developer", "dept-1");

    expect(chain.insert).toHaveBeenCalledWith({ name: "Developer", department_id: "dept-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/master-data");
  });

  it("non-HR is rejected", async () => {
    setNonHrClient();
    await expect(createPosition("Dev", "d1")).rejects.toThrow("Forbidden");
  });
});

// ===================================================================
// deleteDepartment
// ===================================================================
describe("deleteDepartment", () => {
  it("HR deletes a department", async () => {
    const chain = createMockChain();
    setHrClientWithTable("departments", chain);

    await deleteDepartment("dept-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "dept-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/master-data");
  });

  it("non-HR is rejected", async () => {
    setEmployeeClient();
    await expect(deleteDepartment("dept-1")).rejects.toThrow("Forbidden");
  });

  it("throws on DB error (in use)", async () => {
    const chain = createMockChain({ error: { message: "foreign key" } });
    setHrClientWithTable("departments", chain);

    await expect(deleteDepartment("dept-1")).rejects.toThrow("Failed to delete department");
  });
});

// ===================================================================
// deletePosition
// ===================================================================
describe("deletePosition", () => {
  it("HR deletes a position", async () => {
    const chain = createMockChain();
    setHrClientWithTable("positions", chain);

    await deletePosition("pos-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "pos-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/master-data");
  });

  it("non-HR is rejected", async () => {
    setNonHrClient();
    await expect(deletePosition("pos-1")).rejects.toThrow("Forbidden");
  });
});

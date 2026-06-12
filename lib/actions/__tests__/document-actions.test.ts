import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockChain,
  createMockSupabase,
  TEST_USER,
  TEST_HR_USER,
  profileRow,
  VALID_UUID,
} from "./helpers";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/actions/notification-actions", () => ({
  createNotificationInternal: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "@/lib/actions/notification-actions";
import {
  getAllDocumentTracking,
  getMyDocuments,
  getDocumentsByReference,
  createDocumentTracking,
  updateSentForSignature,
  updateReturnedDate,
  updateScannedDate,
  updateSentToAgency,
  updateDocumentNotes,
  deleteDocumentTracking,
} from "../document-actions";

const mockedCreateClient = vi.mocked(createClient);

function setupMock(overrides: Parameters<typeof createMockSupabase>[0] = {}) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as any);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------- getAllDocumentTracking ---------------------------------------- */

describe("getAllDocumentTracking", () => {
  it("returns data for HR user", async () => {
    const docs = [{ id: "d1" }, { id: "d2" }];
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: docs });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    const result = await getAllDocumentTracking();
    expect(result).toEqual(docs);
  });

  it("returns data for manager user (read-only merged view)", async () => {
    const docs = [{ id: "d1" }];
    const profileChain = createMockChain({ data: profileRow("manager") });
    const docChain = createMockChain({ data: docs });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    const result = await getAllDocumentTracking();
    expect(result).toEqual(docs);
  });

  it("rejects employee user", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(getAllDocumentTracking()).rejects.toThrow("Forbidden");
  });
});

/* ---------- getMyDocuments ----------------------------------------------- */

describe("getMyDocuments", () => {
  it("returns docs matching user leave/travel IDs", async () => {
    const leaveChain = createMockChain({ data: [{ id: "leave-1" }] });
    const travelChain = createMockChain({ data: [{ id: "travel-1" }] });
    const docTrackingChain = createMockChain({ data: [{ id: "dt-1", reference_id: "leave-1" }] });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: {
        leave_requests: leaveChain,
        travel_requests: travelChain,
        document_tracking: docTrackingChain,
      },
    });

    const result = await getMyDocuments();
    expect(result).toEqual([{ id: "dt-1", reference_id: "leave-1" }]);
  });

  it("returns empty array if no requests", async () => {
    const leaveChain = createMockChain({ data: [] });
    const travelChain = createMockChain({ data: [] });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: {
        leave_requests: leaveChain,
        travel_requests: travelChain,
      },
    });

    const result = await getMyDocuments();
    expect(result).toEqual([]);
  });
});

/* ---------- getDocumentsByReference -------------------------------------- */

describe("getDocumentsByReference", () => {
  it("HR can view any reference", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: [{ id: "dt-1" }] });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    const result = await getDocumentsByReference("some-ref");
    expect(result).toEqual([{ id: "dt-1" }]);
  });

  it("employee can view own reference", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    const leaveChain = createMockChain({ data: [{ id: "ref-1" }] });
    const travelChain = createMockChain({ data: [] });
    const docChain = createMockChain({ data: [{ id: "dt-1" }] });

    const sb = createMockSupabase({ authUser: TEST_USER });
    // Need to return different chains per table
    let fromCallCount: Record<string, number> = {};
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      fromCallCount[table] = (fromCallCount[table] || 0) + 1;
      if (table === "profiles") return profileChain;
      if (table === "leave_requests") return leaveChain;
      if (table === "travel_requests") return travelChain;
      if (table === "document_tracking") return docChain;
      return createMockChain();
    });
    mockedCreateClient.mockResolvedValue(sb as any);

    const result = await getDocumentsByReference("ref-1");
    expect(result).toEqual([{ id: "dt-1" }]);
  });

  it("employee blocked from other's docs", async () => {
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

    await expect(getDocumentsByReference("other-ref")).rejects.toThrow("Forbidden");
  });
});

/* ---------- createDocumentTracking --------------------------------------- */

describe("createDocumentTracking", () => {
  it("HR creates document tracking", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await createDocumentTracking({ reference_id: "ref-1", document_type: "leave" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR user", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(
      createDocumentTracking({ reference_id: "ref-1", document_type: "leave" })
    ).rejects.toThrow("Forbidden");
  });
});

/* ---------- updateSentForSignature --------------------------------------- */

describe("updateSentForSignature", () => {
  it("HR updates successfully", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await updateSentForSignature("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(updateSentForSignature("doc-1")).rejects.toThrow("Forbidden");
  });

  it("notifies the leave owner after stamping", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    // Same chain answers both the update and the helper's select.single().
    const docChain = createMockChain({
      data: { reference_id: "leave-1", document_type: "leave" },
      error: null,
    });
    const leaveChain = createMockChain({ data: { employee_id: "emp-1" } });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: {
        profiles: profileChain,
        document_tracking: docChain,
        leave_requests: leaveChain,
      },
    });

    await updateSentForSignature("doc-1");
    expect(createNotificationInternal).toHaveBeenCalledWith(
      expect.anything(),
      "emp-1",
      "leave_status_update",
      "เอกสารของคุณ: ส่งเอกสารไปลงนาม",
    );
  });
});

/* ---------- updateReturnedDate ------------------------------------------- */

describe("updateReturnedDate", () => {
  it("HR updates successfully", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await updateReturnedDate("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(updateReturnedDate("doc-1")).rejects.toThrow("Forbidden");
  });
});

/* ---------- updateScannedDate -------------------------------------------- */

describe("updateScannedDate", () => {
  it("HR updates successfully", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await updateScannedDate("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(updateScannedDate("doc-1")).rejects.toThrow("Forbidden");
  });
});

/* ---------- updateSentToAgency ------------------------------------------- */

describe("updateSentToAgency", () => {
  it("HR updates successfully", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await updateSentToAgency("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(updateSentToAgency("doc-1")).rejects.toThrow("Forbidden");
  });
});

/* ---------- updateDocumentNotes ------------------------------------------ */

describe("updateDocumentNotes", () => {
  it("HR updates notes", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await updateDocumentNotes("doc-1", "some note");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });
});

/* ---------- deleteDocumentTracking --------------------------------------- */

describe("deleteDocumentTracking", () => {
  it("HR deletes successfully", async () => {
    const profileChain = createMockChain({ data: profileRow("hr") });
    const docChain = createMockChain({ data: null, error: null });
    setupMock({
      authUser: TEST_HR_USER,
      fromOverrides: { profiles: profileChain, document_tracking: docChain },
    });

    await deleteDocumentTracking("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/hr/documents");
  });

  it("rejects non-HR", async () => {
    const profileChain = createMockChain({ data: profileRow("employee") });
    setupMock({
      authUser: TEST_USER,
      fromOverrides: { profiles: profileChain },
    });

    await expect(deleteDocumentTracking("doc-1")).rejects.toThrow("Forbidden");
  });
});

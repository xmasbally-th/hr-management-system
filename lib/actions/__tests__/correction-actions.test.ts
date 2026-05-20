import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, createMockChain } from "./helpers";

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
}));
vi.mock("@/lib/actions/notification-actions", () => ({
  createNotificationInternal: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/server";
import { createNotificationInternal } from "@/lib/actions/notification-actions";

import {
  resolveCorrectionRequest,
  rejectCorrectionRequest,
  bulkResolveCorrectionRequests,
  bulkRejectCorrectionRequests,
} from "../correction-actions";

const mockedCreateClient = vi.mocked(createClient);

const HR = { id: "hr-1", email: "hr@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNotificationInternal).mockResolvedValue(undefined);
});

/* ====================================================================== */
/* resolveCorrectionRequest                                               */
/* ====================================================================== */

describe("resolveCorrectionRequest", () => {
  function setup(crRow: { target_user_id: string; status: string } | null) {
    // profiles: role check (hr) + correction lookup share the from() router
    const profilesChain = createMockChain({ data: { role: "hr" } });
    const crChain = createMockChain({ data: crRow });
    const sb = createMockSupabase({
      authUser: HR,
      fromOverrides: {
        profiles: profilesChain,
        profile_correction_requests: crChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb, crChain };
  }

  it("resolves a pending request + notifies the target user", async () => {
    const { crChain } = setup({ target_user_id: "user-9", status: "pending" });

    await resolveCorrectionRequest("corr-1", "แก้ไขเรียบร้อย");

    expect(crChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
        resolver_note: "แก้ไขเรียบร้อย",
        resolved_by: HR.id,
      }),
    );
    expect(createNotificationInternal).toHaveBeenCalledWith(
      expect.anything(),
      "user-9",
      "correction_resolved",
      expect.any(String),
    );
  });

  it("rejects when request is not pending", async () => {
    setup({ target_user_id: "user-9", status: "resolved" });
    await expect(resolveCorrectionRequest("corr-1")).rejects.toThrow(
      /ดำเนินการแล้ว/,
    );
  });

  it("rejects when request not found", async () => {
    setup(null);
    await expect(resolveCorrectionRequest("nope")).rejects.toThrow(/ไม่พบ/);
  });
});

/* ====================================================================== */
/* rejectCorrectionRequest                                                */
/* ====================================================================== */

describe("rejectCorrectionRequest", () => {
  function setup(crRow: { target_user_id: string; status: string } | null) {
    const profilesChain = createMockChain({ data: { role: "admin" } });
    const crChain = createMockChain({ data: crRow });
    const sb = createMockSupabase({
      authUser: HR,
      fromOverrides: {
        profiles: profilesChain,
        profile_correction_requests: crChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb, crChain };
  }

  it("requires a reason of at least 5 chars", async () => {
    setup({ target_user_id: "user-9", status: "pending" });
    await expect(rejectCorrectionRequest("corr-1", "no")).rejects.toThrow(
      /อย่างน้อย 5/,
    );
  });

  it("rejects a pending request with reason + notifies user", async () => {
    const { crChain } = setup({ target_user_id: "user-9", status: "pending" });

    await rejectCorrectionRequest("corr-1", "ข้อมูลเดิมถูกต้องแล้ว");

    expect(crChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
    expect(createNotificationInternal).toHaveBeenCalledWith(
      expect.anything(),
      "user-9",
      "correction_rejected",
      expect.stringContaining("ข้อมูลเดิมถูกต้องแล้ว"),
    );
  });
});

/* ====================================================================== */
/* bulkResolveCorrectionRequests                                          */
/* ====================================================================== */

describe("bulkResolveCorrectionRequests", () => {
  /**
   * Sets up a mock where:
   *   - profiles → role check (hr)
   *   - profile_correction_requests → first .select().in() returns the rows,
   *     subsequent .update() returns no error
   */
  function setupBulk(rows: Array<{ id: string; target_user_id: string; status: string }>) {
    const profilesChain = createMockChain({ data: { role: "hr" } });
    // The lookup select(...).in(...) is "bare await" → resolves via .then
    const crChain = createMockChain({ data: rows, error: null });
    const sb = createMockSupabase({
      authUser: HR,
      fromOverrides: {
        profiles: profilesChain,
        profile_correction_requests: crChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb, crChain };
  }

  it("rejects empty selection", async () => {
    setupBulk([]);
    await expect(bulkResolveCorrectionRequests([])).rejects.toThrow(
      /อย่างน้อย 1/,
    );
  });

  it("rejects more than 50 ids", async () => {
    setupBulk([]);
    const ids = Array.from({ length: 51 }, (_, i) => `c-${i}`);
    await expect(bulkResolveCorrectionRequests(ids)).rejects.toThrow(/ไม่เกิน 50/);
  });

  it("resolves all pending rows + counts successes", async () => {
    setupBulk([
      { id: "c-1", target_user_id: "u1", status: "pending" },
      { id: "c-2", target_user_id: "u2", status: "pending" },
    ]);

    const res = await bulkResolveCorrectionRequests(["c-1", "c-2"], "เสร็จ");
    expect(res.successCount).toBe(2);
    expect(res.failed).toHaveLength(0);
    expect(createNotificationInternal).toHaveBeenCalledTimes(2);
  });

  it("skips rows that are no longer pending (stalled)", async () => {
    // Only c-1 is pending; c-2 was resolved by someone else (absent from rows)
    setupBulk([{ id: "c-1", target_user_id: "u1", status: "pending" }]);

    const res = await bulkResolveCorrectionRequests(["c-1", "c-2"]);
    expect(res.successCount).toBe(1);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].id).toBe("c-2");
  });
});

/* ====================================================================== */
/* bulkRejectCorrectionRequests                                           */
/* ====================================================================== */

describe("bulkRejectCorrectionRequests", () => {
  function setupBulk(rows: Array<{ id: string; target_user_id: string; status: string }>) {
    const profilesChain = createMockChain({ data: { role: "hr" } });
    const crChain = createMockChain({ data: rows, error: null });
    const sb = createMockSupabase({
      authUser: HR,
      fromOverrides: {
        profiles: profilesChain,
        profile_correction_requests: crChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb };
  }

  it("requires reason >= 5 chars", async () => {
    setupBulk([{ id: "c-1", target_user_id: "u1", status: "pending" }]);
    await expect(
      bulkRejectCorrectionRequests(["c-1"], "x"),
    ).rejects.toThrow(/อย่างน้อย 5/);
  });

  it("rejects all selected pending rows + notifies each", async () => {
    setupBulk([
      { id: "c-1", target_user_id: "u1", status: "pending" },
      { id: "c-2", target_user_id: "u2", status: "pending" },
    ]);

    const res = await bulkRejectCorrectionRequests(
      ["c-1", "c-2"],
      "ข้อมูลเดิมถูกต้อง",
    );
    expect(res.successCount).toBe(2);
    expect(createNotificationInternal).toHaveBeenCalledTimes(2);
  });
});

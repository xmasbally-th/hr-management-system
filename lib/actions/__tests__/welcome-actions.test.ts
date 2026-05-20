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
  notifyAllHrAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { notifyAllHrAdmins } from "@/lib/actions/notification-actions";

import {
  confirmProfileAsAccurate,
  submitCorrectionRequest,
  cancelMyCorrectionRequest,
} from "../welcome-actions";

const mockedCreateClient = vi.mocked(createClient);

const USER = { id: "user-1", email: "u@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notifyAllHrAdmins).mockResolvedValue(undefined);
});

/**
 * Helper: builds a supabase mock where the profiles table returns a
 * given status row on read, and captures the .update() payload.
 */
function setupProfile(status: string) {
  const profilesChain = createMockChain({ data: { status } });
  const sb = createMockSupabase({
    authUser: USER,
    fromOverrides: { profiles: profilesChain },
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return { sb, profilesChain };
}

/* ====================================================================== */
/* confirmProfileAsAccurate                                               */
/* ====================================================================== */

describe("confirmProfileAsAccurate", () => {
  it("approves an awaiting_confirmation user + notifies HR", async () => {
    const { profilesChain } = setupProfile("awaiting_confirmation");

    await confirmProfileAsAccurate();

    // Updated profiles with approved + profile_completed_at
    expect(profilesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
    const payload = (profilesChain.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(payload.profile_completed_at).toBeTruthy();

    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      USER.id,
      "confirm_profile_accurate",
      "profile",
      USER.id,
      {},
    );
    expect(notifyAllHrAdmins).toHaveBeenCalledWith(
      expect.anything(),
      "user_profile_confirmed",
      expect.stringContaining("ยืนยัน"),
    );
  });

  it("rejects when status is not an onboarding status", async () => {
    setupProfile("rejected");
    await expect(confirmProfileAsAccurate()).rejects.toThrow(
      /ไม่อยู่ในขั้นตอนยืนยัน/,
    );
  });

  it("accepts legacy 'pending' status as onboarding", async () => {
    const { profilesChain } = setupProfile("pending");
    await confirmProfileAsAccurate();
    expect(profilesChain.update).toHaveBeenCalled();
  });
});

/* ====================================================================== */
/* submitCorrectionRequest                                                */
/* ====================================================================== */

describe("submitCorrectionRequest", () => {
  function setupForSubmit(status: string, insertId = "corr-1") {
    const profilesChain = createMockChain({ data: { status } });
    const insertChain = createMockChain({ data: { id: insertId } });
    const sb = createMockSupabase({
      authUser: USER,
      fromOverrides: {
        profiles: profilesChain,
        profile_correction_requests: insertChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb, profilesChain, insertChain };
  }

  it("rejects reason shorter than 10 chars", async () => {
    setupForSubmit("approved");
    await expect(
      submitCorrectionRequest({
        fields_flagged: ["phone"],
        reason_text: "สั้น",
        scope: "post_approval",
      }),
    ).rejects.toThrow(/อย่างน้อย 10/);
  });

  it("first_review: inserts request + flips user to approved + notifies HR", async () => {
    const { profilesChain, insertChain } = setupForSubmit("awaiting_confirmation");

    const res = await submitCorrectionRequest({
      fields_flagged: ["phone", "last_name_th"],
      reason_text: "นามสกุลสะกดผิด ที่ถูกต้องคือ ใจดี",
      scope: "first_review",
    });

    expect(res.id).toBe("corr-1");
    // Inserted the correction row with scope
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "first_review", status: "pending" }),
    );
    // first_review flips status to approved
    expect(profilesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
    expect(notifyAllHrAdmins).toHaveBeenCalledWith(
      expect.anything(),
      "new_correction_request",
      expect.stringContaining("ส่งคำขอแก้ไข"),
    );
  });

  it("post_approval: inserts request WITHOUT changing status", async () => {
    const { profilesChain, insertChain } = setupForSubmit("approved");

    await submitCorrectionRequest({
      fields_flagged: ["phone"],
      reason_text: "เบอร์โทรเปลี่ยนเป็น 081-2345678",
      scope: "post_approval",
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "post_approval" }),
    );
    // No profile status update in post_approval path
    expect(profilesChain.update).not.toHaveBeenCalled();
  });

  it("post_approval rejected when user not approved", async () => {
    setupForSubmit("awaiting_confirmation");
    await expect(
      submitCorrectionRequest({
        fields_flagged: [],
        reason_text: "ขอแก้ข้อมูลบางอย่างที่ยาวพอ",
        scope: "post_approval",
      }),
    ).rejects.toThrow(/ยังไม่อนุญาต/);
  });
});

/* ====================================================================== */
/* cancelMyCorrectionRequest                                              */
/* ====================================================================== */

describe("cancelMyCorrectionRequest", () => {
  function setupForCancel(row: {
    target_user_id: string;
    status: string;
    scope: string;
  } | null) {
    const crChain = createMockChain({ data: row });
    const profilesChain = createMockChain({ data: { status: "approved" } });
    const sb = createMockSupabase({
      authUser: USER,
      fromOverrides: {
        profile_correction_requests: crChain,
        profiles: profilesChain,
      },
    });
    mockedCreateClient.mockResolvedValue(sb as never);
    return { sb, crChain };
  }

  it("owner can cancel a pending request", async () => {
    const { crChain } = setupForCancel({
      target_user_id: USER.id,
      status: "pending",
      scope: "post_approval",
    });
    await cancelMyCorrectionRequest("corr-1");
    expect(crChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("rejects cancelling someone else's request", async () => {
    setupForCancel({
      target_user_id: "other-user",
      status: "pending",
      scope: "post_approval",
    });
    await expect(cancelMyCorrectionRequest("corr-1")).rejects.toThrow(
      /ไม่มีสิทธิ์/,
    );
  });

  it("rejects cancelling an already-resolved request", async () => {
    setupForCancel({
      target_user_id: USER.id,
      status: "resolved",
      scope: "post_approval",
    });
    await expect(cancelMyCorrectionRequest("corr-1")).rejects.toThrow(
      /ดำเนินการแล้ว/,
    );
  });

  it("rejects when request not found", async () => {
    setupForCancel(null);
    await expect(cancelMyCorrectionRequest("nope")).rejects.toThrow(/ไม่พบ/);
  });
});

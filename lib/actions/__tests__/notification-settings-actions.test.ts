import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, createMockChain } from "./helpers";

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
}));

// Service-role client used internally for upsert / reads — capture it.
const adminUpsert = vi.fn().mockReturnValue({ error: null });
const adminFrom = vi.fn().mockReturnValue({ upsert: adminUpsert });
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: adminFrom })),
}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
  },
}));

import { createClient } from "@/lib/supabase/server";
import {
  getAllNotificationTypeSettings,
  updateNotificationTypeSetting,
  getRealtimeEnabledTypes,
} from "../notification-settings-actions";

const mockedCreateClient = vi.mocked(createClient);

function setClient(role: string, settingsRows: unknown[] = []) {
  const profilesChain = createMockChain({ data: { role } });
  const settingsChain = createMockChain({ data: settingsRows });
  const sb = createMockSupabase({
    authUser: { id: "u-1", email: "u@example.com" },
    fromOverrides: {
      profiles: profilesChain,
      notification_type_settings: settingsChain,
    },
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
  adminUpsert.mockReturnValue({ error: null });
  adminFrom.mockReturnValue({ upsert: adminUpsert });
});

/* ====================================================================== */
/* getAllNotificationTypeSettings                                         */
/* ====================================================================== */

describe("getAllNotificationTypeSettings", () => {
  it("rejects non-admin", async () => {
    setClient("hr");
    await expect(getAllNotificationTypeSettings()).rejects.toThrow(/Admin only/);
  });

  it("returns all 14 types merged with defaults for admin", async () => {
    setClient("admin", []);
    const rows = await getAllNotificationTypeSettings();
    expect(rows).toHaveLength(14);
    // Every row carries label/description/group from META
    for (const r of rows) {
      expect(r.label).toBeTruthy();
      expect(r.group).toBeTruthy();
      expect(typeof r.enabled).toBe("boolean");
    }
  });

  it("DB row overrides the default", async () => {
    setClient("admin", [
      {
        type: "new_correction_request",
        enabled: false,
        realtime_enabled: false,
        cooldown_seconds: 99,
        recipient_roles: { admin: true, hr: false, manager: false, employee: false },
      },
    ]);
    const rows = await getAllNotificationTypeSettings();
    const row = rows.find((r) => r.type === "new_correction_request")!;
    expect(row.enabled).toBe(false);
    expect(row.cooldown_seconds).toBe(99);
    expect(row.recipient_roles.hr).toBe(false);
  });
});

/* ====================================================================== */
/* updateNotificationTypeSetting                                          */
/* ====================================================================== */

describe("updateNotificationTypeSetting", () => {
  it("rejects non-admin", async () => {
    setClient("hr");
    await expect(
      updateNotificationTypeSetting("leave_approved", { enabled: false }),
    ).rejects.toThrow(/Admin only/);
  });

  it("rejects unknown type", async () => {
    setClient("admin");
    await expect(
      updateNotificationTypeSetting("nope", { enabled: false }),
    ).rejects.toThrow(/ไม่ถูกต้อง/);
  });

  it("rejects out-of-range cooldown", async () => {
    setClient("admin");
    await expect(
      updateNotificationTypeSetting("leave_approved", { cooldown_seconds: 99999 }),
    ).rejects.toThrow(/0–86400/);
  });

  it("upserts via service-role client for admin", async () => {
    setClient("admin");
    await updateNotificationTypeSetting("leave_approved", {
      enabled: false,
      cooldown_seconds: 30,
    });
    expect(adminFrom).toHaveBeenCalledWith("notification_type_settings");
    expect(adminUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "leave_approved",
        enabled: false,
        cooldown_seconds: 30,
      }),
      { onConflict: "type" },
    );
  });
});

/* ====================================================================== */
/* getRealtimeEnabledTypes                                                */
/* ====================================================================== */

describe("getRealtimeEnabledTypes", () => {
  it("returns [] when unauthenticated", async () => {
    const sb = createMockSupabase({ authUser: null });
    mockedCreateClient.mockResolvedValue(sb as never);
    const types = await getRealtimeEnabledTypes();
    expect(types).toEqual([]);
  });

  it("merges DB realtime flags over defaults", async () => {
    // account_pending defaults realtime=false; flip it on via DB
    setClient("employee", [
      { type: "account_pending", realtime_enabled: true },
      { type: "leave_approved", realtime_enabled: false },
    ]);
    const types = await getRealtimeEnabledTypes();
    expect(types).toContain("account_pending"); // overridden on
    expect(types).not.toContain("leave_approved"); // overridden off
  });
});

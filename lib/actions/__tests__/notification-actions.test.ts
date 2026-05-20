import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockChain, createMockSupabase } from "./helpers";

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
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotificationInternal,
} from "../notification-actions";

const mockedCreateClient = vi.mocked(createClient);

function setSupabase(
  overrides: Parameters<typeof createMockSupabase>[0] = {},
) {
  const sb = createMockSupabase(overrides);
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===================================================================
// getMyNotifications
// ===================================================================
describe("getMyNotifications", () => {
  it("returns the user's notifications", async () => {
    const rows = [{ id: "n1", message: "hello" }];
    const chain = createMockChain({ data: rows });
    const sb = setSupabase({ fromOverrides: { notifications: chain } });

    const result = await getMyNotifications();

    expect(sb.from).toHaveBeenCalledWith("notifications");
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual(rows);
  });

  it("throws when unauthenticated", async () => {
    setSupabase({ authUser: null });
    await expect(getMyNotifications()).rejects.toThrow("Unauthorized");
  });
});

// ===================================================================
// getUnreadCount
// ===================================================================
describe("getUnreadCount", () => {
  it("returns the count", async () => {
    const chain = createMockChain({ count: 5 });
    setSupabase({ fromOverrides: { notifications: chain } });

    const result = await getUnreadCount();
    expect(result).toBe(5);
  });

  it("returns 0 on error", async () => {
    const chain = createMockChain({ error: { message: "fail" }, count: null });
    setSupabase({ fromOverrides: { notifications: chain } });

    const result = await getUnreadCount();
    expect(result).toBe(0);
  });
});

// ===================================================================
// markAsRead
// ===================================================================
describe("markAsRead", () => {
  it("marks a single notification and checks ownership", async () => {
    const chain = createMockChain();
    setSupabase({ fromOverrides: { notifications: chain } });

    await markAsRead("notif-1");

    expect(chain.update).toHaveBeenCalledWith({ is_read: true });
    expect(chain.eq).toHaveBeenCalledWith("id", "notif-1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

// ===================================================================
// markAllAsRead
// ===================================================================
describe("markAllAsRead", () => {
  it("marks all unread notifications", async () => {
    const chain = createMockChain();
    setSupabase({ fromOverrides: { notifications: chain } });

    await markAllAsRead();

    expect(chain.update).toHaveBeenCalledWith({ is_read: true });
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("is_read", false);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

// ===================================================================
// deleteNotification
// ===================================================================
describe("deleteNotification", () => {
  it("deletes with ownership check", async () => {
    const chain = createMockChain();
    setSupabase({ fromOverrides: { notifications: chain } });

    await deleteNotification("notif-1");

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "notif-1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

// ===================================================================
// createNotificationInternal
// ===================================================================
describe("createNotificationInternal", () => {
  it("inserts a notification", async () => {
    const chain = createMockChain();
    const sb = createMockSupabase({ fromOverrides: { notifications: chain } });

    await createNotificationInternal(
      sb as never,
      "target-user",
      "leave_approved",
      "Your leave was approved",
    );

    expect(sb.from).toHaveBeenCalledWith("notifications");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "target-user",
        type: "leave_approved",
        message: "Your leave was approved",
        is_read: false,
        // S12: row carries the realtime flag (defaults true when settings
        // can't be resolved in the test env).
        realtime: true,
      }),
    );
  });

  it("rejects invalid notification type", async () => {
    const chain = createMockChain();
    const sb = createMockSupabase({ fromOverrides: { notifications: chain } });

    await createNotificationInternal(sb as never, "target-user", "bad_type", "msg");

    // Should return early — no insert call
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("rejects empty targetUserId", async () => {
    const chain = createMockChain();
    const sb = createMockSupabase({ fromOverrides: { notifications: chain } });

    await createNotificationInternal(sb as never, "", "leave_approved", "msg");

    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("truncates message longer than 500 chars", async () => {
    const chain = createMockChain();
    const sb = createMockSupabase({ fromOverrides: { notifications: chain } });
    const longMsg = "x".repeat(600);

    await createNotificationInternal(sb as never, "target-user", "leave_approved", longMsg);

    const insertArg = vi.mocked(chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      message: string;
    };
    expect(insertArg.message).toHaveLength(500);
  });
});

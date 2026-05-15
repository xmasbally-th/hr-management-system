"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";
import {
  ALLOWED_NOTIFICATION_TYPES,
  VALID_NOTIFICATION_TYPE_SET,
  type NotificationType,
} from "@/lib/notification-types";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function getAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getMyNotifications() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("ไม่สามารถดึงการแจ้งเตือนได้");
  return data;
}

export async function getUnreadCount() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) throw new Error("ไม่สามารถอัปเดตการแจ้งเตือนได้");
  revalidatePath("/dashboard");
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw new Error("ไม่สามารถอัปเดตการแจ้งเตือนได้");
  revalidatePath("/dashboard");
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) throw new Error("ไม่สามารถลบการแจ้งเตือนได้");
  revalidatePath("/dashboard");
}

// =============================================================================
// Per-user notification preferences (Phase S6)
// =============================================================================

/**
 * Returns the calling user's notification preferences as a complete map,
 * defaulting any missing key to `true` (opt-out model).
 */
export async function getMyNotificationPrefs(): Promise<Record<NotificationType, boolean>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data } = await supabase
    .from("notification_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const stored = (data?.preferences ?? {}) as Record<string, boolean>;
  const out = {} as Record<NotificationType, boolean>;
  for (const t of ALLOWED_NOTIFICATION_TYPES) {
    out[t] = stored[t] === false ? false : true; // default true
  }
  return out;
}

/**
 * Replaces the calling user's preferences. Missing keys are treated as
 * "enabled" (the opt-out default).
 */
export async function updateMyNotificationPrefs(
  prefs: Partial<Record<NotificationType, boolean>>,
): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  // Sanitize — only store known types, and only when explicitly false
  // (true is the default, so we don't bloat the JSON with all keys).
  const toStore: Record<string, boolean> = {};
  for (const t of ALLOWED_NOTIFICATION_TYPES) {
    if (prefs[t] === false) toStore[t] = false;
  }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        preferences: toStore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[notification-actions] updateMyNotificationPrefs failed:", error);
    throw new Error("บันทึกการตั้งค่าการแจ้งเตือนไม่สำเร็จ");
  }

  revalidatePath("/dashboard/profile");
}

/**
 * Service-role lookup — used by createNotificationInternal() to honor the
 * target user's opt-out preferences. Returns `true` (send) on any failure
 * so notifications are never silently dropped when the prefs system itself
 * has a problem.
 */
async function shouldSendNotification(
  targetUserId: string,
  type: string,
): Promise<boolean> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("notification_preferences")
      .select("preferences")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (error) return true; // err-on-the-side-of-sending
    const prefs = (data?.preferences ?? {}) as Record<string, boolean>;
    return prefs[type] !== false; // explicit false = opted out
  } catch {
    return true;
  }
}

/**
 * Internal only — NOT exported as a server action.
 * Called from leave-actions / travel-actions which already have auth context.
 * Accepts a pre-authenticated supabase client to avoid re-auth round-trip.
 */
export async function createNotificationInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string,
  type: string,
  message: string,
) {
  if (!targetUserId || !VALID_NOTIFICATION_TYPE_SET.has(type)) {
    console.error("[notification-actions] Invalid notification params:", { targetUserId, type });
    return;
  }

  // Per-user opt-out check (service-role read — caller's RLS would block
  // reading another user's prefs row).
  if (!(await shouldSendNotification(targetUserId, type))) {
    return;
  }

  if (message.length > 500) {
    message = message.slice(0, 500);
  }

  const { error } = await supabase
    .from("notifications")
    .insert({
      user_id: targetUserId,
      type,
      message,
      is_read: false,
    });

  if (error) {
    console.error("[notification-actions] Failed to create notification:", error.message);
  }
}

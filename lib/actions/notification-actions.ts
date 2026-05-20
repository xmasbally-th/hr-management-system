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
import { getEffectiveTypeSetting } from "./notification-settings-actions";

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


/**
 * System-wide gate (Phase S11) — replaces per-user opt-out. Returns true
 * if the type should be delivered to this recipient, considering:
 *   1. type enabled?
 *   2. recipient's role allowed for this type?
 *   3. cooldown elapsed since last same-type notification to this user?
 *
 * Returns true (send) on any unexpected failure so a settings glitch
 * never silently drops notifications.
 */
async function shouldSendNotification(
  targetUserId: string,
  type: string,
): Promise<boolean> {
  try {
    const setting = await getEffectiveTypeSetting(type);
    if (!setting) return true; // unknown type — default to send

    if (!setting.enabled) return false;

    const admin = getAdminClient();

    // Role gate
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", targetUserId)
      .maybeSingle();
    const role = profile?.role as keyof typeof setting.recipient_roles | undefined;
    if (role && setting.recipient_roles[role] === false) {
      return false;
    }

    // Cooldown gate
    if (setting.cooldown_seconds > 0) {
      const { data: last } = await admin
        .from("notifications")
        .select("created_at")
        .eq("user_id", targetUserId)
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.created_at) {
        const elapsedMs = Date.now() - new Date(last.created_at).getTime();
        if (elapsedMs < setting.cooldown_seconds * 1000) {
          return false;
        }
      }
    }

    return true;
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

/**
 * Broadcast a notification to every active HR + Admin user.
 *
 * Uses the service-role client to read the profile list across RLS, then
 * delegates to createNotificationInternal for each recipient (which honors
 * per-user opt-out preferences).
 *
 * Fire-and-forget — callers should not let notification failures break
 * their main flow.
 */
export async function notifyAllHrAdmins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: string,
  message: string,
): Promise<void> {
  if (!VALID_NOTIFICATION_TYPE_SET.has(type)) {
    console.error("[notification-actions] notifyAllHrAdmins: invalid type", type);
    return;
  }

  // Need service-role to bypass RLS — regular employees can't read other
  // users' profile rows, so neither can the caller's supabase client.
  const admin = getAdminClient();
  const { data: recipients, error } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"])
    .eq("status", "approved");

  if (error || !recipients) {
    console.error("[notification-actions] notifyAllHrAdmins: lookup failed", error);
    return;
  }

  await Promise.all(
    recipients.map((r) =>
      createNotificationInternal(supabase, r.id, type, message).catch((e) => {
        console.error("[notification-actions] notifyAllHrAdmins: send failed", e);
      }),
    ),
  );
}

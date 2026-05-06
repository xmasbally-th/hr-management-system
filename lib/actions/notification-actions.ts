"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
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

const ALLOWED_NOTIFICATION_TYPES = [
  "new_leave_request",
  "new_travel_request",
  "leave_approved",
  "leave_rejected",
  "travel_approved",
  "travel_rejected",
] as const;

/**
 * Internal only — NOT exported as a server action.
 * Called from leave-actions / travel-actions which already have auth context.
 * Accepts a pre-authenticated supabase client to avoid re-auth round-trip.
 */
export async function createNotificationInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string,
  type: string,
  message: string
) {
  if (!targetUserId || !ALLOWED_NOTIFICATION_TYPES.includes(type as typeof ALLOWED_NOTIFICATION_TYPES[number])) {
    console.error("[notification-actions] Invalid notification params:", { targetUserId, type });
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

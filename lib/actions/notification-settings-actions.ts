"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";
import { logAudit } from "@/lib/audit-log";
import {
  DEFAULT_TYPE_SETTINGS,
  NOTIFICATION_TYPE_META,
  VALID_NOTIFICATION_TYPE_SET,
  type NotificationType,
  type NotificationTypeSetting,
} from "@/lib/notification-types";

/**
 * Admin-only management of system-wide notification type settings.
 * Replaces the per-user opt-out model — admins control whether each
 * notification type is sent, who receives it, how fast it can repeat,
 * and whether clients surface it as a realtime toast.
 */

function getAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function checkAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }
  return user.id;
}

/**
 * Resolve effective settings for one type — DB row if present, else the
 * compiled-in default. Used by createNotificationInternal via the
 * service-role client so it works without an authed user session.
 *
 * Wrapped in a 60-second in-memory cache to avoid a DB read on every
 * single notification send.
 */
type CacheEntry = { at: number; map: Record<string, NotificationTypeSetting> };
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

async function loadAllSettingsCached(): Promise<Record<string, NotificationTypeSetting>> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.map;
  }
  const map: Record<string, NotificationTypeSetting> = {
    ...(DEFAULT_TYPE_SETTINGS as Record<string, NotificationTypeSetting>),
  };
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("notification_type_settings")
      .select("type, enabled, realtime_enabled, cooldown_seconds, recipient_roles");
    for (const row of data ?? []) {
      if (!VALID_NOTIFICATION_TYPE_SET.has(row.type)) continue;
      map[row.type] = {
        type: row.type as NotificationType,
        enabled: row.enabled,
        realtime_enabled: row.realtime_enabled,
        cooldown_seconds: row.cooldown_seconds,
        recipient_roles: row.recipient_roles as NotificationTypeSetting["recipient_roles"],
      };
    }
  } catch {
    // fall back to defaults
  }
  _cache = { at: Date.now(), map };
  return map;
}

/**
 * Internal — used by notification-actions.shouldSendNotification.
 * Not a user-facing action (but must be async-exported from a
 * "use server" module, which it is).
 */
export async function getEffectiveTypeSetting(
  type: string,
): Promise<NotificationTypeSetting | null> {
  const map = await loadAllSettingsCached();
  return map[type] ?? null;
}

/**
 * Authenticated (any role) read of which types have realtime delivery
 * enabled. Used by the notification bell to decide whether to fire a
 * toast / tab-title flicker for an incoming notification. Falls back to
 * defaults if the table can't be read.
 */
export async function getRealtimeEnabledTypes(): Promise<string[]> {
  const user = await getCachedUser();
  if (!user) return [];
  const supabase = await createClient();

  // Start from defaults, override with any DB rows (RLS allows SELECT)
  const map: Record<string, boolean> = {};
  for (const t of Object.keys(DEFAULT_TYPE_SETTINGS)) {
    map[t] = DEFAULT_TYPE_SETTINGS[t as NotificationType].realtime_enabled;
  }
  try {
    const { data } = await supabase
      .from("notification_type_settings")
      .select("type, realtime_enabled");
    for (const row of data ?? []) {
      if (VALID_NOTIFICATION_TYPE_SET.has(row.type)) {
        map[row.type] = row.realtime_enabled;
      }
    }
  } catch {
    // keep defaults
  }
  return Object.keys(map).filter((t) => map[t]);
}

export interface TypeSettingRow extends NotificationTypeSetting {
  label: string;
  description: string;
  group: string;
}

/**
 * Full list for the admin settings UI — merges DB values with the type
 * metadata (label/description/group) so the table can render everything.
 */
export async function getAllNotificationTypeSettings(): Promise<TypeSettingRow[]> {
  const supabase = await createClient();
  await checkAdmin(supabase);

  // Read via the user's client (RLS allows authenticated SELECT)
  const { data } = await supabase
    .from("notification_type_settings")
    .select("type, enabled, realtime_enabled, cooldown_seconds, recipient_roles");

  type Row = NonNullable<typeof data>[number];
  const byType = new Map<string, Row>();
  for (const r of data ?? []) byType.set(r.type, r);

  return NOTIFICATION_TYPE_META.map((meta) => {
    const row = byType.get(meta.type);
    const def = DEFAULT_TYPE_SETTINGS[meta.type];
    return {
      type: meta.type,
      label: meta.label,
      description: meta.description,
      group: meta.group,
      enabled: row?.enabled ?? def.enabled,
      realtime_enabled: row?.realtime_enabled ?? def.realtime_enabled,
      cooldown_seconds: row?.cooldown_seconds ?? def.cooldown_seconds,
      recipient_roles:
        (row?.recipient_roles as NotificationTypeSetting["recipient_roles"]) ??
        def.recipient_roles,
    };
  });
}

export interface UpdateTypeSettingInput {
  enabled?: boolean;
  realtime_enabled?: boolean;
  cooldown_seconds?: number;
  recipient_roles?: Record<string, boolean>;
}

/**
 * Update one notification type's settings (admin only). Upserts so a row
 * is created if the seed migration hasn't populated it.
 */
export async function updateNotificationTypeSetting(
  type: string,
  patch: UpdateTypeSettingInput,
): Promise<void> {
  const supabase = await createClient();
  const actorId = await checkAdmin(supabase);

  if (!VALID_NOTIFICATION_TYPE_SET.has(type)) {
    throw new Error("ประเภทการแจ้งเตือนไม่ถูกต้อง");
  }
  if (
    patch.cooldown_seconds !== undefined &&
    (patch.cooldown_seconds < 0 || patch.cooldown_seconds > 86400)
  ) {
    throw new Error("ระยะ cooldown ต้องอยู่ระหว่าง 0–86400 วินาที");
  }

  // Use service-role to upsert (RLS UPDATE policy doesn't cover INSERT for
  // rows the seed migration may not have created).
  const admin = getAdminClient();
  const def = DEFAULT_TYPE_SETTINGS[type as NotificationType];
  const { error } = await admin
    .from("notification_type_settings")
    .upsert(
      {
        type,
        enabled: patch.enabled ?? def.enabled,
        realtime_enabled: patch.realtime_enabled ?? def.realtime_enabled,
        cooldown_seconds: patch.cooldown_seconds ?? def.cooldown_seconds,
        recipient_roles: patch.recipient_roles ?? def.recipient_roles,
        updated_at: new Date().toISOString(),
        updated_by: actorId,
      },
      { onConflict: "type" },
    );

  if (error) {
    console.error("[notification-settings] update failed:", error);
    throw new Error("บันทึกการตั้งค่าไม่สำเร็จ: " + error.message);
  }

  // Bust the send-path cache so the change takes effect immediately
  _cache = null;

  await logAudit(supabase, actorId, "update_notification_setting", "notification_type_settings", type, {
    ...patch,
  });

  revalidatePath("/dashboard/settings");
}

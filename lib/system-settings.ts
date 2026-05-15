"use server";

/**
 * Read-through cache for system-wide settings stored in the
 * `system_settings` table. Reads use the service-role client so RLS
 * doesn't block the auth callback (called before any user session exists).
 *
 * Falls back to environment variables when:
 *   - the DB row is missing (fresh deployment before migration ran), OR
 *   - the lookup itself errors (DB unavailable, network blip)
 *
 * The cache has a short TTL so admin edits in the UI take effect quickly
 * without hammering Postgres on every auth-callback request.
 */

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import type { Database } from "@/types/supabase";

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  // Cache hit?
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value as T;
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.warn(`[system-settings] read failed for "${key}":`, error.message);
      return fallback;
    }

    if (!data) {
      // Row missing — use env fallback and cache it
      cache.set(key, { value: fallback, fetchedAt: Date.now() });
      return fallback;
    }

    const value = data.value as T;
    cache.set(key, { value, fetchedAt: Date.now() });
    return value;
  } catch (err) {
    console.warn(`[system-settings] read threw for "${key}":`, err);
    return fallback;
  }
}

function envDomains(): string[] {
  const raw = env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS;
  if (!raw.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/** Lower-cased, deduped allowed domain list. Empty array = "allow all". */
export async function getAllowedDomains(): Promise<string[]> {
  const raw = await readSetting<unknown>("allowed_email_domains", envDomains());
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

/**
 * Server-side email check that reads the DB-stored allowlist.
 * (The client-side login page uses the env-driven sync version from
 * `lib/auth/allowed-domains` so it doesn't need a round-trip.)
 */
export async function isEmailAllowed(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const domains = await getAllowedDomains();
  if (domains.length === 0) return true; // check disabled
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return domains.includes(email.slice(at + 1).toLowerCase());
}

export async function getAutoApproveNewUsers(): Promise<boolean> {
  const raw = await readSetting<unknown>(
    "auto_approve_new_users",
    env.AUTO_APPROVE_NEW_USERS,
  );
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  return false;
}

/**
 * Admin-only mutation. Updates a setting and clears the in-process cache.
 * The OAuth callback's cache (separate Vercel function instance) will
 * refresh within CACHE_TTL_MS — acceptable for an org-wide setting.
 */
export async function updateSetting(
  key: "allowed_email_domains" | "auto_approve_new_users",
  value: unknown,
): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Admin-only enforcement (RLS already blocks, but check explicitly for
  // a clearer error message).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }

  // Validate value shape
  if (key === "allowed_email_domains") {
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      throw new Error("allowed_email_domains ต้องเป็น array ของ string");
    }
  } else if (key === "auto_approve_new_users") {
    if (typeof value !== "boolean") {
      throw new Error("auto_approve_new_users ต้องเป็น true/false");
    }
  }

  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        key,
        value: value as Database["public"]["Tables"]["system_settings"]["Insert"]["value"],
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" },
    );

  if (error) throw new Error(`บันทึกค่าระบบไม่สำเร็จ: ${error.message}`);

  cache.delete(key);

  await logAudit(supabase, user.id, "update_system_setting", "system_setting", key, {
    value,
  });
  revalidatePath("/dashboard/settings");
}

/**
 * Returns raw rows including `updated_at` for display in the admin Settings UI.
 * Admin-only — relies on RLS to enforce.
 */
export async function getAllSystemSettings(): Promise<
  Record<string, { value: unknown; updated_at: string }>
> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value, updated_at");
  if (error) {
    console.warn("[system-settings] getAllSystemSettings:", error.message);
    return {};
  }
  const out: Record<string, { value: unknown; updated_at: string }> = {};
  for (const row of data ?? []) {
    out[row.key] = { value: row.value, updated_at: row.updated_at };
  }
  return out;
}

/** Test-only export to allow resetting the in-process cache between tests. */
export async function __resetCacheForTests(): Promise<void> {
  cache.clear();
}

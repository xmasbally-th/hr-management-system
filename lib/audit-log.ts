/**
 * Audit logging helper for sensitive operations.
 * Fire-and-forget: does not block the calling action if logging fails.
 *
 * Requires the `audit_logs` table to exist in Supabase.
 * See supabase/migrations/20260511_audit_logs.sql
 */
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    });
  } catch {
    // Fire-and-forget: audit logging should never break the main action
    console.error("[audit] Failed to write audit log");
  }
}

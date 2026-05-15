"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Audit-log viewer — admin-only.
 *
 * Powers /dashboard/settings → tab "Audit Log".
 */

async function getAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function checkAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }
}

export interface AuditLogFilters {
  action?: string;
  userSearch?: string; // matches against the user's full_name
  startDate?: string; // YYYY-MM-DD inclusive
  endDate?: string; // YYYY-MM-DD inclusive
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  user_name: string;
  user_initials: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 10_000;

function initialsOf(first?: string | null, last?: string | null): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (!f && !l) return "?";
  return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase();
}

/**
 * Paginated fetch of audit log rows.
 * Joins user_id → profiles for display (separate query — audit_logs has no FK).
 */
export async function getAuditLogs(
  params: { page?: number; pageSize?: number } & AuditLogFilters,
): Promise<AuditLogPage> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("audit_logs")
    .select("id, user_id, action, target_type, target_id, details, created_at", {
      count: "exact",
    });

  if (params.action && params.action !== "all") {
    q = q.eq("action", params.action);
  }
  if (params.startDate) {
    q = q.gte("created_at", `${params.startDate}T00:00:00`);
  }
  if (params.endDate) {
    q = q.lte("created_at", `${params.endDate}T23:59:59.999`);
  }

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[audit-actions] getAuditLogs failed:", error);
    throw new Error("ไม่สามารถดึงข้อมูล audit log ได้");
  }

  // Resolve user names in one batch query
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
  const namesByUserId: Record<string, { first: string; last: string }> = {};
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name_th, last_name_th, full_name")
      .in("id", userIds);
    for (const p of profilesData ?? []) {
      const first = p.first_name_th || p.full_name || "";
      const last = p.last_name_th || "";
      namesByUserId[p.id] = { first, last };
    }
  }

  let rows: AuditLogRow[] = (data ?? []).map((r) => {
    const n = namesByUserId[r.user_id];
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: n ? `${n.first} ${n.last}`.trim() || "system" : "system",
      user_initials: n ? initialsOf(n.first, n.last) : "S",
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      details: r.details ?? null,
      created_at: r.created_at,
    };
  });

  // userSearch is applied post-query because the actor's name lives on a
  // separate table without a FK relation. This is OK because we already
  // applied other filters server-side and at most 200 rows reach here.
  if (params.userSearch) {
    const q = params.userSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => r.user_name.toLowerCase().includes(q));
    }
  }

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  };
}

/**
 * Returns the distinct list of action strings currently in audit_logs.
 * Used to populate the filter dropdown.
 */
export async function getAuditActionTypes(): Promise<string[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  // Supabase JS doesn't expose `DISTINCT`. Pull the most recent 1k rows'
  // action values — enough variety for a filter UI.
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[audit-actions] getAuditActionTypes failed:", error);
    return [];
  }

  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.action);
  return [...set].sort();
}

/**
 * Export the (already-filtered) audit log to a CSV string.
 * Used by the section's "Export CSV" button.
 */
export async function exportAuditLogs(
  filters: AuditLogFilters,
): Promise<string> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);
  checkRateLimit(user.id);

  let q = supabase
    .from("audit_logs")
    .select("id, user_id, action, target_type, target_id, details, created_at");

  if (filters.action && filters.action !== "all") {
    q = q.eq("action", filters.action);
  }
  if (filters.startDate) {
    q = q.gte("created_at", `${filters.startDate}T00:00:00`);
  }
  if (filters.endDate) {
    q = q.lte("created_at", `${filters.endDate}T23:59:59.999`);
  }

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  if (error) {
    throw new Error("ไม่สามารถส่งออก audit log ได้");
  }

  // Resolve user names (batch)
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
  const namesByUserId: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      namesByUserId[p.id] = p.full_name || p.id;
    }
  }

  // RFC 4180 escape
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    "timestamp",
    "user_id",
    "user_name",
    "action",
    "target_type",
    "target_id",
    "details",
  ];
  const lines: string[] = [header.join(",")];

  let rows = data ?? [];
  if (filters.userSearch) {
    const q = filters.userSearch.trim().toLowerCase();
    rows = rows.filter((r) =>
      (namesByUserId[r.user_id] ?? "").toLowerCase().includes(q),
    );
  }

  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.user_id,
        namesByUserId[r.user_id] ?? r.user_id,
        r.action,
        r.target_type,
        r.target_id,
        r.details ? JSON.stringify(r.details) : "",
      ]
        .map(escape)
        .join(","),
    );
  }

  // UTF-8 BOM + CRLF so Excel reads it correctly
  return "﻿" + lines.join("\r\n") + "\r\n";
}

"use server";

/**
 * Server actions for the monthly attendance summary
 * (สรุปการมาปฏิบัติงานรายเดือน). Data is separate from leave_requests —
 * it is an aggregate per person per month, sourced from the PDF the
 * university HR sends. See lib/attendance/parse-attendance-pdf.ts.
 *
 * Mutations are HR/Admin only. Reads follow RLS:
 *   manager+ see everything; employees see their own rows in published rounds.
 */

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { uploadDocument } from "@/lib/actions/storage-actions";
import {
  parseAttendancePdf,
  type ParseAttendanceResult,
} from "@/lib/attendance/parse-attendance-pdf";
import {
  parseAnnualLeavePdf,
  type ParseAnnualResult,
  type AnnualLeaveKey,
} from "@/lib/attendance/parse-annual-leave-pdf";
import { fiscalYearOf, fiscalMonthOrder } from "@/lib/attendance/labels";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Auth helpers ──────────────────────────────────────────

async function getAuthUser() {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized: Please log in");
  return user;
}

async function checkHrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }
}

// ─── Types ─────────────────────────────────────────────────

const NUMERIC_DAY_FIELDS = [
  "work_days",
  "travel_days",
  "leave_vacation",
  "leave_personal",
  "leave_sick",
  "leave_study",
  "leave_maternity",
  "leave_ordination",
  "total_days",
  // ลงเวลาสายนับเป็น "วัน" (ทั้งรายเดือน/รายปี)
  "late_online_days",
] as const;

const COUNT_FIELDS = ["missing_checkout_count"] as const;

export type AttendanceEntryInput = {
  profile_id: string;
  raw_name?: string | null;
  staff_line?: "academic" | "support" | "contract" | null;
  row_order?: number | null;
} & Record<(typeof NUMERIC_DAY_FIELDS)[number], number> &
  Record<(typeof COUNT_FIELDS)[number], number>;

/** Soft check used by UI + server: total should equal work+travel+all leave. */
export function entrySumMatches(e: AttendanceEntryInput): boolean {
  const sum =
    e.work_days +
    e.travel_days +
    e.leave_vacation +
    e.leave_personal +
    e.leave_sick +
    e.leave_study +
    e.leave_maternity +
    e.leave_ordination;
  return sum === e.total_days;
}

function sanitizeEntry(e: AttendanceEntryInput): AttendanceEntryInput {
  if (!UUID_RE.test(e.profile_id)) throw new Error("profile_id ไม่ถูกต้อง");
  const out = { ...e };
  for (const f of NUMERIC_DAY_FIELDS) {
    const v = Number(e[f]);
    if (!Number.isFinite(v) || v < 0 || v > 31) {
      throw new Error(`ค่าคอลัมน์ ${f} ไม่ถูกต้อง (0–31)`);
    }
    out[f] = v;
  }
  for (const f of COUNT_FIELDS) {
    const v = Number(e[f]);
    if (!Number.isInteger(v) || v < 0 || v > 99) {
      throw new Error(`ค่าคอลัมน์ ${f} ไม่ถูกต้อง (จำนวนเต็ม 0–99)`);
    }
    out[f] = v;
  }
  if (e.staff_line && !["academic", "support", "contract"].includes(e.staff_line)) {
    throw new Error("staff_line ไม่ถูกต้อง");
  }
  return out;
}

// ─── Reads ─────────────────────────────────────────────────

/** List attendance rounds. RLS already scopes visibility (manager+ vs published). */
export async function getAttendancePeriods(departmentId?: string) {
  const supabase = await createClient();
  await getAuthUser();

  let q = supabase
    .from("attendance_periods")
    .select(
      `id, department_id, period_type, buddhist_year, month, working_days,
       start_date, end_date, title, status,
       source_file_url, created_at,
       department:departments(name),
       entries:attendance_entries(count)`,
    )
    .order("buddhist_year", { ascending: false })
    .order("month", { ascending: false, nullsFirst: false });

  if (departmentId) {
    if (!UUID_RE.test(departmentId)) throw new Error("departmentId ไม่ถูกต้อง");
    q = q.eq("department_id", departmentId);
  }

  const { data, error } = await q;
  if (error) throw new Error("ไม่สามารถดึงรายการรอบสรุปได้");
  return data ?? [];
}

/** Full detail of one round: period + entries joined with profile names. */
export async function getAttendancePeriodDetail(periodId: string) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  const supabase = await createClient();
  await getAuthUser();

  const [{ data: period, error: pErr }, { data: entries, error: eErr }] =
    await Promise.all([
      supabase
        .from("attendance_periods")
        .select(
          `id, department_id, period_type, buddhist_year, month, working_days,
           start_date, end_date, title, status,
           source_file_url, note, created_at, updated_at,
           department:departments(name)`,
        )
        .eq("id", periodId)
        .single(),
      supabase
        .from("attendance_entries")
        .select(
          `*, profile:profiles(id, full_name, employee_type, position_title)`,
        )
        .eq("period_id", periodId)
        .order("row_order", { ascending: true }),
    ]);

  if (pErr || !period) throw new Error("ไม่พบรอบสรุปที่ต้องการ");
  if (eErr) throw new Error("ไม่สามารถดึงข้อมูลรายคนได้");
  return { period, entries: entries ?? [] };
}

/** Current user's own attendance rows (published rounds only, per RLS). */
export async function getMyAttendance() {
  const supabase = await createClient();
  const user = await getAuthUser();

  const { data, error } = await supabase
    .from("attendance_entries")
    .select(
      `*, period:attendance_periods(id, period_type, buddhist_year, month,
        working_days, start_date, end_date, status, title)`,
    )
    .eq("profile_id", user.id);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการมาปฏิบัติงานของคุณได้");
  // RLS already filters to published; sort newest first. Annual rounds sort
  // above monthly ones of the same year (month treated as 13).
  return (data ?? []).sort((a, b) => {
    const pa = a.period as { buddhist_year: number; month: number | null } | null;
    const pb = b.period as { buddhist_year: number; month: number | null } | null;
    if (!pa || !pb) return 0;
    return pb.buddhist_year - pa.buddhist_year || (pb.month ?? 13) - (pa.month ?? 13);
  });
}

/** Faculty roster for pre-filling/matching the grid (HR/Admin only). */
export async function getFacultyRoster(departmentId: string) {
  if (!UUID_RE.test(departmentId)) throw new Error("departmentId ไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, employee_type, position_title")
    .eq("department_id", departmentId)
    .order("full_name", { ascending: true });

  if (error) throw new Error("ไม่สามารถดึงรายชื่อบุคลากรได้");
  return data ?? [];
}

// ─── Analytics (manager+) ──────────────────────────────────

async function checkManagerOrAbove(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["manager", "hr", "admin"].includes(profile.role)) {
    throw new Error("Forbidden: Manager/HR/Admin only");
  }
}

const LEAVE_KEYS = [
  "leave_vacation",
  "leave_personal",
  "leave_sick",
  "leave_study",
  "leave_maternity",
  "leave_ordination",
] as const;

export interface AttendanceAnalytics {
  buddhist_year: number | null;
  available_years: number[];
  /** Per-month aggregates for the selected year, ascending by month. */
  months: Array<{
    month: number;
    headcount: number;
    work_days: number;
    travel_days: number;
    leave_total: number;
    late_online: number;
    missing_checkout: number;
  }>;
  /** Year totals per leave type. */
  leave_by_type: Array<{ key: string; total: number }>;
  totals: {
    leave_total: number;
    late_online: number;
    missing_checkout: number;
    travel_days: number;
  };
  /** Rankings across the year (top 10). */
  top_late: Array<{ profile_id: string; name: string; value: number }>;
  top_missing: Array<{ profile_id: string; name: string; value: number }>;
  top_leave: Array<{ profile_id: string; name: string; value: number }>;
}

/**
 * Aggregate attendance data for the reports/analytics view, BY FISCAL YEAR
 * (ปีงบประมาณ, Oct–Sep). Works even with a partial year (cumulative).
 * `buddhist_year` in the result holds the fiscal year. Manager/HR/Admin only.
 */
export async function getAttendanceAnalytics(
  fiscalYear?: number,
): Promise<AttendanceAnalytics> {
  const supabase = await createClient();
  const user = await getAuthUser();
  await checkManagerOrAbove(supabase, user.id);

  // Analytics aggregate the MONTHLY rounds (works even with a partial year).
  const { data: periods, error: pErr } = await supabase
    .from("attendance_periods")
    .select("id, buddhist_year, month")
    .eq("period_type", "monthly");
  if (pErr) throw new Error("ไม่สามารถดึงข้อมูลรอบสรุปได้");

  // Map each monthly round to its fiscal year (Oct–Dec roll into next year).
  const periodFY = (periods ?? []).map((p) => ({
    ...p,
    fy: fiscalYearOf(p.buddhist_year, p.month as number),
  }));
  const availableYears = [...new Set(periodFY.map((p) => p.fy))].sort((a, b) => b - a);

  const year = fiscalYear ?? availableYears[0] ?? null;
  const empty: AttendanceAnalytics = {
    buddhist_year: year,
    available_years: availableYears,
    months: [],
    leave_by_type: LEAVE_KEYS.map((k) => ({ key: k, total: 0 })),
    totals: { leave_total: 0, late_online: 0, missing_checkout: 0, travel_days: 0 },
    top_late: [],
    top_missing: [],
    top_leave: [],
  };
  if (year === null) return empty;

  const yearPeriods = periodFY.filter((p) => p.fy === year);
  if (yearPeriods.length === 0) return empty;

  // period_type='monthly' guarantees month is non-null here.
  const monthByPeriod = new Map(yearPeriods.map((p) => [p.id, p.month as number]));

  const { data: entries, error: eErr } = await supabase
    .from("attendance_entries")
    .select(
      `period_id, profile_id, work_days, travel_days,
       leave_vacation, leave_personal, leave_sick, leave_study, leave_maternity, leave_ordination,
       late_online_days, missing_checkout_count,
       profile:profiles(full_name)`,
    )
    .in("period_id", yearPeriods.map((p) => p.id));
  if (eErr) throw new Error("ไม่สามารถดึงข้อมูลรายคนได้");

  const monthAgg = new Map<
    number,
    { headcount: number; work: number; travel: number; leave: number; late: number; missing: number }
  >();
  const leaveByType: Record<string, number> = Object.fromEntries(LEAVE_KEYS.map((k) => [k, 0]));
  const personAgg = new Map<
    string,
    { name: string; late: number; missing: number; leave: number }
  >();
  const totals = { leave_total: 0, late_online: 0, missing_checkout: 0, travel_days: 0 };

  for (const e of entries ?? []) {
    const month = monthByPeriod.get(e.period_id);
    if (month === undefined) continue;

    const leaveSum = LEAVE_KEYS.reduce((s, k) => s + (e[k] as number), 0);

    const m = monthAgg.get(month) ?? {
      headcount: 0,
      work: 0,
      travel: 0,
      leave: 0,
      late: 0,
      missing: 0,
    };
    m.headcount += 1;
    m.work += e.work_days;
    m.travel += e.travel_days;
    m.leave += leaveSum;
    m.late += e.late_online_days;
    m.missing += e.missing_checkout_count;
    monthAgg.set(month, m);

    for (const k of LEAVE_KEYS) leaveByType[k] += e[k] as number;

    totals.leave_total += leaveSum;
    totals.late_online += e.late_online_days;
    totals.missing_checkout += e.missing_checkout_count;
    totals.travel_days += e.travel_days;

    const prof = e.profile as { full_name: string } | { full_name: string }[] | null;
    const name = Array.isArray(prof) ? (prof[0]?.full_name ?? "—") : (prof?.full_name ?? "—");
    const pa = personAgg.get(e.profile_id) ?? { name, late: 0, missing: 0, leave: 0 };
    pa.late += e.late_online_days;
    pa.missing += e.missing_checkout_count;
    pa.leave += leaveSum;
    personAgg.set(e.profile_id, pa);
  }

  const months = [...monthAgg.entries()]
    .sort((a, b) => fiscalMonthOrder(a[0]) - fiscalMonthOrder(b[0]))
    .map(([month, m]) => ({
      month,
      headcount: m.headcount,
      work_days: m.work,
      travel_days: m.travel,
      leave_total: m.leave,
      late_online: m.late,
      missing_checkout: m.missing,
    }));

  const persons = [...personAgg.entries()].map(([profile_id, p]) => ({ profile_id, ...p }));
  const top = (key: "late" | "missing" | "leave") =>
    persons
      .filter((p) => p[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 10)
      .map((p) => ({ profile_id: p.profile_id, name: p.name, value: p[key] }));

  return {
    buddhist_year: year,
    available_years: availableYears,
    months,
    leave_by_type: LEAVE_KEYS.map((k) => ({ key: k, total: leaveByType[k] })),
    totals,
    top_late: top("late"),
    top_missing: top("missing"),
    top_leave: top("leave"),
  };
}

// ─── Period CRUD ───────────────────────────────────────────

/**
 * Resolve the single faculty this system manages.
 * The deployment is single-faculty (คณะวิทยาการจัดการ), so we never ask
 * the user to pick: if there is exactly one department, that is it;
 * otherwise fall back to the acting HR user's own department.
 */
async function resolveDefaultDepartmentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data: depts } = await supabase.from("departments").select("id").limit(2);
  if (depts && depts.length === 1) return depts[0].id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .single();
  if (profile?.department_id) return profile.department_id;

  throw new Error("ยังไม่ได้กำหนดคณะ/หน่วยงานในระบบ — โปรดตั้งค่าที่หน้าข้อมูลหลัก");
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createAttendancePeriod(input: {
  department_id?: string;
  period_type?: "monthly" | "annual";
  buddhist_year: number;
  month?: number;
  working_days?: number;
  start_date?: string;
  end_date?: string;
  title?: string;
}) {
  const periodType = input.period_type ?? "monthly";
  const year = Number(input.buddhist_year);
  if (!Number.isInteger(year) || year < 2500 || year > 2700)
    throw new Error("ปี พ.ศ. ไม่ถูกต้อง");

  let month: number | null = null;
  let workingDays: number | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (periodType === "monthly") {
    month = Number(input.month);
    workingDays = Number(input.working_days);
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new Error("เดือนไม่ถูกต้อง");
    if (!Number.isFinite(workingDays) || workingDays < 0 || workingDays > 31)
      throw new Error("จำนวนวันทำงานไม่ถูกต้อง (0–31)");
  } else {
    // annual: optional date range describing the fiscal-year span
    if (input.start_date) {
      if (!ISO_DATE_RE.test(input.start_date)) throw new Error("วันเริ่มไม่ถูกต้อง");
      startDate = input.start_date;
    }
    if (input.end_date) {
      if (!ISO_DATE_RE.test(input.end_date)) throw new Error("วันสิ้นสุดไม่ถูกต้อง");
      endDate = input.end_date;
    }
    if (startDate && endDate && endDate < startDate)
      throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  }

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  // Single-faculty system: resolve the department automatically unless an
  // explicit (valid) one is provided.
  let departmentId = input.department_id;
  if (departmentId) {
    if (!UUID_RE.test(departmentId)) throw new Error("เลือกคณะไม่ถูกต้อง");
  } else {
    departmentId = await resolveDefaultDepartmentId(supabase, user.id);
  }

  const { data, error } = await supabase
    .from("attendance_periods")
    .insert({
      department_id: departmentId,
      period_type: periodType,
      buddhist_year: year,
      month,
      working_days: workingDays,
      start_date: startDate,
      end_date: endDate,
      title: input.title?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505")
      throw new Error(
        periodType === "annual"
          ? "มีรอบรายปีของปีงบฯ นี้แล้ว"
          : "มีรอบของคณะนี้ในเดือน/ปีนี้แล้ว",
      );
    throw new Error("สร้างรอบสรุปไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "create_attendance_period", "attendance_period", data.id, {
    department_id: departmentId,
    period_type: periodType,
    buddhist_year: year,
    month,
  });
  revalidatePath("/dashboard/hr/attendance");
  return data;
}

export async function deleteAttendancePeriod(periodId: string) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase.from("attendance_periods").delete().eq("id", periodId);
  if (error) throw new Error("ลบรอบสรุปไม่สำเร็จ");

  await logAudit(supabase, user.id, "delete_attendance_period", "attendance_period", periodId, {});
  revalidatePath("/dashboard/hr/attendance");
}

export async function setAttendancePeriodStatus(
  periodId: string,
  status: "draft" | "published",
) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  if (status !== "draft" && status !== "published")
    throw new Error("สถานะไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("attendance_periods")
    .update({ status })
    .eq("id", periodId);
  if (error) throw new Error("อัปเดตสถานะไม่สำเร็จ");

  await logAudit(supabase, user.id, "set_attendance_status", "attendance_period", periodId, {
    status,
  });
  revalidatePath("/dashboard/hr/attendance");
  revalidatePath(`/dashboard/hr/attendance/${periodId}`);
}

// ─── PDF parse (preview only — no DB write) ────────────────

/**
 * Parse an uploaded attendance PDF and return the rows for HR review.
 * Does NOT persist anything. HR maps each row to a profile in the grid,
 * then calls saveAttendanceEntries. The file itself is stored separately
 * via uploadAttendanceSource.
 */
export async function parseAttendancePdfAction(
  formData: FormData,
): Promise<ParseAttendanceResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์ PDF");
  if (file.type !== "application/pdf") throw new Error("รองรับเฉพาะไฟล์ PDF");
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์มีขนาดเกิน 5 MB");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const pageRaw = formData.get("page");
  const pageNumber = pageRaw ? Number(pageRaw) : undefined;

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await parseAttendancePdf(bytes, {
      pageNumber:
        pageNumber && Number.isInteger(pageNumber) && pageNumber > 0
          ? pageNumber
          : undefined,
    });
  } catch (err) {
    console.error("[attendance-actions] parse failed:", err);
    throw new Error("อ่านไฟล์ PDF ไม่สำเร็จ — ตรวจสอบว่าเป็นไฟล์สรุปการมาปฏิบัติงานที่ถูกต้อง");
  }
}

/** Upload the source PDF to Storage and link it to the period. */
export async function uploadAttendanceSource(periodId: string, formData: FormData) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  // uploadDocument enforces HR/Admin + type/size again; reuse it for storage.
  formData.set("path", "attendance");
  const { path } = await uploadDocument(formData);

  const { error } = await supabase
    .from("attendance_periods")
    .update({ source_file_url: path })
    .eq("id", periodId);
  if (error) throw new Error("บันทึกไฟล์แนบไม่สำเร็จ");

  await logAudit(supabase, user.id, "upload_attendance_source", "attendance_period", periodId, {
    path,
  });
  revalidatePath(`/dashboard/hr/attendance/${periodId}`);
  return { path };
}

// ─── Save entries (the reviewed grid) ──────────────────────

/**
 * Replace the entries of a round with the reviewed grid.
 * Delete-then-insert keeps "save = exactly what's in the grid" semantics
 * (handles rows HR removed). Entry data is always re-derivable from the PDF.
 */
export async function saveAttendanceEntries(
  periodId: string,
  entries: AttendanceEntryInput[],
) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  if (!Array.isArray(entries)) throw new Error("ข้อมูลไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  // Reject duplicate profiles (would violate the unique constraint).
  const seen = new Set<string>();
  const clean = entries.map((e) => {
    const s = sanitizeEntry(e);
    if (seen.has(s.profile_id))
      throw new Error("มีบุคลากรซ้ำกันในรายการ — 1 คนต่อ 1 แถวเท่านั้น");
    seen.add(s.profile_id);
    return s;
  });

  const { error: delErr } = await supabase
    .from("attendance_entries")
    .delete()
    .eq("period_id", periodId);
  if (delErr) throw new Error("บันทึกไม่สำเร็จ (ล้างข้อมูลเดิม)");

  if (clean.length > 0) {
    const rows = clean.map((e, i) => ({
      period_id: periodId,
      profile_id: e.profile_id,
      raw_name: e.raw_name ?? null,
      staff_line: e.staff_line ?? null,
      row_order: e.row_order ?? i + 1,
      work_days: e.work_days,
      travel_days: e.travel_days,
      leave_vacation: e.leave_vacation,
      leave_personal: e.leave_personal,
      leave_sick: e.leave_sick,
      leave_study: e.leave_study,
      leave_maternity: e.leave_maternity,
      leave_ordination: e.leave_ordination,
      total_days: e.total_days,
      late_online_days: e.late_online_days,
      missing_checkout_count: e.missing_checkout_count,
    }));
    const { error: insErr } = await supabase.from("attendance_entries").insert(rows);
    if (insErr) {
      console.error("[attendance-actions] insert entries failed:", insErr);
      throw new Error("บันทึกข้อมูลรายคนไม่สำเร็จ");
    }
  }

  await logAudit(supabase, user.id, "save_attendance_entries", "attendance_period", periodId, {
    count: clean.length,
  });
  revalidatePath(`/dashboard/hr/attendance/${periodId}`);
  return { count: clean.length };
}

// ─── Annual (รายปีงบประมาณ) ────────────────────────────────

/** Parse an uploaded ANNUAL leave PDF. HR/Admin only. No DB write. */
export async function parseAnnualPdfAction(
  formData: FormData,
): Promise<ParseAnnualResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์ PDF");
  if (file.type !== "application/pdf") throw new Error("รองรับเฉพาะไฟล์ PDF");
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์มีขนาดเกิน 5 MB");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await parseAnnualLeavePdf(bytes);
  } catch (err) {
    console.error("[attendance-actions] annual parse failed:", err);
    throw new Error("อ่านไฟล์ PDF ไม่สำเร็จ — ตรวจสอบว่าเป็นไฟล์สรุปวันลารายปีที่ถูกต้อง");
  }
}

export type AnnualEntryInput = {
  profile_id: string;
  raw_name?: string | null;
  staff_line?: "academic" | "support" | "contract" | null;
  row_order?: number | null;
  late_online_days: number;
  absent_days: number;
} & Record<AnnualLeaveKey, { count: number; days: number }>;

function num(v: unknown, max: number, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max)
    throw new Error(`ค่า ${label} ไม่ถูกต้อง (0–${max})`);
  return n;
}

/**
 * Replace the entries of an ANNUAL round with the reviewed grid.
 * Writes both the "วัน" (leave_*) and "ครั้ง" (leave_*_count) columns, plus
 * late_online_days and absent_days. Monthly-only columns stay at their
 * defaults (0).
 */
export async function saveAnnualEntries(
  periodId: string,
  entries: AnnualEntryInput[],
) {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  if (!Array.isArray(entries)) throw new Error("ข้อมูลไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser();
  await checkHrAdmin(supabase, user.id);

  const seen = new Set<string>();
  const cell = (e: AnnualEntryInput, f: AnnualLeaveKey) => e[f] ?? { count: 0, days: 0 };
  const rows = entries.map((e, i) => {
    if (!UUID_RE.test(e.profile_id)) throw new Error("profile_id ไม่ถูกต้อง");
    if (seen.has(e.profile_id))
      throw new Error("มีบุคลากรซ้ำกันในรายการ — 1 คนต่อ 1 แถวเท่านั้น");
    seen.add(e.profile_id);
    if (e.staff_line && !["academic", "support", "contract"].includes(e.staff_line))
      throw new Error("staff_line ไม่ถูกต้อง");

    return {
      period_id: periodId,
      profile_id: e.profile_id,
      raw_name: e.raw_name ?? null,
      staff_line: e.staff_line ?? null,
      row_order: e.row_order ?? i + 1,
      late_online_days: num(e.late_online_days, 366, "ลงเวลาสาย"),
      absent_days: num(e.absent_days, 366, "ขาดงาน"),
      leave_sick: num(cell(e, "leave_sick").days, 366, "ลาป่วย (วัน)"),
      leave_sick_count: num(cell(e, "leave_sick").count, 999, "ลาป่วย (ครั้ง)"),
      leave_personal: num(cell(e, "leave_personal").days, 366, "ลากิจ (วัน)"),
      leave_personal_count: num(cell(e, "leave_personal").count, 999, "ลากิจ (ครั้ง)"),
      leave_vacation: num(cell(e, "leave_vacation").days, 366, "ลาพักผ่อน (วัน)"),
      leave_vacation_count: num(cell(e, "leave_vacation").count, 999, "ลาพักผ่อน (ครั้ง)"),
      leave_maternity: num(cell(e, "leave_maternity").days, 366, "ลาคลอด (วัน)"),
      leave_maternity_count: num(cell(e, "leave_maternity").count, 999, "ลาคลอด (ครั้ง)"),
      leave_ordination: num(cell(e, "leave_ordination").days, 366, "ลาอุปสมบท (วัน)"),
      leave_ordination_count: num(cell(e, "leave_ordination").count, 999, "ลาอุปสมบท (ครั้ง)"),
      leave_spouse_childbirth: num(cell(e, "leave_spouse_childbirth").days, 366, "ลาช่วยภริยา (วัน)"),
      leave_spouse_childbirth_count: num(
        cell(e, "leave_spouse_childbirth").count,
        999,
        "ลาช่วยภริยา (ครั้ง)",
      ),
    };
  });

  const { error: delErr } = await supabase
    .from("attendance_entries")
    .delete()
    .eq("period_id", periodId);
  if (delErr) throw new Error("บันทึกไม่สำเร็จ (ล้างข้อมูลเดิม)");

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("attendance_entries").insert(rows);
    if (insErr) {
      console.error("[attendance-actions] insert annual entries failed:", insErr);
      throw new Error("บันทึกข้อมูลรายคนไม่สำเร็จ");
    }
  }

  await logAudit(supabase, user.id, "save_annual_entries", "attendance_period", periodId, {
    count: rows.length,
  });
  revalidatePath(`/dashboard/hr/attendance/${periodId}`);
  return { count: rows.length };
}

// ─── Verification vs leave_requests (Step E) ───────────────

/** Leave statuses that count as "taken/granted" for verification. */
const TAKEN_STATUSES = ["approved", "awaiting_university", "completed"] as const;

/** File annual leave key → system leave_types.code (only 4 are verifiable). */
export const ANNUAL_KEY_TO_CODE: Partial<Record<AnnualLeaveKey, string>> = {
  leave_sick: "SICK",
  leave_personal: "PERSONAL",
  leave_vacation: "VACATION",
  leave_maternity: "MATERNITY",
};

/** Resolve the [start,end] ISO (ค.ศ.) bounds of an annual period. */
function annualBounds(p: {
  buddhist_year: number;
  start_date: string | null;
  end_date: string | null;
}): { start: string; end: string } {
  if (p.start_date && p.end_date) return { start: p.start_date, end: p.end_date };
  // Thai fiscal year Y (พ.ศ.) = 1 Oct (ค.ศ. Y-543-1) … 30 Sep (ค.ศ. Y-543).
  const ce = p.buddhist_year - 543;
  return { start: `${ce - 1}-10-01`, end: `${ce}-09-30` };
}

function codeOf(lt: unknown): string | null {
  if (!lt) return null;
  const o = Array.isArray(lt) ? lt[0] : lt;
  return (o as { code?: string | null })?.code ?? null;
}

export interface AnnualLeaveStats {
  bounds: { start: string; end: string };
  /** profile_id → leave_types.code → { count, days } from leave_requests. */
  by_profile: Record<string, Record<string, { count: number; days: number }>>;
}

/**
 * Aggregate the SYSTEM's own leave_requests (the source of truth) for an
 * annual period's fiscal year, so HR can verify the university's file before
 * saving. Counts "taken" leaves per person per type (count = ครั้ง, days = วัน).
 * Manager/HR/Admin only.
 */
export async function getSystemLeaveStats(periodId: string): Promise<AnnualLeaveStats> {
  if (!UUID_RE.test(periodId)) throw new Error("รหัสรอบไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser();
  await checkManagerOrAbove(supabase, user.id);

  const { data: period, error: pErr } = await supabase
    .from("attendance_periods")
    .select("buddhist_year, start_date, end_date")
    .eq("id", periodId)
    .single();
  if (pErr || !period) throw new Error("ไม่พบรอบที่ต้องการ");

  const bounds = annualBounds(period);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("employee_id, working_days, total_days, start_date, status, leave_types(code)")
    .in("status", [...TAKEN_STATUSES])
    .gte("start_date", bounds.start)
    .lte("start_date", bounds.end);
  if (error) throw new Error("ไม่สามารถดึงข้อมูลใบลาในระบบได้");

  const byProfile: AnnualLeaveStats["by_profile"] = {};
  for (const r of data ?? []) {
    const code = codeOf((r as { leave_types?: unknown }).leave_types);
    if (!code) continue;
    const pid = r.employee_id as string;
    const days = Number(r.working_days ?? r.total_days ?? 0);
    byProfile[pid] ??= {};
    byProfile[pid][code] ??= { count: 0, days: 0 };
    byProfile[pid][code].count += 1;
    byProfile[pid][code].days += days;
  }

  return { bounds, by_profile: byProfile };
}

export interface LeaveInstance {
  id: string;
  code: string | null;
  type_name: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

/** Individual leave instances of one person in the period's fiscal year. */
export async function getProfileLeaveInstances(
  periodId: string,
  profileId: string,
): Promise<LeaveInstance[]> {
  if (!UUID_RE.test(periodId) || !UUID_RE.test(profileId))
    throw new Error("พารามิเตอร์ไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser();
  await checkManagerOrAbove(supabase, user.id);

  const { data: period, error: pErr } = await supabase
    .from("attendance_periods")
    .select("buddhist_year, start_date, end_date")
    .eq("id", periodId)
    .single();
  if (pErr || !period) throw new Error("ไม่พบรอบที่ต้องการ");
  const bounds = annualBounds(period);

  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, working_days, total_days, status, leave_types(code, name)",
    )
    .eq("employee_id", profileId)
    .in("status", [...TAKEN_STATUSES])
    .gte("start_date", bounds.start)
    .lte("start_date", bounds.end)
    .order("start_date", { ascending: true });
  if (error) throw new Error("ไม่สามารถดึงรายการลาได้");

  return (data ?? []).map((r) => {
    const lt = (r as { leave_types?: unknown }).leave_types;
    const o = Array.isArray(lt) ? lt[0] : lt;
    return {
      id: r.id as string,
      code: (o as { code?: string | null })?.code ?? null,
      type_name: (o as { name?: string })?.name ?? "—",
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      days: Number(r.working_days ?? r.total_days ?? 0),
      status: r.status as string,
    };
  });
}

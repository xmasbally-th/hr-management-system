"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  parseAttendancePdfAction,
  uploadAttendanceSource,
  saveAttendanceEntries,
  setAttendancePeriodStatus,
  type AttendanceEntryInput,
} from "@/lib/actions/attendance-actions";
import {
  periodLabel,
  DAY_COLUMNS,
  COUNT_COLUMNS,
  STAFF_LINE_LABELS,
} from "@/lib/attendance/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Save,
  Plus,
  Trash2,
  FileText,
  Check,
  AlertTriangle,
  ListOrdered,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────

type StaffLine = "" | "academic" | "support" | "contract";

interface RosterPerson {
  id: string;
  full_name: string;
  employee_type: string | null;
  position_title: string | null;
}

interface EntryRow {
  id?: string;
  profile_id: string;
  raw_name: string | null;
  staff_line: StaffLine | null;
  row_order: number | null;
  work_days: number;
  travel_days: number;
  leave_vacation: number;
  leave_personal: number;
  leave_sick: number;
  leave_study: number;
  leave_maternity: number;
  leave_ordination: number;
  total_days: number;
  late_online_days: number;
  missing_checkout_count: number;
  profile?: { full_name: string } | { full_name: string }[] | null;
}

interface Period {
  id: string;
  department_id: string;
  buddhist_year: number;
  month: number | null;
  working_days: number | null;
  title: string | null;
  status: "draft" | "published";
  source_file_url: string | null;
  department: { name: string } | { name: string }[] | null;
}

interface Props {
  period: Period;
  entries: EntryRow[];
  roster: RosterPerson[];
  sourceUrl: string | null;
  canManage: boolean;
}

type GridRow = {
  key: string;
  profile_id: string;
  staff_line: StaffLine;
  raw_name: string | null;
  work_days: number;
  travel_days: number;
  leave_vacation: number;
  leave_personal: number;
  leave_sick: number;
  leave_study: number;
  leave_maternity: number;
  leave_ordination: number;
  total_days: number;
  late_online_days: number;
  missing_checkout_count: number;
};

let keyCounter = 0;
const nextKey = () => `r${keyCounter++}`;

function deptName(d: Period["department"]): string {
  if (!d) return "—";
  return Array.isArray(d) ? (d[0]?.name ?? "—") : d.name;
}

function entryToGrid(e: EntryRow): GridRow {
  return {
    key: nextKey(),
    profile_id: e.profile_id ?? "",
    staff_line: (e.staff_line as StaffLine) ?? "",
    raw_name: e.raw_name ?? null,
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
  };
}

function partsSum(r: GridRow): number {
  return (
    r.work_days +
    r.travel_days +
    r.leave_vacation +
    r.leave_personal +
    r.leave_sick +
    r.leave_study +
    r.leave_maternity +
    r.leave_ordination
  );
}

const EMPTY_ROW = (): GridRow => ({
  key: nextKey(),
  profile_id: "",
  staff_line: "",
  raw_name: null,
  work_days: 0,
  travel_days: 0,
  leave_vacation: 0,
  leave_personal: 0,
  leave_sick: 0,
  leave_study: 0,
  leave_maternity: 0,
  leave_ordination: 0,
  total_days: 0,
  late_online_days: 0,
  missing_checkout_count: 0,
});

// ─── Read-only view (manager) ──────────────────────────────

function ReadonlyTable({ entries }: { entries: EntryRow[] }) {
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg bg-card py-12 text-center text-sm text-muted-foreground">
        ยังไม่มีข้อมูลในรอบนี้
      </div>
    );
  }
  const name = (e: EntryRow) =>
    Array.isArray(e.profile) ? e.profile[0]?.full_name : e.profile?.full_name;
  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/50">ชื่อ-สกุล</th>
            {DAY_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">{c.label}</th>
            ))}
            {COUNT_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">{c.label}</th>
            ))}
            <th className="px-2 py-2 font-medium">รวม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e, i) => (
            <tr key={e.id ?? i}>
              <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-card">
                {name(e) ?? e.raw_name ?? "—"}
              </td>
              {DAY_COLUMNS.map((c) => (
                <td key={c.key} className="px-2 py-1.5 text-center tabular-nums">
                  {(e[c.key] as number) || ""}
                </td>
              ))}
              {COUNT_COLUMNS.map((c) => (
                <td key={c.key} className="px-2 py-1.5 text-center tabular-nums">
                  {(e[c.key] as number) || ""}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-medium tabular-nums">{e.total_days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────

export function AttendanceReviewClient({
  period,
  entries,
  roster,
  sourceUrl,
  canManage,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<GridRow[]>(() => entries.map(entryToGrid));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(period.status);

  const profileItems = Object.fromEntries(roster.map((r) => [r.id, r.full_name]));

  function updateCell(key: string, field: keyof GridRow, value: number) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await runUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runUpload(file: File) {
    if (file.type !== "application/pdf") return toast.error("รองรับเฉพาะไฟล์ PDF");
    setUploading(true);
    try {
      const parseFd = new FormData();
      parseFd.set("file", file);
      const result = await parseAttendancePdfAction(parseFd);

      // Store the source PDF too (separate FormData to be safe).
      const upFd = new FormData();
      upFd.set("file", file);
      await uploadAttendanceSource(period.id, upFd).catch(() => {
        toast.warning("อ่านข้อมูลสำเร็จ แต่บันทึกไฟล์แนบไม่สำเร็จ");
      });

      const newRows: GridRow[] = result.rows.map((pr) => ({
        ...EMPTY_ROW(),
        raw_name: `แถวที่ ${pr.seq}`,
        work_days: pr.work_days,
        travel_days: pr.travel_days,
        leave_vacation: pr.leave_vacation,
        leave_personal: pr.leave_personal,
        leave_sick: pr.leave_sick,
        leave_study: pr.leave_study,
        leave_maternity: pr.leave_maternity,
        leave_ordination: pr.leave_ordination,
        total_days: pr.total_days,
        late_online_days: pr.late_online_days,
        missing_checkout_count: pr.missing_checkout_count,
      }));
      setRows(newRows);

      const mismatches = result.rows.filter((r) => !r.sum_matches_total).length;
      toast.success(`อ่านข้อมูลจากหน้า ${result.page_number} ได้ ${newRows.length} แถว`);
      if (mismatches > 0)
        toast.warning(`${mismatches} แถวยอดรวมไม่ตรง — โปรดตรวจสอบ`);
      if (result.skipped_rows > 0)
        toast.message(`ข้าม ${result.skipped_rows} แถวที่ไม่มีลำดับ (เช่น หัวข้อสาย)`);
      toast.message("ขั้นต่อไป: จับคู่ “บุคลากร” ให้แต่ละแถว แล้วกดบันทึก", { duration: 6000 });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function fillRosterInOrder() {
    setRows((rs) =>
      rs.map((r, i) => {
        const person = roster[i];
        if (!person) return r;
        return {
          ...r,
          profile_id: person.id,
          staff_line: r.staff_line || inferStaffLine(person),
        };
      }),
    );
    toast.message("เติมรายชื่อตามลำดับให้แล้ว — โปรดตรวจสอบความถูกต้อง");
  }

  function addRow() {
    setRows((rs) => [...rs, EMPTY_ROW()]);
  }
  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  async function handleSave() {
    const missing = rows.filter((r) => !r.profile_id).length;
    if (missing > 0) return toast.error(`ยังมี ${missing} แถวที่ยังไม่ได้เลือกบุคลากร`);

    const dupes = new Set<string>();
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.profile_id)) dupes.add(r.profile_id);
      seen.add(r.profile_id);
    }
    if (dupes.size > 0) return toast.error("มีบุคลากรซ้ำกันในตาราง — 1 คนต่อ 1 แถว");

    const payload: AttendanceEntryInput[] = rows.map((r, i) => ({
      profile_id: r.profile_id,
      raw_name: r.raw_name,
      staff_line: r.staff_line || null,
      row_order: i + 1,
      work_days: r.work_days,
      travel_days: r.travel_days,
      leave_vacation: r.leave_vacation,
      leave_personal: r.leave_personal,
      leave_sick: r.leave_sick,
      leave_study: r.leave_study,
      leave_maternity: r.leave_maternity,
      leave_ordination: r.leave_ordination,
      total_days: r.total_days,
      late_online_days: r.late_online_days,
      missing_checkout_count: r.missing_checkout_count,
    }));

    setSaving(true);
    try {
      await saveAttendanceEntries(period.id, payload);
      const mismatches = rows.filter((r) => partsSum(r) !== r.total_days).length;
      toast.success(`บันทึก ${payload.length} แถวแล้ว`);
      if (mismatches > 0) toast.warning(`มี ${mismatches} แถวที่ยอดรวมไม่ตรง (บันทึกไว้แล้ว)`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function togglePublish() {
    const next = status === "published" ? "draft" : "published";
    startTransition(async () => {
      try {
        await setAttendancePeriodStatus(period.id, next);
        setStatus(next);
        toast.success(next === "published" ? "เผยแพร่แล้ว" : "ยกเลิกการเผยแพร่แล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ");
      }
    });
  }

  const busy = uploading || saving || isPending;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/hr/attendance"
            className="rounded-lg border border-border p-2 hover:bg-muted mt-0.5"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">
                {periodLabel(period.month ?? 0, period.buddhist_year)}
              </h1>
              <Badge variant={status === "published" ? "default" : "secondary"}>
                {status === "published" ? "เผยแพร่แล้ว" : "ร่าง"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {deptName(period.department)} · วันทำงาน {period.working_days ?? "-"} วัน
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 h-8 hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              ไฟล์ต้นฉบับ
            </a>
          )}
          {canManage && (
            <Button variant="outline" onClick={togglePublish} disabled={busy}>
              {status === "published" ? (
                <EyeOff className="h-4 w-4 mr-1.5" />
              ) : (
                <Eye className="h-4 w-4 mr-1.5" />
              )}
              {status === "published" ? "ยกเลิกเผยแพร่" : "เผยแพร่"}
            </Button>
          )}
        </div>
      </div>

      {!canManage ? (
        <ReadonlyTable entries={entries} />
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-2 flex-wrap border border-border rounded-lg bg-card p-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFile}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              อัปโหลด PDF &amp; อ่านข้อมูล
            </Button>
            <Button
              variant="outline"
              onClick={fillRosterInOrder}
              disabled={busy || rows.length === 0 || roster.length === 0}
              title="เติมรายชื่อบุคลากรลงในแต่ละแถวตามลำดับ (โปรดตรวจสอบ)"
            >
              <ListOrdered className="h-4 w-4 mr-1.5" />
              เติมรายชื่อตามลำดับ
            </Button>
            <Button variant="outline" onClick={addRow} disabled={busy}>
              <Plus className="h-4 w-4 mr-1.5" />
              เพิ่มแถว
            </Button>
            <div className="ml-auto">
              <Button onClick={handleSave} disabled={busy || rows.length === 0}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                บันทึก
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
              อัปโหลดไฟล์ PDF เพื่อให้ระบบอ่านตัวเลขให้อัตโนมัติ หรือกด “เพิ่มแถว” เพื่อกรอกเอง
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium w-8">#</th>
                    <th className="px-2 py-2 font-medium text-left min-w-[180px]">บุคลากร *</th>
                    <th className="px-2 py-2 font-medium min-w-[120px]">สายงาน</th>
                    {DAY_COLUMNS.map((c) => (
                      <th key={c.key} className="px-1 py-2 font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="px-1 py-2 font-medium">รวม</th>
                    {COUNT_COLUMNS.map((c) => (
                      <th key={c.key} className="px-1 py-2 font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="px-1 py-2 font-medium w-8" />
                    <th className="px-1 py-2 font-medium w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => {
                    const ok = partsSum(r) === r.total_days;
                    return (
                      <tr key={r.key} className="hover:bg-muted/30">
                        <td className="px-2 py-1 text-center text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1">
                          <Select
                            items={profileItems}
                            value={r.profile_id}
                            onValueChange={(v) => v && updateRow(r.key, { profile_id: String(v) })}
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue placeholder="— เลือกบุคลากร —" />
                            </SelectTrigger>
                            <SelectContent>
                              {roster.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            items={STAFF_LINE_LABELS}
                            value={r.staff_line}
                            onValueChange={(v) =>
                              updateRow(r.key, { staff_line: (v as StaffLine) ?? "" })
                            }
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="academic">สายวิชาการ</SelectItem>
                              <SelectItem value="support">สายสนับสนุน</SelectItem>
                              <SelectItem value="contract">ลูกจ้าง</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {DAY_COLUMNS.map((c) => (
                          <td key={c.key} className="px-1 py-1">
                            <NumCell
                              value={r[c.key] as number}
                              onChange={(n) => updateCell(r.key, c.key, n)}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <NumCell
                            value={r.total_days}
                            onChange={(n) => updateCell(r.key, "total_days", n)}
                            strong
                          />
                        </td>
                        {COUNT_COLUMNS.map((c) => (
                          <td key={c.key} className="px-1 py-1">
                            <NumCell
                              value={r[c.key] as number}
                              onChange={(n) => updateCell(r.key, c.key, n)}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1 text-center">
                          {ok ? (
                            <Check className="h-4 w-4 text-emerald-600 inline" />
                          ) : (
                            <AlertTriangle
                              className="h-4 w-4 text-amber-500 inline"
                              aria-label={`ยอดรวมไม่ตรง (ผลรวม ${partsSum(r)} ≠ ${r.total_days})`}
                            />
                          )}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(r.key)}
                            className="text-destructive hover:bg-destructive/10 rounded p-1"
                            aria-label="ลบแถว"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />
            เครื่องหมายเตือนหมายถึงผลรวม (วันทำงาน+ไปราชการ+ลาทุกประเภท) ไม่เท่ากับคอลัมน์ “รวม” —
            ระบบยังบันทึกให้ได้ แต่ควรตรวจสอบกับไฟล์ต้นฉบับ
          </p>
        </>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function inferStaffLine(p: RosterPerson): StaffLine {
  const t = `${p.employee_type ?? ""} ${p.position_title ?? ""}`;
  if (/อาจารย์|ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|วิชาการ/.test(t)) return "academic";
  if (/ลูกจ้าง|จ้างเหมา/.test(t)) return "contract";
  return "";
}

function NumCell({
  value,
  onChange,
  strong,
}: {
  value: number;
  onChange: (n: number) => void;
  strong?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={31}
      value={value === 0 ? "" : value}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
      className={`h-8 w-14 text-center px-1 tabular-nums ${strong ? "font-semibold" : ""}`}
      placeholder="0"
    />
  );
}

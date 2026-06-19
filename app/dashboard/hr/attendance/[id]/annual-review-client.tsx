"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  parseAnnualPdfAction,
  uploadAttendanceSource,
  saveAnnualEntries,
  setAttendancePeriodStatus,
  getSystemLeaveStats,
  getProfileLeaveInstances,
  ANNUAL_KEY_TO_CODE,
  type AnnualEntryInput,
  type AnnualLeaveStats,
  type LeaveInstance,
} from "@/lib/actions/attendance-actions";
import { fiscalYearLabel, ANNUAL_LEAVE_COLUMNS, STAFF_LINE_LABELS } from "@/lib/attendance/labels";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Save,
  Plus,
  Trash2,
  FileText,
  ListOrdered,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";

/** Verifiable leave columns (the 4 types the system tracks in leave_requests). */
const VERIFY_COLUMNS = ANNUAL_LEAVE_COLUMNS.filter(
  (c) => ANNUAL_KEY_TO_CODE[c.key],
);

const STATUS_LABELS: Record<string, string> = {
  approved: "อนุมัติแล้ว",
  awaiting_university: "ส่งมหาวิทยาลัย",
  completed: "เสร็จสิ้น",
};

function thaiDate(d: string): string {
  return new Date(d).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

type StaffLine = "" | "academic" | "support" | "contract";
type LeaveKey = (typeof ANNUAL_LEAVE_COLUMNS)[number]["key"];
const LEAVE_KEYS = ANNUAL_LEAVE_COLUMNS.map((c) => c.key) as LeaveKey[];

interface RosterPerson {
  id: string;
  full_name: string;
  employee_type: string | null;
  position_title: string | null;
}

/** Loosely-typed DB entry row (entries selected with `*`). */
interface EntryRow {
  id?: string;
  profile_id: string;
  raw_name: string | null;
  staff_line: StaffLine | null;
  late_online_days: number;
  absent_days: number;
  profile?: { full_name: string } | { full_name: string }[] | null;
  [key: string]: unknown;
}

interface Period {
  id: string;
  buddhist_year: number;
  start_date: string | null;
  end_date: string | null;
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

type Cell = { count: number; days: number };
type GridRow = {
  key: string;
  profile_id: string;
  staff_line: StaffLine;
  raw_name: string | null;
  cells: Record<LeaveKey, Cell>;
  late_online_days: number;
  absent_days: number;
};

let keyCounter = 0;
const nextKey = () => `a${keyCounter++}`;

function emptyCells(): Record<LeaveKey, Cell> {
  return Object.fromEntries(LEAVE_KEYS.map((k) => [k, { count: 0, days: 0 }])) as Record<
    LeaveKey,
    Cell
  >;
}

function deptName(d: Period["department"]): string {
  if (!d) return "—";
  return Array.isArray(d) ? (d[0]?.name ?? "—") : d.name;
}

function entryToGrid(e: EntryRow): GridRow {
  const cells = emptyCells();
  for (const k of LEAVE_KEYS) {
    cells[k] = {
      days: Number(e[k] ?? 0),
      count: Number(e[`${k}_count`] ?? 0),
    };
  }
  return {
    key: nextKey(),
    profile_id: e.profile_id ?? "",
    staff_line: (e.staff_line as StaffLine) ?? "",
    raw_name: e.raw_name ?? null,
    cells,
    late_online_days: Number(e.late_online_days ?? 0),
    absent_days: Number(e.absent_days ?? 0),
  };
}

const EMPTY_ROW = (): GridRow => ({
  key: nextKey(),
  profile_id: "",
  staff_line: "",
  raw_name: null,
  cells: emptyCells(),
  late_online_days: 0,
  absent_days: 0,
});

function rangeText(p: Period): string {
  if (!p.start_date || !p.end_date) return fiscalYearLabel(p.buddhist_year);
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(p.start_date)} – ${fmt(p.end_date)}`;
}

// ─── Read-only (manager) ───────────────────────────────────

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
  const pair = (e: EntryRow, k: LeaveKey) => {
    const c = Number(e[`${k}_count`] ?? 0);
    const d = Number(e[k] ?? 0);
    return c || d ? `${c}/${d}` : "";
  };
  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/50">ชื่อ-สกุล</th>
            {ANNUAL_LEAVE_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">
                {c.label}
                <div className="font-normal text-[0.65rem]">ครั้ง/วัน</div>
              </th>
            ))}
            <th className="px-2 py-2 font-medium">สาย (วัน)</th>
            <th className="px-2 py-2 font-medium">ขาดงาน (วัน)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e, i) => (
            <tr key={e.id ?? i}>
              <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-card">
                {name(e) ?? e.raw_name ?? "—"}
              </td>
              {ANNUAL_LEAVE_COLUMNS.map((c) => (
                <td key={c.key} className="px-2 py-1.5 text-center tabular-nums">
                  {pair(e, c.key)}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center tabular-nums">{e.late_online_days || ""}</td>
              <td className="px-2 py-1.5 text-center tabular-nums">{e.absent_days || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────

export function AnnualReviewClient({ period, entries, roster, sourceUrl, canManage }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<GridRow[]>(() => entries.map(entryToGrid));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(period.status);

  // Verification vs leave_requests
  const [stats, setStats] = useState<AnnualLeaveStats | null>(null);
  const [comparing, setComparing] = useState(false);
  const [drill, setDrill] = useState<{ profileId: string; name: string } | null>(null);
  const [instances, setInstances] = useState<LeaveInstance[] | null>(null);

  const profileItems = Object.fromEntries(roster.map((r) => [r.id, r.full_name]));
  const nameOf = (id: string) => roster.find((r) => r.id === id)?.full_name ?? id;

  function updateRow(key: string, patch: Partial<GridRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function updateCell(key: string, leaveKey: LeaveKey, field: keyof Cell, value: number) {
    setRows((rs) =>
      rs.map((r) =>
        r.key === key
          ? { ...r, cells: { ...r.cells, [leaveKey]: { ...r.cells[leaveKey], [field]: value } } }
          : r,
      ),
    );
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
      const result = await parseAnnualPdfAction(parseFd);

      const upFd = new FormData();
      upFd.set("file", file);
      await uploadAttendanceSource(period.id, upFd).catch(() => {
        toast.warning("อ่านข้อมูลสำเร็จ แต่บันทึกไฟล์แนบไม่สำเร็จ");
      });

      const newRows: GridRow[] = result.rows.map((pr) => {
        const cells = emptyCells();
        for (const k of LEAVE_KEYS) {
          const c = pr[k as keyof typeof pr] as { count: number; days: number };
          cells[k] = { count: c.count, days: c.days };
        }
        return {
          ...EMPTY_ROW(),
          raw_name: `แถวที่ ${pr.seq} (หน้า ${pr.page})`,
          cells,
          late_online_days: pr.late_online_days,
          absent_days: pr.absent_days,
        };
      });
      setRows(newRows);

      toast.success(`อ่านข้อมูลได้ ${newRows.length} แถว จาก ${result.pages_parsed} หน้า`);
      if (result.skipped_rows > 0)
        toast.message(`ข้าม ${result.skipped_rows} แถวที่ไม่มีลำดับ (เช่น หัวข้อ/ยอดรวม)`);
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
      rs.map((r, i) => (roster[i] ? { ...r, profile_id: roster[i].id } : r)),
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
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.profile_id)) return toast.error("มีบุคลากรซ้ำกันในตาราง — 1 คนต่อ 1 แถว");
      seen.add(r.profile_id);
    }

    const payload: AnnualEntryInput[] = rows.map((r, i) => ({
      profile_id: r.profile_id,
      raw_name: r.raw_name,
      staff_line: r.staff_line || null,
      row_order: i + 1,
      late_online_days: r.late_online_days,
      absent_days: r.absent_days,
      leave_sick: r.cells.leave_sick,
      leave_personal: r.cells.leave_personal,
      leave_vacation: r.cells.leave_vacation,
      leave_maternity: r.cells.leave_maternity,
      leave_ordination: r.cells.leave_ordination,
      leave_spouse_childbirth: r.cells.leave_spouse_childbirth,
    }));

    setSaving(true);
    try {
      await saveAnnualEntries(period.id, payload);
      toast.success(`บันทึก ${payload.length} แถวแล้ว`);
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

  async function runCompare() {
    const matched = rows.filter((r) => r.profile_id).length;
    if (matched === 0) return toast.error("กรุณาจับคู่บุคลากรอย่างน้อย 1 แถวก่อนตรวจสอบ");
    setComparing(true);
    try {
      const s = await getSystemLeaveStats(period.id);
      setStats(s);
      toast.success("ดึงข้อมูลใบลาในระบบเพื่อเปรียบเทียบแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ตรวจสอบไม่สำเร็จ");
    } finally {
      setComparing(false);
    }
  }

  function openDrill(profileId: string) {
    setDrill({ profileId, name: nameOf(profileId) });
    setInstances(null);
    getProfileLeaveInstances(period.id, profileId)
      .then(setInstances)
      .catch(() => {
        setInstances([]);
        toast.error("ดึงรายการลาไม่สำเร็จ");
      });
  }

  const busy = uploading || saving || isPending || comparing;

  return (
    <div className="space-y-5">
      {/* Header */}
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
              <h1 className="text-xl font-bold tracking-tight">{fiscalYearLabel(period.buddhist_year)}</h1>
              <Badge variant="outline">รายปี</Badge>
              <Badge variant={status === "published" ? "default" : "secondary"}>
                {status === "published" ? "เผยแพร่แล้ว" : "ร่าง"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {deptName(period.department)} · {rangeText(period)}
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
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap border border-border rounded-lg bg-card p-3">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
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
            >
              <ListOrdered className="h-4 w-4 mr-1.5" />
              เติมรายชื่อตามลำดับ
            </Button>
            <Button variant="outline" onClick={addRow} disabled={busy}>
              <Plus className="h-4 w-4 mr-1.5" />
              เพิ่มแถว
            </Button>
            <Button
              variant="outline"
              onClick={runCompare}
              disabled={busy || rows.length === 0}
              title="เทียบ ครั้ง/วัน ในไฟล์ กับใบลาที่อนุมัติแล้วในระบบ"
            >
              {comparing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-1.5" />
              )}
              ตรวจสอบกับระบบ
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
              อัปโหลดไฟล์ PDF สรุปวันลารายปี เพื่อให้ระบบอ่านตัวเลขให้อัตโนมัติ หรือกด “เพิ่มแถว” เพื่อกรอกเอง
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium w-8">#</th>
                    <th className="px-2 py-2 font-medium text-left min-w-[170px]">บุคลากร *</th>
                    <th className="px-2 py-2 font-medium min-w-[110px]">สายงาน</th>
                    {ANNUAL_LEAVE_COLUMNS.map((c) => (
                      <th key={c.key} className="px-1 py-2 font-medium whitespace-nowrap" colSpan={2}>
                        {c.label}
                        <div className="font-normal text-[0.65rem]">ครั้ง · วัน</div>
                      </th>
                    ))}
                    <th className="px-1 py-2 font-medium">สาย<div className="font-normal text-[0.65rem]">วัน</div></th>
                    <th className="px-1 py-2 font-medium">ขาดงาน<div className="font-normal text-[0.65rem]">วัน</div></th>
                    <th className="px-1 py-2 font-medium w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
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
                          onValueChange={(v) => updateRow(r.key, { staff_line: (v as StaffLine) ?? "" })}
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
                      {LEAVE_KEYS.map((k) => (
                        <Pair
                          key={k}
                          cell={r.cells[k]}
                          onCount={(n) => updateCell(r.key, k, "count", n)}
                          onDays={(n) => updateCell(r.key, k, "days", n)}
                        />
                      ))}
                      <td className="px-1 py-1">
                        <NumCell value={r.late_online_days} onChange={(n) => updateRow(r.key, { late_online_days: n })} />
                      </td>
                      <td className="px-1 py-1">
                        <NumCell value={r.absent_days} onChange={(n) => updateRow(r.key, { absent_days: n })} />
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            แต่ละช่องลาเก็บเป็น “ครั้ง · วัน” (เช่น 3 ครั้ง รวม 7 วัน) — กด “ตรวจสอบกับระบบ”
            เพื่อเทียบกับใบลาที่อนุมัติในระบบก่อนบันทึก
          </p>

          {stats && (
            <ComparisonTable rows={rows} stats={stats} nameOf={nameOf} onDrill={openDrill} />
          )}
        </>
      )}

      {/* Drill-down: individual leave instances */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>รายการลาในระบบ — {drill?.name}</DialogTitle>
          </DialogHeader>
          {instances === null ? (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังโหลด…
            </div>
          ) : instances.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ไม่พบใบลาที่อนุมัติในช่วงปีงบประมาณนี้
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-80 overflow-y-auto">
              {instances.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it.type_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {thaiDate(it.start_date)} – {thaiDate(it.end_date)} ·{" "}
                      {STATUS_LABELS[it.status] ?? it.status}
                    </div>
                  </div>
                  <span className="text-sm tabular-nums shrink-0">{it.days} วัน</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Comparison vs leave_requests ──────────────────────────

function ComparisonTable({
  rows,
  stats,
  nameOf,
  onDrill,
}: {
  rows: GridRow[];
  stats: AnnualLeaveStats;
  nameOf: (id: string) => string;
  onDrill: (profileId: string) => void;
}) {
  const matched = rows.filter((r) => r.profile_id);
  const computed = matched.map((r) => {
    const cells = VERIFY_COLUMNS.map((c) => {
      const code = ANNUAL_KEY_TO_CODE[c.key]!;
      const file = r.cells[c.key];
      const sys = stats.by_profile[r.profile_id]?.[code] ?? { count: 0, days: 0 };
      const mismatch = file.count !== sys.count || file.days !== sys.days;
      return { key: c.key, label: c.label, file, sys, mismatch };
    });
    return { profile_id: r.profile_id, name: nameOf(r.profile_id), cells };
  });
  const mismatchCount = computed.reduce(
    (n, row) => n + row.cells.filter((c) => c.mismatch).length,
    0,
  );

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {mismatchCount === 0 ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
        <h3 className="font-semibold text-sm">ตรวจสอบกับใบลาในระบบ</h3>
        <span className="text-xs text-muted-foreground">
          (เทียบ 4 ประเภทที่ระบบมีข้อมูล: ป่วย/กิจ/พักผ่อน/คลอด)
        </span>
        <span className="ml-auto text-xs">
          {mismatchCount === 0 ? (
            <span className="text-emerald-600">ตรงกันทั้งหมด</span>
          ) : (
            <span className="text-amber-600 font-medium">พบ {mismatchCount} จุดที่ไม่ตรงกัน</span>
          )}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/50">ชื่อ-สกุล</th>
              {VERIFY_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 font-medium whitespace-nowrap">
                  {c.label}
                  <div className="font-normal text-[0.65rem]">ไฟล์ · ระบบ (ครั้ง/วัน)</div>
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {computed.map((row) => (
              <tr key={row.profile_id} className="hover:bg-muted/30">
                <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-card">{row.name}</td>
                {row.cells.map((cell) => (
                  <td
                    key={cell.key}
                    className={`px-2 py-1.5 text-center tabular-nums ${
                      cell.mismatch ? "bg-rose-50 dark:bg-rose-950/30" : ""
                    }`}
                  >
                    <div className={cell.mismatch ? "text-rose-600 font-medium" : ""}>
                      {cell.file.count}/{cell.file.days}
                    </div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      {cell.sys.count}/{cell.sys.days}
                      {cell.mismatch ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : (cell.file.count > 0 || cell.sys.count > 0) ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : null}
                    </div>
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => onDrill(row.profile_id)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Search className="h-3 w-3" /> ดูรายการ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground px-4 py-2 border-t border-border">
        “ระบบ” นับเฉพาะใบลาสถานะอนุมัติแล้ว/เสร็จสิ้น/ส่งมหาวิทยาลัย ในช่วงปีงบประมาณ ·
        แถวสีแดง = ตัวเลขในไฟล์ไม่ตรงกับระบบ ควรตรวจสอบก่อนบันทึก
      </p>
    </div>
  );
}

// ─── Cells ─────────────────────────────────────────────────

function Pair({
  cell,
  onCount,
  onDays,
}: {
  cell: Cell;
  onCount: (n: number) => void;
  onDays: (n: number) => void;
}) {
  return (
    <>
      <td className="px-0.5 py-1">
        <NumCell value={cell.count} onChange={onCount} />
      </td>
      <td className="px-0.5 py-1 border-r border-border">
        <NumCell value={cell.days} onChange={onDays} />
      </td>
    </>
  );
}

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      value={value === 0 ? "" : value}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
      className="h-8 w-12 text-center px-1 tabular-nums"
      placeholder="0"
    />
  );
}

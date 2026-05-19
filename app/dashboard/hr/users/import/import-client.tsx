"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { bulkImportEmployees, type ImportRow, type ImportResult } from "@/lib/actions/user-actions";
import {
  validateRow,
  REQUIRED_FIELDS,
  REQUIRED_FIELD_LABELS,
} from "@/lib/import-validation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "select" | "preview" | "result";

const EXPECTED_HEADERS = [
  "email",
  "title_th",
  "first_name_th",
  "last_name_th",
  "title_en",
  "first_name_en",
  "last_name_en",
  "position_number",
  "position_title",
  "employee_type",
  "department_name",
  "education_level",
  "birth_date",
  "hire_date",
  "gender",
  "phone",
  "current_address",
  "role",
] as const;


export function ImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  /** Map row index → list of validation errors */
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep("select");
    setFileName("");
    setRows([]);
    setParseErrors([]);
    setRowErrors({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setParseErrors([]);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: string[] = [];
        // Check header
        const headers = results.meta.fields ?? [];
        const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          errs.push(`ไม่พบ column: ${missing.join(", ")}`);
        }

        if (results.errors.length > 0) {
          for (const e of results.errors.slice(0, 3)) {
            errs.push(`แถว ${e.row ?? "?"}: ${e.message}`);
          }
        }

        const parsed: ImportRow[] = (results.data ?? [])
          .map((raw) => {
            const r: ImportRow = { email: raw.email ?? "" };
            for (const h of EXPECTED_HEADERS) {
              if (h === "email") continue;
              const v = raw[h];
              if (v !== undefined && v !== "") {
                (r as unknown as Record<string, string>)[h] = v;
              }
            }
            return r;
          })
          .filter((r) => r.email && r.email.trim());

        if (parsed.length === 0 && errs.length === 0) {
          errs.push("ไฟล์ไม่มีข้อมูล");
        }
        if (parsed.length > 500) {
          errs.push(`มี ${parsed.length} แถว — เกินขีดจำกัด 500 แถวต่อครั้ง`);
        }

        // Per-row validation pass — required fields, email format,
        // duplicates within batch, date format, role allowlist.
        const rowErrMap: Record<number, string[]> = {};
        const seenEmails = new Map<string, number>();
        parsed.forEach((row, idx) => {
          const rowErrs = validateRow(row, idx, seenEmails);
          if (rowErrs.length > 0) rowErrMap[idx] = rowErrs;
        });

        setParseErrors(errs);
        setRowErrors(rowErrMap);
        setRows(parsed);
        setStep("preview");
      },
      error: (err) => {
        setParseErrors([`อ่านไฟล์ไม่สำเร็จ: ${err.message}`]);
        setStep("preview");
      },
    });
  }

  function handleConfirm() {
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลให้นำเข้า");
      return;
    }
    if (parseErrors.length > 0) {
      toast.error("กรุณาแก้ไขปัญหาในไฟล์ก่อน");
      return;
    }
    if (Object.keys(rowErrors).length > 0) {
      toast.error(
        `มี ${Object.keys(rowErrors).length} แถวที่ข้อมูลไม่ครบหรือไม่ถูกต้อง — แก้ไขในไฟล์แล้วอัปโหลดใหม่`,
      );
      return;
    }

    startTransition(async () => {
      try {
        const r = await bulkImportEmployees(rows);
        setResult(r);
        setStep("result");
        if (r.success.length > 0) {
          toast.success(`นำเข้าสำเร็จ ${r.success.length} รายการ`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ";
        toast.error(message);
      }
    });
  }

  function downloadErrorReport() {
    if (!result) return;
    const failedAndSkipped = [
      ...result.failed.map((r) => ({ ...r, kind: "failed" })),
      ...result.skipped.map((r) => ({ ...r, kind: "skipped", error: r.reason })),
    ];
    const csv = Papa.unparse({
      fields: ["row", "email", "kind", "error"],
      data: failedAndSkipped.map((r) => [r.row, r.email, r.kind, r.error]),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Select step ────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">เลือกไฟล์ CSV</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ไฟล์ต้องมี header: email, title_th, first_name_th, last_name_th, ... (รวม 17 ช่อง)
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              อัปโหลด CSV
            </Button>
            <a
              href="/api/templates/employee-import"
              download="employee-import-template.csv"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-border bg-card hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              ดาวน์โหลดแม่แบบ
            </a>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <FormatGuide />
      </div>
    );
  }

  // ─── Preview step ───────────────────────────────────────────────────
  if (step === "preview") {
    const invalidRowCount = Object.keys(rowErrors).length;
    const validRowCount = rows.length - invalidRowCount;

    // When there are invalid rows, prioritise showing those so HR can
    // pinpoint what to fix. Otherwise show the first 10 valid rows.
    const invalidIndices = Object.keys(rowErrors)
      .map(Number)
      .sort((a, b) => a - b);
    const preview =
      invalidRowCount > 0
        ? invalidIndices.slice(0, 10).map((i) => ({ row: rows[i], index: i }))
        : rows.slice(0, 10).map((row, index) => ({ row, index }));

    const canConfirm =
      parseErrors.length === 0 &&
      rows.length > 0 &&
      invalidRowCount === 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm">
              <FileSpreadsheet className="h-4 w-4 inline mr-1" />
              <span className="font-mono text-xs">{fileName}</span> ·{" "}
              <span className="font-semibold">{rows.length} แถว</span>
              {invalidRowCount > 0 && (
                <span className="text-destructive ml-2">
                  · มีปัญหา {invalidRowCount} แถว
                </span>
              )}
              {invalidRowCount === 0 && rows.length > 0 && (
                <span className="text-emerald-700 ml-2">
                  · ตรวจสอบผ่าน {validRowCount} แถว
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={reset} disabled={isPending}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            เลือกไฟล์ใหม่
          </Button>
        </div>

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              ปัญหาระดับไฟล์ {parseErrors.length} รายการ
            </div>
            <ul className="text-xs text-destructive/80 list-disc pl-5">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {invalidRowCount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              {invalidRowCount} แถวข้อมูลไม่ครบหรือไม่ถูกต้อง — แก้ไขในไฟล์แล้วอัปโหลดใหม่
            </div>
            <p className="text-xs text-destructive/80">
              ฟิลด์ที่บังคับ:{" "}
              {REQUIRED_FIELDS.map((f) => REQUIRED_FIELD_LABELS[f]).join(" · ")}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium">
            {invalidRowCount > 0
              ? `แถวที่มีปัญหา (แสดง ${preview.length} จาก ${invalidRowCount})`
              : `ตัวอย่าง 10 แถวแรก`}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">อีเมล</TableHead>
                  <TableHead className="text-xs">ชื่อ-สกุล (ไทย)</TableHead>
                  <TableHead className="text-xs">ตำแหน่ง</TableHead>
                  <TableHead className="text-xs">แผนก</TableHead>
                  <TableHead className="text-xs">role</TableHead>
                  <TableHead className="text-xs">ข้อผิดพลาด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map(({ row: r, index }) => {
                  const errs = rowErrors[index] ?? [];
                  const hasErr = errs.length > 0;
                  return (
                    <TableRow
                      key={index}
                      className={cn(hasErr && "bg-destructive/5")}
                    >
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.email}</TableCell>
                      <TableCell className="text-xs">
                        {[r.title_th, r.first_name_th, r.last_name_th]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.position_title || "—"}</TableCell>
                      <TableCell className="text-xs">{r.department_name || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.role || "employee"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasErr ? (
                          <div className="space-y-0.5">
                            {errs.map((e, i) => (
                              <div
                                key={i}
                                className="inline-flex items-center gap-1 text-destructive"
                              >
                                <XCircle className="size-3 shrink-0" />
                                {e}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {invalidRowCount === 0 && rows.length > 10 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              ... และอีก {rows.length - 10} แถว (ทั้งหมดผ่านการตรวจสอบ)
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={reset} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            ยืนยันการนำเข้า ({validRowCount} แถว)
          </Button>
        </div>
      </div>
    );
  }

  // ─── Result step ────────────────────────────────────────────────────
  if (step === "result" && result) {
    const total = result.success.length + result.failed.length + result.skipped.length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResultCard
            label="สำเร็จ"
            value={result.success.length}
            total={total}
            tone="emerald"
            icon={CheckCircle2}
          />
          <ResultCard
            label="ล้มเหลว"
            value={result.failed.length}
            total={total}
            tone="rose"
            icon={XCircle}
          />
          <ResultCard
            label="ข้าม"
            value={result.skipped.length}
            total={total}
            tone="amber"
            icon={AlertCircle}
          />
        </div>

        {(result.failed.length > 0 || result.skipped.length > 0) && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-medium">รายการที่ไม่สำเร็จ</div>
              <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                ดาวน์โหลด CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">อีเมล</TableHead>
                    <TableHead className="text-xs">ประเภท</TableHead>
                    <TableHead className="text-xs">เหตุผล</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.failed.map((r) => (
                    <TableRow key={`f-${r.row}`}>
                      <TableCell className="text-xs font-mono">{r.row}</TableCell>
                      <TableCell className="text-xs font-mono">{r.email}</TableCell>
                      <TableCell>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                          ล้มเหลว
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-rose-700">{r.error}</TableCell>
                    </TableRow>
                  ))}
                  {result.skipped.map((r) => (
                    <TableRow key={`s-${r.row}`}>
                      <TableCell className="text-xs font-mono">{r.row}</TableCell>
                      <TableCell className="text-xs font-mono">{r.email}</TableCell>
                      <TableCell>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                          ข้าม
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-amber-700">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={reset}>
            นำเข้าไฟล์อื่น
          </Button>
          <Button onClick={() => router.push("/dashboard/hr/users")}>
            ไปยังรายชื่อพนักงาน
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function ResultCard({
  label,
  value,
  total,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  tone: "emerald" | "rose" | "amber";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const cls = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  }[tone];
  return (
    <div className={cn("rounded-xl border-2 p-4", cls)}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold font-mono">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">
        {pct}% ของ {total} แถว
      </div>
    </div>
  );
}

// ─── Column reference table for the import format ──────────────────────────

interface FieldDef {
  name: string;
  thai: string;
  required: boolean;
  notes: string;
  example: string;
}

const FIELDS: FieldDef[] = [
  { name: "email", thai: "อีเมล", required: true, notes: "ต้องอยู่ในโดเมนที่อนุญาต · ห้ามซ้ำ", example: "somchai.j@g.lpru.ac.th" },
  { name: "title_th", thai: "คำนำหน้า (ไทย)", required: false, notes: "นาย / นาง / นางสาว / ผศ. / รศ. / ศ. / ดร. / ผศ.ดร. / รศ.ดร. / ศ.ดร.", example: "ผศ.ดร." },
  { name: "first_name_th", thai: "ชื่อ (ไทย)", required: false, notes: "", example: "สมชาย" },
  { name: "last_name_th", thai: "นามสกุล (ไทย)", required: false, notes: "", example: "ใจดี" },
  { name: "title_en", thai: "คำนำหน้า (อังกฤษ)", required: false, notes: "", example: "Asst.Prof.Dr." },
  { name: "first_name_en", thai: "ชื่อ (อังกฤษ)", required: false, notes: "", example: "Somchai" },
  { name: "last_name_en", thai: "นามสกุล (อังกฤษ)", required: false, notes: "", example: "Jaidee" },
  { name: "position_number", thai: "เลขที่ตำแหน่ง", required: false, notes: "เลขที่ตามคำสั่งกรอบอัตรากำลัง", example: "P-001" },
  { name: "position_title", thai: "ตำแหน่ง", required: false, notes: "เช่น อาจารย์ / ผู้ช่วยศาสตราจารย์ / เจ้าหน้าที่บริหารงานทั่วไป", example: "อาจารย์" },
  { name: "employee_type", thai: "ประเภทบุคลากร", required: false, notes: "ข้าราชการ / พนักงานมหาวิทยาลัย / พนักงานราชการ / พนักงานชั่วคราว / ลูกจ้างประจำ", example: "พนักงานมหาวิทยาลัย" },
  { name: "department_name", thai: "สังกัดหน่วยงาน", required: false, notes: "ต้องตรงกับชื่อแผนกใน ตั้งค่า → แผนก (ตัวพิมพ์ไม่ต้องเท่า) — ไม่พบ = ข้ามแถว", example: "สาขาวิทยาการคอมพิวเตอร์" },
  { name: "education_level", thai: "วุฒิการศึกษา", required: false, notes: "ปริญญาตรี / ปริญญาโท / ปริญญาเอก / ปวส. / ปวช. / อื่น ๆ", example: "ปริญญาเอก" },
  { name: "birth_date", thai: "วันเดือนปีเกิด", required: false, notes: "รูปแบบ YYYY-MM-DD", example: "1985-05-12" },
  { name: "hire_date", thai: "วันที่เริ่มทำงาน", required: false, notes: "รูปแบบ YYYY-MM-DD", example: "2015-06-01" },
  { name: "gender", thai: "เพศ", required: false, notes: "ชาย / หญิง / ไม่ระบุ", example: "ชาย" },
  { name: "phone", thai: "เบอร์โทรศัพท์", required: false, notes: "", example: "0812345678" },
  { name: "current_address", thai: "ที่อยู่ปัจจุบัน", required: false, notes: "", example: "123/4 ถ.สนามบิน อ.เมือง จ.ลำปาง" },
  { name: "role", thai: "สิทธิ์ระบบ", required: false, notes: "employee / manager / hr / admin (default: employee)", example: "employee" },
];

function FormatGuide() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-semibold flex items-center gap-2 mb-1">
          📋 รูปแบบไฟล์ CSV
        </div>
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          <li>
            ไฟล์ต้องเป็น <b>CSV</b> เข้ารหัส <b>UTF-8</b> มีแถวแรกเป็น header
            ตามชื่อ column ภาษาอังกฤษทางด้านล่าง
          </li>
          <li>
            <b>email</b> เป็นช่องเดียวที่ <b>บังคับ</b> — column อื่นเว้นว่างได้
            (แต่ HR ควรกรอกให้ครบ เพราะระบบเอาไปใช้ในเอกสารต่าง ๆ)
          </li>
          <li>
            <b>วันที่</b> ใช้รูปแบบ <code className="font-mono bg-muted px-1 rounded">YYYY-MM-DD</code>{" "}
            (เช่น 1985-05-12 — ปี ค.ศ.)
          </li>
          <li>
            <b>department_name</b> ต้องตรงกับชื่อหน่วยงานในระบบ
            (ตั้งค่า → ข้อมูลหลัก → แผนก) — ถ้าไม่พบจะข้ามแถวนั้น
          </li>
          <li>
            อีเมลต้องอยู่ในโดเมนที่อนุญาต (ตั้งจาก env{" "}
            <code className="font-mono bg-muted px-1 rounded">NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS</code>)
          </li>
          <li>ห้ามมีอีเมลซ้ำในไฟล์ และห้ามซ้ำกับที่มีอยู่ในระบบ</li>
          <li>
            ผู้ใช้ที่นำเข้าจะเข้าสู่ระบบครั้งแรกผ่าน Google ตามอีเมล —
            ระบบ <b>link อัตโนมัติ</b> ตามอีเมล
          </li>
          <li>นำเข้าได้สูงสุด <b>500 แถวต่อครั้ง</b></li>
        </ul>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 space-y-2">
        <div className="font-semibold flex items-center gap-2">
          💡 หากเปิดไฟล์แม่แบบใน Microsoft Excel
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            ภาษาไทยควรแสดงผลถูกต้อง — แม่แบบมี <b>UTF-8 BOM</b> ในตัว
            (ถ้ายังเห็น <code className="font-mono bg-sky-100 px-1 rounded">เธเธ•เธ•</code> แสดงว่าโหลดไฟล์เก่า ลองเคลียร์ cache แล้วโหลดใหม่)
          </li>
          <li>
            <b>เบอร์โทร</b> และ <b>เลขที่ตำแหน่ง</b> ในแม่แบบใช้รูปแบบ{" "}
            <code className="font-mono bg-sky-100 px-1 rounded">=&quot;0812345678&quot;</code> เพื่อกัน Excel ตัดเลข 0 หน้า — ระบบจะแกะออกให้อัตโนมัติเมื่อ import
          </li>
          <li>
            <b>แนะนำ:</b> แก้ไขใน Google Sheets หรือ LibreOffice
            แล้วบันทึกเป็น CSV (UTF-8) จะเสถียรกว่า Excel
          </li>
          <li>
            ถ้า <b>ต้องใช้ Excel</b> เพื่อ save: ใช้{" "}
            <b>File → Save As → CSV UTF-8 (Comma delimited)</b>{" "}
            (ไม่ใช่ &quot;CSV (Comma delimited)&quot; แบบเดิม)
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">
          รายละเอียดคอลัมน์ ({FIELDS.length} ช่อง)
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Column</TableHead>
                <TableHead className="text-xs">ความหมาย</TableHead>
                <TableHead className="text-xs w-16">บังคับ</TableHead>
                <TableHead className="text-xs">หมายเหตุ / ค่าที่ยอมรับ</TableHead>
                <TableHead className="text-xs">ตัวอย่าง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELDS.map((f) => (
                <TableRow key={f.name}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {f.name}
                  </TableCell>
                  <TableCell className="text-xs">{f.thai}</TableCell>
                  <TableCell>
                    {f.required ? (
                      <span className="text-xs font-semibold text-rose-600">บังคับ</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.notes || "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {f.example}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
        <div className="font-semibold flex items-center gap-2">⚠️ ข้อมูลที่ไม่อยู่ใน CSV</div>
        <p>
          ข้อมูลขั้นสูงต่อไปนี้ต้องให้พนักงานกรอกเองในหน้าโปรไฟล์
          หรือให้ HR กรอกใน <b>/dashboard/hr/users/&#123;id&#125;</b> ภายหลัง
          (เนื่องจากเป็นข้อมูลแบบหลายรายการต่อคน):
        </p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>รูปประจำตัว (500×500 px — อัปโหลดในหน้าโปรไฟล์)</li>
          <li>ประวัติการศึกษา (เพิ่มทีละรายการ)</li>
          <li>ประวัติการได้รับเครื่องราชอิสริยาภรณ์</li>
          <li>ประวัติการบริหาร</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { bulkImportEmployees, type ImportRow, type ImportResult } from "@/lib/actions/user-actions";
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
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep("select");
    setFileName("");
    setRows([]);
    setParseErrors([]);
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

        setParseErrors(errs);
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
              href="/templates/employee-import-template.csv"
              download
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

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
          <div className="font-medium text-foreground">📋 หมายเหตุ</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>ระบบจะสร้าง <b>placeholder profile</b> โดยยังไม่มี auth user — พนักงานจะอ้างสิทธิ์ของตัวเองเมื่อเข้าสู่ระบบครั้งแรกด้วย Google (ผ่าน email match)</li>
            <li>อีเมลต้องอยู่ในโดเมนที่อนุญาต (ดูตาราง preview)</li>
            <li>department_name ต้องตรงกับชื่อแผนกที่มีอยู่ในระบบ (เช็คได้ที่หน้า ตั้งค่า → แผนก)</li>
            <li>role: employee / manager / hr / admin (ค่าเริ่มต้น: employee)</li>
            <li>วันที่ใช้รูปแบบ YYYY-MM-DD เช่น 1985-05-12</li>
            <li>นำเข้าได้สูงสุด 500 แถวต่อครั้ง</li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── Preview step ───────────────────────────────────────────────────
  if (step === "preview") {
    const preview = rows.slice(0, 10);
    const canConfirm = parseErrors.length === 0 && rows.length > 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm">
              <FileSpreadsheet className="h-4 w-4 inline mr-1" />
              <span className="font-mono text-xs">{fileName}</span> ·{" "}
              <span className="font-semibold">{rows.length} แถว</span>
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
              พบปัญหา {parseErrors.length} รายการ
            </div>
            <ul className="text-xs text-destructive/80 list-disc pl-5">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium">
            ตัวอย่าง 10 แถวแรก
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {i + 1}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > 10 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              ... และอีก {rows.length - 10} แถว
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
            ยืนยันการนำเข้า ({rows.length} แถว)
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

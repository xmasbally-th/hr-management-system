"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  initializeAllEmployeesBalances,
  importLeaveBalances,
  type InitBalancesResult,
  type BalanceImportRow,
  type BalanceImportResult,
} from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  PlayCircle,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  currentFiscalYear: number;
  fiscalYearOptions: number[];
}

const EXPECTED_HEADERS = [
  "email",
  "sick_remaining",
  "personal_remaining",
  "vacation_remaining",
  "vacation_accumulated",
] as const;

type ImportStep = "select" | "preview" | "result";

export function LeaveBalancesClient({ currentFiscalYear, fiscalYearOptions }: Props) {
  const router = useRouter();
  const [fy, setFy] = useState(currentFiscalYear);

  // ── Init section ──
  const [isIniting, startInit] = useTransition();
  const [initResult, setInitResult] = useState<InitBalancesResult | null>(null);

  function handleInitAll() {
    setInitResult(null);
    startInit(async () => {
      try {
        const r = await initializeAllEmployeesBalances(fy);
        setInitResult(r);
        toast.success(`สร้างยอดวันลา ${r.rowsCreated} รายการ (ข้าม ${r.rowsSkipped})`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  // ── Import section ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, startImport] = useTransition();
  const [step, setStep] = useState<ImportStep>("select");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BalanceImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<BalanceImportResult | null>(null);

  function resetImport() {
    setStep("select");
    setFileName("");
    setRows([]);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setParseErrors([]);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        const errs: string[] = [];
        const headers = results.meta.fields ?? [];
        const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) errs.push(`ไม่พบ column: ${missing.join(", ")}`);

        const parsed: BalanceImportRow[] = (results.data ?? [])
          .map((raw: Record<string, string>) => ({
            email: raw.email ?? "",
            sick_remaining: raw.sick_remaining ?? "",
            personal_remaining: raw.personal_remaining ?? "",
            vacation_remaining: raw.vacation_remaining ?? "",
            vacation_accumulated: raw.vacation_accumulated ?? "",
          }))
          .filter((r: BalanceImportRow) => r.email && r.email.trim());

        if (parsed.length === 0 && errs.length === 0) errs.push("ไฟล์ไม่มีข้อมูล");
        if (parsed.length > 1000) errs.push(`มี ${parsed.length} แถว — เกินขีดจำกัด 1000 แถว`);

        setParseErrors(errs);
        setRows(parsed);
        setStep("preview");
      },
      error: (err: Error) => {
        setParseErrors([`อ่านไฟล์ไม่สำเร็จ: ${err.message}`]);
        setStep("preview");
      },
    });
  }

  function handleConfirmImport() {
    if (rows.length === 0 || parseErrors.length > 0) {
      toast.error("กรุณาแก้ไขไฟล์ก่อนนำเข้า");
      return;
    }
    startImport(async () => {
      try {
        const r = await importLeaveBalances(rows, fy);
        setImportResult(r);
        setStep("result");
        if (r.success.length > 0) toast.success(`นำเข้าสำเร็จ ${r.success.length} แถว`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
      }
    });
  }

  function downloadTemplate() {
    const csv = Papa.unparse({
      fields: [...EXPECTED_HEADERS],
      data: [["somchai.j@g.lpru.ac.th", "30", "10", "10", "5"]],
    });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leave-balance-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* FY selector */}
      <div className="flex items-center gap-3">
        <Label htmlFor="fy" className="text-sm whitespace-nowrap">
          ปีงบประมาณ
        </Label>
        <select
          id="fy"
          value={fy}
          onChange={(e) => setFy(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {fiscalYearOptions.map((y) => (
            <option key={y} value={y}>
              {y + 543}
            </option>
          ))}
        </select>
      </div>

      {/* ── Init section ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">เริ่มต้นสิทธิ์วันลา (ทั้งองค์กร)</h2>
        <p className="text-sm text-muted-foreground">
          สร้างยอดวันลาเริ่มต้นตามสิทธิ์เต็มให้พนักงานทุกคนที่ยังไม่มีในปีงบฯ {fy + 543}
          — ไม่ทับข้อมูลที่มีอยู่แล้ว (เหมาะกับพนักงานใหม่/ขึ้นปีใหม่)
        </p>
        <Button onClick={handleInitAll} disabled={isIniting}>
          {isIniting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          เริ่มต้นสิทธิ์วันลาปีงบฯ {fy + 543}
        </Button>
        {initResult && (
          <div className="text-sm rounded-md bg-muted/50 p-3">
            พนักงาน {initResult.employeesProcessed} คน · สร้างใหม่{" "}
            <span className="font-semibold text-emerald-700">{initResult.rowsCreated}</span> รายการ ·
            ข้าม (มีอยู่แล้ว) {initResult.rowsSkipped} รายการ
          </div>
        )}
      </div>

      {/* ── Import section ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold">นำเข้ายอดวันลาคงเหลือ (CSV)</h2>
            <p className="text-sm text-muted-foreground">
              สำหรับเปิดระบบครั้งแรกกลางปี — กรอก<b>วันคงเหลือ</b>ของแต่ละคน ระบบคำนวณวันที่ใช้ไปให้
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            ดาวน์โหลดแม่แบบ
          </Button>
        </div>

        {/* Format guide */}
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 space-y-1">
          <p className="font-semibold">รูปแบบไฟล์ (1 แถว/พนักงาน):</p>
          <p className="font-mono">
            email, sick_remaining, personal_remaining, vacation_remaining, vacation_accumulated
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>กรอก<b>วันคงเหลือ</b>ของแต่ละประเภท (เว้นว่าง = เต็มสิทธิ์ ยังไม่ใช้)</li>
            <li>vacation_accumulated = วันสะสมยกมาจากปีก่อน (เกินเพดานประเภทบุคลากรจะถูกปรับลง)</li>
            <li>match พนักงานด้วยอีเมล · ลาคลอดไม่ต้องนำเข้า (เป็นรายครั้ง)</li>
          </ul>
        </div>

        {/* Select step */}
        {step === "select" && (
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <FileSpreadsheet className="h-9 w-9 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">เลือกไฟล์ CSV (UTF-8)</p>
            <Button className="mt-4" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" />
              อัปโหลด CSV
            </Button>
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
        )}

        {/* Preview step */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
              <span>
                <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                <span className="font-mono text-xs">{fileName}</span> ·{" "}
                <span className="font-semibold">{rows.length} แถว</span>
              </span>
              <Button variant="outline" size="sm" onClick={resetImport} disabled={isImporting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                เลือกไฟล์ใหม่
              </Button>
            </div>

            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <ul className="list-disc pl-5">
                  {parseErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">อีเมล</TableHead>
                    <TableHead className="text-xs text-center">ป่วย</TableHead>
                    <TableHead className="text-xs text-center">กิจ</TableHead>
                    <TableHead className="text-xs text-center">พักผ่อน</TableHead>
                    <TableHead className="text-xs text-center">สะสม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-mono">{r.email}</TableCell>
                      <TableCell className="text-xs text-center">{r.sick_remaining || "—"}</TableCell>
                      <TableCell className="text-xs text-center">{r.personal_remaining || "—"}</TableCell>
                      <TableCell className="text-xs text-center">{r.vacation_remaining || "—"}</TableCell>
                      <TableCell className="text-xs text-center">{r.vacation_accumulated || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 10 && (
              <p className="text-xs text-muted-foreground">... และอีก {rows.length - 10} แถว</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetImport} disabled={isImporting}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || parseErrors.length > 0 || rows.length === 0}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                ยืนยันนำเข้า ({rows.length} แถว) → ปีงบฯ {fy + 543}
              </Button>
            </div>
          </div>
        )}

        {/* Result step */}
        {step === "result" && importResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <ResultStat label="สำเร็จ" value={importResult.success.length} tone="emerald" icon={CheckCircle2} />
              <ResultStat label="ล้มเหลว" value={importResult.failed.length} tone="rose" icon={XCircle} />
              <ResultStat label="คำเตือน" value={importResult.warnings.length} tone="amber" icon={AlertTriangle} />
            </div>

            {(importResult.failed.length > 0 || importResult.warnings.length > 0) && (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">อีเมล</TableHead>
                      <TableHead className="text-xs">ประเภท</TableHead>
                      <TableHead className="text-xs">รายละเอียด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.failed.map((r) => (
                      <TableRow key={`f-${r.row}`}>
                        <TableCell className="text-xs font-mono">{r.row}</TableCell>
                        <TableCell className="text-xs font-mono">{r.email}</TableCell>
                        <TableCell className="text-xs text-rose-700">ล้มเหลว</TableCell>
                        <TableCell className="text-xs text-rose-700">{r.error}</TableCell>
                      </TableRow>
                    ))}
                    {importResult.warnings.map((r, i) => (
                      <TableRow key={`w-${r.row}-${i}`}>
                        <TableCell className="text-xs font-mono">{r.row}</TableCell>
                        <TableCell className="text-xs font-mono">{r.email}</TableCell>
                        <TableCell className="text-xs text-amber-700">คำเตือน</TableCell>
                        <TableCell className="text-xs text-amber-700">{r.warning}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={resetImport}>
                นำเข้าไฟล์อื่น
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  }[tone];
  return (
    <div className={`rounded-lg border-2 p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}

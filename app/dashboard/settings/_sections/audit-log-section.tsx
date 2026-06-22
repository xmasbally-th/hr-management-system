"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getAuditLogs,
  getAuditActionTypes,
  getAuditTargetTypes,
  exportAuditLogs,
  type AuditLogRow,
  type AuditLogFilters,
} from "@/lib/actions/audit-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, ChevronLeft, ChevronRight, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACTION_TONE: Record<string, string> = {
  CREATE: "emerald",
  UPDATE: "sky",
  APPROVE: "emerald",
  REJECT: "rose",
  DELETE: "rose",
  ROLE_CHANGED: "rose",
  STATUS_CHANGED: "amber",
};

function actionToneClass(action: string): string {
  // Try uppercase prefix match (CREATE_X, UPDATE_X, etc.)
  const upper = action.toUpperCase();
  for (const key of Object.keys(ACTION_TONE)) {
    if (upper.startsWith(key)) return ACTION_TONE[key];
  }
  if (upper.includes("DELETE")) return "rose";
  if (upper.includes("UPDATE")) return "sky";
  if (upper.includes("CREATE") || upper.includes("BULK")) return "emerald";
  return "slate";
}

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function AuditLogSection() {
  const [isPending, startTransition] = useTransition();
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
  const [targetIdFilter, setTargetIdFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function buildFilters(): AuditLogFilters {
    return {
      action: actionFilter,
      targetType: targetTypeFilter,
      targetId: targetIdFilter.trim() || undefined,
      userSearch: userSearch.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
  }

  /** Apply a quick date preset (e.g. last 7 days). End = today (local). */
  function applyDatePreset(days: number) {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const startMs = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
    const start = new Date(startMs).toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
    setTimeout(() => load(1), 0);
  }

  async function load(p: number = page) {
    startTransition(async () => {
      try {
        const res = await getAuditLogs({
          page: p,
          pageSize,
          ...buildFilters(),
        });
        setRows(res.rows);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "โหลด audit log ไม่สำเร็จ");
      }
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [actions, targets] = await Promise.all([
          getAuditActionTypes(),
          getAuditTargetTypes(),
        ]);
        setActionTypes(actions);
        setTargetTypes(targets);
      } catch {
        // ignore
      }
    })();
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    load(1);
  }

  function resetFilters() {
    setActionFilter("all");
    setTargetTypeFilter("all");
    setTargetIdFilter("");
    setUserSearch("");
    setStartDate("");
    setEndDate("");
    setTimeout(() => load(1), 0);
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const csv = await exportAuditLogs(buildFilters());
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("ดาวน์โหลด CSV แล้ว");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">ประเภท Action</Label>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v ?? "all")}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {actionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ประเภท Resource (target)</Label>
            <Select
              value={targetTypeFilter}
              onValueChange={(v) => setTargetTypeFilter(v ?? "all")}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {targetTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ค้นหาชื่อผู้ใช้ (actor)</Label>
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="ชื่อ-สกุล..."
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ค้นหา target ID</Label>
            <Input
              value={targetIdFilter}
              onChange={(e) => setTargetIdFilter(e.target.value)}
              placeholder="UUID ของ resource เป้าหมาย"
              disabled={isPending}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ตั้งแต่</Label>
            <ThaiDatePicker
              value={startDate}
              onChange={setStartDate}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ถึง</Label>
            <ThaiDatePicker
              value={endDate}
              onChange={setEndDate}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Quick date presets */}
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-xs text-muted-foreground mr-1 py-1">เลือกช่วงเร็ว:</span>
          {[
            { label: "วันนี้", days: 1 },
            { label: "7 วัน", days: 7 },
            { label: "30 วัน", days: 30 },
            { label: "90 วัน", days: 90 },
          ].map((preset) => (
            <Button
              key={preset.days}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyDatePreset(preset.days)}
              disabled={isPending}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground">
            พบ <span className="font-mono font-semibold">{total.toLocaleString()}</span> รายการ
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              ล้าง
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isPending || rows.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
            <Button type="button" size="sm" onClick={applyFilters} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              กรอง
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Mobile (<md): divided list inside the same card */}
        <ul className="divide-y divide-border md:hidden">
          {rows.length === 0 ? (
            <li className="py-10 text-center text-sm text-muted-foreground">
              {isPending ? "กำลังโหลด..." : "ไม่พบ audit log ที่ตรงกับเงื่อนไข"}
            </li>
          ) : (
            rows.map((r) => {
              const isExpanded = expandedId === r.id;
              const tone = actionToneClass(r.action);
              return (
                <li key={r.id} className="p-3">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground grid place-items-center text-[0.625rem] font-semibold shrink-0">
                          {r.user_initials}
                        </span>
                        <span className="font-medium text-sm truncate">{r.user_name}</span>
                      </div>
                      <span
                        className={cn(
                          "font-mono text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 shrink-0",
                          TONE_BG[tone],
                        )}
                      >
                        {r.action}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-mono truncate">{r.target_type}#{r.target_id.slice(0, 8)}</span>
                      <span className="font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("th-TH", {
                          year: "2-digit", month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        target_id: {r.target_id}
                      </div>
                      <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto font-mono">
                        {r.details ? JSON.stringify(r.details, null, 2) : "(empty)"}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>

        {/* Tablet/desktop (md+): table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-xs whitespace-nowrap">เวลา</TableHead>
                <TableHead className="text-xs">ผู้ใช้</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                    {isPending ? "กำลังโหลด..." : "ไม่พบ audit log ที่ตรงกับเงื่อนไข"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const tone = actionToneClass(r.action);
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        <TableCell>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform",
                              isExpanded ? "rotate-0" : "-rotate-90",
                            )}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("th-TH", {
                            year: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground grid place-items-center text-[0.625rem] font-semibold shrink-0">
                              {r.user_initials}
                            </span>
                            <span className="font-medium truncate max-w-[160px]">{r.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-mono text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1",
                              TONE_BG[tone],
                            )}
                          >
                            {r.action}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                          {r.target_type}#{r.target_id.slice(0, 8)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${r.id}-detail`} className="bg-muted/20">
                          <TableCell colSpan={5}>
                            <div className="space-y-2 py-2">
                              <div className="text-xs text-muted-foreground">
                                <span className="font-mono">target_id:</span>{" "}
                                <span className="font-mono">{r.target_id}</span>
                              </div>
                              <div>
                                <div className="text-xs font-medium mb-1">Details</div>
                                <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto font-mono">
                                  {r.details
                                    ? JSON.stringify(r.details, null, 2)
                                    : "(empty)"}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground">
              หน้า {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => load(page - 1)}
                disabled={isPending || page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => load(page + 1)}
                disabled={isPending || page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

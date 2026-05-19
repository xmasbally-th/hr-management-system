"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  resolveCorrectionRequest,
  rejectCorrectionRequest,
  type CorrectionListRow,
  type ListResult,
} from "@/lib/actions/correction-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FIELD_LABELS } from "@/components/correction-request-form";
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  ExternalLink,
  Check,
  X,
  Loader2,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  result: ListResult;
  currentStatus: string;
  currentScope: string;
  currentSearch: string;
  currentPage: number;
}

const STATUS_TABS: Array<{
  key: "pending" | "resolved" | "rejected" | "cancelled" | "all";
  label: string;
}> = [
  { key: "pending", label: "รอดำเนินการ" },
  { key: "resolved", label: "ดำเนินการแล้ว" },
  { key: "rejected", label: "ปฏิเสธ" },
  { key: "cancelled", label: "ยกเลิก" },
  { key: "all", label: "ทั้งหมด" },
];

const STATUS_META: Record<
  CorrectionListRow["status"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "รอดำเนินการ", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  resolved: { label: "ดำเนินการแล้ว", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", cls: "bg-rose-50 text-rose-800 border-rose-200", icon: XCircle },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-50 text-slate-700 border-slate-200", icon: Ban },
};

const SCOPE_LABEL: Record<CorrectionListRow["scope"], string> = {
  first_review: "ตรวจสอบครั้งแรก",
  post_approval: "แก้ไขเพิ่มเติม",
};

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${(d.getUTCFullYear() + 543) % 100}`;
}

export function ProfileCorrectionsClient({
  result,
  currentStatus,
  currentScope,
  currentSearch,
  currentPage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [resolveOpen, setResolveOpen] = useState<CorrectionListRow | null>(null);
  const [rejectOpen, setRejectOpen] = useState<CorrectionListRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams();
    if (currentStatus !== "pending") params.set("status", currentStatus);
    if (currentScope !== "all") params.set("scope", currentScope);
    if (currentSearch) params.set("search", currentSearch);
    if (currentPage > 1) params.set("page", String(currentPage));

    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    router.push(`/dashboard/hr/profile-corrections${qs ? `?${qs}` : ""}`);
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: searchInput.trim(), page: "1" });
  }

  function handleResolve() {
    if (!resolveOpen) return;
    const id = resolveOpen.id;
    startTransition(async () => {
      try {
        await resolveCorrectionRequest(id, resolveNote.trim() || undefined);
        toast.success("ทำเครื่องหมายเสร็จสิ้นแล้ว");
        setResolveOpen(null);
        setResolveNote("");
        // Tell DashboardShell to refresh the sidebar badge count
        window.dispatchEvent(new CustomEvent("corrections-updated"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleReject() {
    if (!rejectOpen) return;
    if (rejectNote.trim().length < 5) {
      toast.error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    const id = rejectOpen.id;
    startTransition(async () => {
      try {
        await rejectCorrectionRequest(id, rejectNote);
        toast.success("ปฏิเสธคำขอแล้ว");
        setRejectOpen(null);
        setRejectNote("");
        window.dispatchEvent(new CustomEvent("corrections-updated"));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">อนุมัติคำขอแก้ไขข้อมูล</h1>
        <p className="text-muted-foreground text-sm">
          จัดการคำขอแก้ไขข้อมูลโปรไฟล์จากผู้ใช้
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["pending", "resolved", "rejected", "cancelled"] as const).map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const count = result.counts[s];
          const active = currentStatus === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => navigate({ status: s, page: "1" })}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {meta.label}
              </div>
              <div className="mt-1 text-2xl font-bold font-mono">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
          {STATUS_TABS.map((t) => {
            const active = currentStatus === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => navigate({ status: t.key, page: "1" })}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition",
                  active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scope filter */}
        <select
          value={currentScope}
          onChange={(e) => navigate({ scope: e.target.value, page: "1" })}
          className="px-3 py-1.5 text-sm rounded-md border border-input bg-background"
        >
          <option value="all">ประเภททั้งหมด</option>
          <option value="first_review">ตรวจสอบครั้งแรก</option>
          <option value="post_approval">แก้ไขเพิ่มเติม</option>
        </select>

        {/* Search */}
        <form onSubmit={applySearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นชื่อหรืออีเมลผู้ใช้..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            ค้นหา
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {result.data.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="size-10 mx-auto mb-2 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">
              ไม่มีคำขอในหมวดที่เลือก
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 font-medium">ฟิลด์ที่แจ้ง</th>
                  <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">วันที่</th>
                  <th className="text-right px-4 py-3 font-medium">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((r) => {
                  const meta = STATUS_META[r.status];
                  const Icon = meta.icon;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">{r.target_user_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.target_user_email ?? "—"}
                        </div>
                        {r.target_user_department && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.target_user_department}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {SCOPE_LABEL[r.scope]}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.fields_flagged.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {r.fields_flagged.map((k) => (
                              <span
                                key={k}
                                className="inline-flex items-center px-1.5 py-px rounded text-xs bg-muted text-muted-foreground"
                              >
                                {FIELD_LABELS[k] ?? k}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            ไม่ระบุฟิลด์
                          </span>
                        )}
                        <p className="text-xs text-foreground mt-2 max-w-md line-clamp-2 whitespace-pre-wrap">
                          {r.reason_text}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                            meta.cls,
                          )}
                        >
                          <Icon className="size-3" />
                          {meta.label}
                        </span>
                        {r.resolver_note && r.status !== "pending" && (
                          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs line-clamp-2">
                            “{r.resolver_note}”
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-muted-foreground font-mono">
                        <div>ส่ง {formatDate(r.created_at)}</div>
                        {r.resolved_at && (
                          <div className="text-muted-foreground/70">
                            จบ {formatDate(r.resolved_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex flex-col gap-1">
                          <Link
                            href={`/dashboard/hr/users/${r.target_user_id}/edit?correction=${r.id}`}
                            className="inline-flex items-center justify-end gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" />
                            ไปแก้โปรไฟล์
                          </Link>
                          {r.status === "pending" && (
                            <div className="flex gap-1 mt-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => setResolveOpen(r)}
                                disabled={isPending}
                              >
                                <Check className="size-3 mr-1" />
                                เสร็จสิ้น
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                                onClick={() => setRejectOpen(r)}
                                disabled={isPending}
                              >
                                <X className="size-3 mr-1" />
                                ปฏิเสธ
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            หน้า {currentPage} / {totalPages} — รวม {result.totalCount} รายการ
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => navigate({ page: String(currentPage - 1) })}
            >
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => navigate({ page: String(currentPage + 1) })}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      )}

      {/* Resolve dialog */}
      <AlertDialog
        open={resolveOpen !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResolveOpen(null);
            setResolveNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ทำเครื่องหมายว่าเสร็จสิ้น</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              ยืนยันว่าคุณได้ดำเนินการแก้ไขข้อมูลของ{" "}
              <span className="font-medium">
                {resolveOpen?.target_user_name ?? "ผู้ใช้นี้"}
              </span>{" "}
              ตามคำขอแล้ว
            </p>
            <div>
              <Label className="text-xs">หมายเหตุ (ถ้ามี — ส่งให้ผู้ใช้)</Label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="เช่น 'แก้ไขนามสกุลและเบอร์โทรเรียบร้อย'"
                rows={3}
                maxLength={2000}
                disabled={isPending}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResolve();
              }}
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก..." : "ยืนยัน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <AlertDialog
        open={rejectOpen !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectOpen(null);
            setRejectNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ปฏิเสธคำขอแก้ไข</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              ปฏิเสธคำขอจาก{" "}
              <span className="font-medium">
                {rejectOpen?.target_user_name ?? "ผู้ใช้นี้"}
              </span>
            </p>
            <div>
              <Label className="text-xs">
                เหตุผล <span className="text-destructive">*</span> (ส่งให้ผู้ใช้)
              </Label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="เช่น 'ข้อมูลเดิมถูกต้องแล้ว — กรุณาตรวจสอบที่บัตรประชาชน'"
                rows={4}
                maxLength={2000}
                disabled={isPending}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="text-xs text-muted-foreground mt-1 text-right">
                {rejectNote.length} / 2000
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleReject();
              }}
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก..." : "ปฏิเสธ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isPending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/50 pointer-events-none">
          <div className="rounded-lg bg-card border border-border shadow-lg p-4 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">กำลังบันทึก...</span>
          </div>
        </div>
      )}
    </div>
  );
}

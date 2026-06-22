"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  updateSentForSignature,
  updateReturnedDate,
  updateScannedDate,
  updateSentToAgency,
  updateDocumentNotes,
  deleteDocumentTracking,
} from "@/lib/actions/document-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentWorkflowTimeline } from "@/components/document-workflow-timeline";
import { ClientPaginationControls } from "@/components/pagination-controls";
import {
  Send,
  RotateCcw,
  ScanLine,
  Building2,
  Trash2,
  CheckCircle2,
  Clock,
  MessageSquare,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

interface DocumentRecord {
  id: string;
  reference_id: string;
  document_type: string;
  // legacy paper-channel columns (stamped manually on this page)
  sent_for_signature_date: string | null;
  returned_date: string | null;
  scanned_upload_date: string | null;
  sent_to_agency_date: string | null;
  notes: string | null;
  // signature-workflow columns (stamped by runLeaveStage / travel stages)
  sent_to_chair_date: string | null;
  chair_signed_date: string | null;
  sent_to_director_date: string | null;
  director_signed_date: string | null;
  sent_to_dean_date: string | null;
  dean_signed_date: string | null;
  scanned_document_url: string | null;
  sent_to_president_date: string | null;
  president_signed_date: string | null;
  president_document_url: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  reject_level: string | null;
}

export interface DocRefInfo {
  employeeName: string;
  typeName: string;
  startDate: string | null;
  endDate: string | null;
}

const docTypeLabels: Record<string, string> = {
  leave: "ใบลา",
  leave_request: "ใบลา", // legacy rows before W2/W8
  leave_cancellation: "คำขอยกเลิกใบลา",
  travel_order: "คำสั่งเดินทาง",
  travel_claim: "เบิกค่าเดินทาง",
  travel_cancellation: "ยกเลิกคำสั่งเดินทาง",
  other: "อื่นๆ",
};

/** Badge tint per document family — leave / cancellation / travel / other. */
function docTypeBadgeClass(docType: string): string {
  if (docType === "leave_cancellation" || docType === "travel_cancellation") {
    return "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400";
  }
  if (docType === "travel_order" || docType === "travel_claim") {
    return "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/30 dark:text-sky-400";
  }
  return "border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400";
}

/** Type-filter options shown in the dropdown (value → label). */
const typeFilterOptions: [string, string][] = [
  ["all", "ทุกประเภท"],
  ["leave", "ใบลา"],
  ["leave_cancellation", "คำขอยกเลิกใบลา"],
  ["travel_order", "คำสั่งเดินทาง"],
  ["travel_claim", "เบิกค่าเดินทาง"],
  ["other", "อื่นๆ"],
];

/** Map a row's document_type onto a coarse filter bucket. */
function typeBucket(docType: string): string {
  if (docType === "leave" || docType === "leave_request") return "leave";
  if (docType === "leave_cancellation") return "leave_cancellation";
  if (docType === "travel_order") return "travel_order";
  if (docType === "travel_claim" || docType === "travel_cancellation") return "travel_claim";
  return "other";
}

/** Types that have an automated signature workflow → expandable timeline. */
const workflowDocTypes = new Set([
  "leave",
  "leave_request",
  "leave_cancellation",
  "travel_order",
  "travel_claim",
  "travel_cancellation",
]);

function detailHref(docType: string, refId: string): string | null {
  if (docType === "leave" || docType === "leave_request") return `/dashboard/leaves/${refId}`;
  if (docType === "travel_order" || docType === "travel_claim") return `/dashboard/travel/${refId}`;
  return null;
}

/**
 * Status derived from the real signature-workflow columns first, falling
 * back to the legacy manual paper-channel columns for rows that have no
 * automated workflow (e.g. document_type = other). `tone` drives the
 * coloured dot so the queue is scannable at a glance.
 */
function getStatus(doc: DocumentRecord): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  tone: "green" | "red" | "amber" | "gray";
} {
  if (doc.rejected_at) return { label: "ตีกลับ/ปฏิเสธ", variant: "destructive", tone: "red" };
  if (doc.president_signed_date) return { label: "เสร็จสิ้น", variant: "default", tone: "green" };
  if (doc.sent_to_agency_date) return { label: "ส่งหน่วยงานแล้ว", variant: "default", tone: "green" };
  if (doc.sent_to_president_date) return { label: "รออธิการบดี", variant: "secondary", tone: "amber" };
  if (doc.dean_signed_date) return { label: "คณบดีลงนามแล้ว", variant: "secondary", tone: "amber" };
  if (doc.sent_to_dean_date) return { label: "รอคณบดีลงนาม", variant: "secondary", tone: "amber" };
  if (doc.director_signed_date) return { label: "ผอ.สำนักงานลงนามแล้ว", variant: "secondary", tone: "amber" };
  if (doc.sent_to_director_date) return { label: "รอผอ.สำนักงานลงนาม", variant: "secondary", tone: "amber" };
  if (doc.chair_signed_date) return { label: "ประธานสาขาให้ความเห็นแล้ว", variant: "secondary", tone: "amber" };
  if (doc.sent_to_chair_date) return { label: "รอประธานสาขา", variant: "outline", tone: "amber" };
  if (doc.scanned_upload_date) return { label: "สแกนแล้ว", variant: "secondary", tone: "amber" };
  if (doc.returned_date) return { label: "รับคืนแล้ว", variant: "secondary", tone: "amber" };
  if (doc.sent_for_signature_date) return { label: "รอลงนาม", variant: "outline", tone: "amber" };
  return { label: "รอดำเนินการ", variant: "outline", tone: "gray" };
}

const toneDotClass: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-destructive",
  amber: "bg-amber-500",
  gray: "bg-muted-foreground/40",
};

/** Terminal states: completed the workflow, sent to agency, or rejected. */
function isCompleted(doc: DocumentRecord) {
  return !!(doc.president_signed_date || doc.sent_to_agency_date || doc.rejected_at);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Initials for the avatar fallback — first two name tokens. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p.charAt(0)).join("").toUpperCase();
}

const PAGE_SIZE = 15;

export function HrDocumentsClient({
  documents: initialDocs,
  refInfo = {},
  readOnly = false,
}: {
  documents: DocumentRecord[];
  refInfo?: Record<string, DocRefInfo>;
  readOnly?: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocs);
  const [isPending, startTransition] = useTransition();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deletingDoc, setDeletingDoc] = useState<DocumentRecord | null>(null);
  const [page, setPage] = useState(1);

  const colCount = readOnly ? 9 : 10;

  // Search + type filters apply first; the status tabs then narrow further
  // and their counts reflect the already-filtered set.
  const searched = documents.filter((doc) => {
    if (typeFilter !== "all" && typeBucket(doc.document_type) !== typeFilter) return false;
    if (search.trim()) {
      const name = refInfo[doc.reference_id]?.employeeName ?? "";
      if (!name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const filtered = searched.filter((doc) => {
    if (filter === "pending") return !isCompleted(doc);
    if (filter === "completed") return isCompleted(doc);
    return true;
  });

  // Reset to page 1 whenever the active filter set changes, so the user
  // never lands on an out-of-range page after narrowing results.
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, filter]);

  const totalCount = filtered.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleAction(docId: string, action: () => Promise<void>, field: keyof DocumentRecord) {
    startTransition(async () => {
      try {
        await action();
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, [field]: new Date().toISOString() } : d
          )
        );
        toast.success("บันทึกแล้ว");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  function handleDelete(docId: string) {
    startTransition(async () => {
      try {
        await deleteDocumentTracking(docId);
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setDeletingDoc(null);
        toast.success("ลบรายการแล้ว");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "ลบรายการไม่สำเร็จ");
      }
    });
  }

  function handleSaveNote(docId: string) {
    startTransition(async () => {
      try {
        await updateDocumentNotes(docId, noteText);
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, notes: noteText } : d))
        );
        setEditingNoteId(null);
        toast.success("บันทึกหมายเหตุแล้ว");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกหมายเหตุไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search + type filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อผู้ขอ..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeFilterOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          ["all", "ทั้งหมด"],
          ["pending", "กำลังดำเนินการ"],
          ["completed", "เสร็จสิ้น"],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
            <Badge variant="secondary" className="ml-2 text-xs">
              {key === "all"
                ? searched.length
                : key === "pending"
                  ? searched.filter((d) => !isCompleted(d)).length
                  : searched.filter((d) => isCompleted(d)).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32px]"></TableHead>
              <TableHead className="min-w-[200px]">ผู้ขอ</TableHead>
              <TableHead className="w-[150px]">ประเภท</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-center">ส่งลงนาม</TableHead>
              <TableHead className="text-center">รับคืน</TableHead>
              <TableHead className="text-center">สแกน</TableHead>
              <TableHead className="text-center">ส่งหน่วยงาน</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              {!readOnly && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                  ไม่มีรายการเอกสาร
                </TableCell>
              </TableRow>
            )}
            {paged.map((doc) => {
              const status = getStatus(doc);
              const expanded = expandedId === doc.id;
              const href = detailHref(doc.document_type, doc.reference_id);
              const info = refInfo[doc.reference_id];
              return (
                <Fragment key={doc.id}>
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="pr-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : doc.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title={expanded ? "ย่อเส้นทางเอกสาร" : "ดูเส้นทางเอกสาร"}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </TableCell>

                  {/* Requester — prominent name + avatar */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {info?.employeeName ? initialsOf(info.employeeName) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        {info?.employeeName ? (
                          <p className="font-medium text-sm truncate">{info.employeeName}</p>
                        ) : (
                          <p
                            className="text-sm text-muted-foreground italic"
                            title={doc.reference_id}
                          >
                            ไม่ทราบชื่อ
                          </p>
                        )}
                        {info?.startDate && info?.endDate && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(info.startDate)} ~ {formatDate(info.endDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge variant="outline" className={docTypeBadgeClass(doc.document_type)}>
                      {docTypeLabels[doc.document_type] ?? doc.document_type}
                    </Badge>
                    {info?.typeName && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[140px]">
                        {info.typeName}
                      </p>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${toneDotClass[status.tone]}`} />
                      {status.label}
                    </Badge>
                  </TableCell>

                  {/* Sent for signature */}
                  <TableCell className="text-center">
                    {doc.sent_for_signature_date ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">{formatDate(doc.sent_for_signature_date)}</span>
                      </div>
                    ) : readOnly ? (
                      <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleAction(doc.id, () => updateSentForSignature(doc.id), "sent_for_signature_date")}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        ส่ง
                      </Button>
                    )}
                  </TableCell>

                  {/* Returned */}
                  <TableCell className="text-center">
                    {doc.returned_date ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">{formatDate(doc.returned_date)}</span>
                      </div>
                    ) : !readOnly && doc.sent_for_signature_date ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleAction(doc.id, () => updateReturnedDate(doc.id), "returned_date")}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        รับคืน
                      </Button>
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>

                  {/* Scanned */}
                  <TableCell className="text-center">
                    {doc.scanned_upload_date ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">{formatDate(doc.scanned_upload_date)}</span>
                      </div>
                    ) : !readOnly && doc.returned_date ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleAction(doc.id, () => updateScannedDate(doc.id), "scanned_upload_date")}
                      >
                        <ScanLine className="h-3.5 w-3.5 mr-1" />
                        สแกน
                      </Button>
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>

                  {/* Sent to agency */}
                  <TableCell className="text-center">
                    {doc.sent_to_agency_date ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">{formatDate(doc.sent_to_agency_date)}</span>
                      </div>
                    ) : !readOnly && doc.scanned_upload_date ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleAction(doc.id, () => updateSentToAgency(doc.id), "sent_to_agency_date")}
                      >
                        <Building2 className="h-3.5 w-3.5 mr-1" />
                        ส่ง
                      </Button>
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>

                  {/* Notes */}
                  <TableCell>
                    {!readOnly && editingNoteId === doc.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="h-7 text-xs w-32"
                          placeholder="หมายเหตุ"
                        />
                        <button onClick={() => handleSaveNote(doc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" disabled={isPending}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingNoteId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : readOnly ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px] inline-block" title={doc.notes ?? undefined}>
                        {doc.notes || "—"}
                      </span>
                    ) : (
                      <button
                        onClick={() => { setEditingNoteId(doc.id); setNoteText(doc.notes ?? ""); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title={doc.notes ?? "เพิ่มหมายเหตุ"}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[100px]">{doc.notes || "—"}</span>
                      </button>
                    )}
                  </TableCell>

                  {/* Delete */}
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingDoc(doc)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>

                {/* Expanded: signature-workflow timeline + detail link */}
                {expanded && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={colCount} className="py-3">
                      <div className="pl-9 pr-2 space-y-3 max-w-xl">
                        {workflowDocTypes.has(doc.document_type) ? (
                          <DocumentWorkflowTimeline
                            tracking={doc}
                            docType={doc.document_type === "leave_request" ? "leave" : doc.document_type}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            เอกสารประเภทนี้ไม่มีเส้นทางลงนามอัตโนมัติ — ใช้ช่อง ส่งลงนาม/รับคืน/สแกน/ส่งหน่วยงาน บันทึกด้วยตนเอง
                          </p>
                        )}
                        {href && (
                          <Link href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            ดูรายละเอียดคำขอ <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <ClientPaginationControls
          currentPage={safePage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingDoc !== null}
        onOpenChange={(open) => { if (!open) setDeletingDoc(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรายการติดตามเอกสาร?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDoc && (
                <>
                  รายการ{" "}
                  <span className="font-medium text-foreground">
                    {docTypeLabels[deletingDoc.document_type] ?? deletingDoc.document_type}
                  </span>
                  {refInfo[deletingDoc.reference_id]?.employeeName && (
                    <> ของ <span className="font-medium text-foreground">{refInfo[deletingDoc.reference_id].employeeName}</span></>
                  )}
                  {" "}จะถูกนำออกจากรายการติดตาม การดำเนินการนี้ย้อนกลับไม่ได้จากหน้านี้
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deletingDoc) handleDelete(deletingDoc.id);
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "กำลังลบ..." : "ลบรายการ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

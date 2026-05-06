"use client";

import { useState, useTransition } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";

interface DocumentRecord {
  id: string;
  reference_id: string;
  document_type: string;
  sent_for_signature_date: string | null;
  returned_date: string | null;
  scanned_upload_date: string | null;
  sent_to_agency_date: string | null;
  notes: string | null;
}

const docTypeLabels: Record<string, string> = {
  leave: "ใบลา",
  travel_order: "คำสั่งเดินทาง",
  travel_claim: "เบิกค่าเดินทาง",
  other: "อื่นๆ",
};

function getStatus(doc: DocumentRecord) {
  if (doc.sent_to_agency_date) return { label: "ส่งหน่วยงานแล้ว", variant: "default" as const, step: 4 };
  if (doc.scanned_upload_date) return { label: "สแกนแล้ว", variant: "secondary" as const, step: 3 };
  if (doc.returned_date) return { label: "รับคืนแล้ว", variant: "secondary" as const, step: 2 };
  if (doc.sent_for_signature_date) return { label: "รอลงนาม", variant: "outline" as const, step: 1 };
  return { label: "รอดำเนินการ", variant: "outline" as const, step: 0 };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function HrDocumentsClient({ documents: initialDocs }: { documents: DocumentRecord[] }) {
  const [documents, setDocuments] = useState(initialDocs);
  const [isPending, startTransition] = useTransition();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const filtered = documents.filter((doc) => {
    if (filter === "pending") return !doc.sent_to_agency_date;
    if (filter === "completed") return !!doc.sent_to_agency_date;
    return true;
  });

  function handleAction(docId: string, action: () => Promise<void>, field: keyof DocumentRecord) {
    startTransition(async () => {
      try {
        await action();
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, [field]: new Date().toISOString() } : d
          )
        );
      } catch { /* ignore */ }
    });
  }

  function handleDelete(docId: string) {
    startTransition(async () => {
      try {
        await deleteDocumentTracking(docId);
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } catch { /* ignore */ }
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
      } catch { /* ignore */ }
    });
  }

  return (
    <div className="space-y-4">
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
                ? documents.length
                : key === "pending"
                  ? documents.filter((d) => !d.sent_to_agency_date).length
                  : documents.filter((d) => !!d.sent_to_agency_date).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">ประเภท</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-center">ส่งลงนาม</TableHead>
              <TableHead className="text-center">รับคืน</TableHead>
              <TableHead className="text-center">สแกน</TableHead>
              <TableHead className="text-center">ส่งหน่วยงาน</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  ไม่มีรายการเอกสาร
                </TableCell>
              </TableRow>
            )}
            {filtered.map((doc) => {
              const status = getStatus(doc);
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">
                        {docTypeLabels[doc.document_type] ?? doc.document_type}
                      </span>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]" title={doc.reference_id}>
                        {doc.reference_id.substring(0, 8)}...
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>

                  {/* Sent for signature */}
                  <TableCell className="text-center">
                    {doc.sent_for_signature_date ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">{formatDate(doc.sent_for_signature_date)}</span>
                      </div>
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
                    ) : doc.sent_for_signature_date ? (
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
                    ) : doc.returned_date ? (
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
                    ) : doc.scanned_upload_date ? (
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
                    {editingNoteId === doc.id ? (
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

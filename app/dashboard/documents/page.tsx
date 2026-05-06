import { getMyDocuments } from "@/lib/actions/document-actions";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText } from "lucide-react";

export const metadata = { title: "เอกสารของฉัน" };

const docTypeLabels: Record<string, string> = {
  leave: "ใบลา",
  travel_order: "คำสั่งเดินทาง",
  travel_claim: "เบิกค่าเดินทาง",
  other: "อื่นๆ",
};

function getStatus(doc: { sent_to_agency_date: string | null; scanned_upload_date: string | null; returned_date: string | null; sent_for_signature_date: string | null }) {
  if (doc.sent_to_agency_date) return { label: "ส่งหน่วยงานแล้ว", variant: "default" as const };
  if (doc.scanned_upload_date) return { label: "สแกนแล้ว", variant: "secondary" as const };
  if (doc.returned_date) return { label: "รับคืนแล้ว", variant: "secondary" as const };
  if (doc.sent_for_signature_date) return { label: "รอลงนาม", variant: "outline" as const };
  return { label: "รอดำเนินการ", variant: "outline" as const };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function MyDocumentsPage() {
  const documents = await getMyDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">เอกสารของฉัน</h1>
        <p className="text-muted-foreground">ติดตามสถานะเอกสารกระดาษที่เกี่ยวข้องกับคำขอของคุณ</p>
      </div>

      <div className="border rounded-lg bg-card divide-y">
        {documents.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">ยังไม่มีเอกสารที่ต้องติดตาม</p>
          </div>
        )}
        {documents.map((doc) => {
          const status = getStatus(doc);
          return (
            <div key={doc.id} className="px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {docTypeLabels[doc.document_type] ?? doc.document_type}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {doc.notes && (
                  <p className="text-xs text-muted-foreground">{doc.notes}</p>
                )}
              </div>

              {/* Progress steps */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <Step done={!!doc.sent_for_signature_date} label="ส่งลงนาม" date={doc.sent_for_signature_date} />
                <Step done={!!doc.returned_date} label="รับคืน" date={doc.returned_date} />
                <Step done={!!doc.scanned_upload_date} label="สแกน" date={doc.scanned_upload_date} />
                <Step done={!!doc.sent_to_agency_date} label="ส่งหน่วยงาน" date={doc.sent_to_agency_date} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Step({ done, label, date }: { done: boolean; label: string; date: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-16">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <Clock className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="leading-tight text-center">{label}</span>
      {done && <span className="text-[10px]">{formatDate(date)}</span>}
    </div>
  );
}

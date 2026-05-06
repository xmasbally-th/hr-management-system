import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { HrDocumentsClient } from "./hr-documents-client";

export const metadata = { title: "ติดตามเอกสาร (HR)" };

export default async function HrDocumentsPage() {
  const documents = await getAllDocumentTracking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ติดตามเอกสาร</h1>
        <p className="text-muted-foreground">ติดตามสถานะเอกสารกระดาษ — ส่งลงนาม, รับคืน, สแกน, ส่งหน่วยงาน</p>
      </div>

      <HrDocumentsClient documents={documents} />
    </div>
  );
}

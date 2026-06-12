import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { createClient } from "@/lib/supabase/server";
import { loadDocRefInfo } from "@/lib/document-ref-info";
import { HrDocumentsClient } from "./hr-documents-client";

export const metadata = { title: "ติดตามเอกสารเดินทาง" };

export default async function HrTravelDocumentsPage() {
  // Leave documents now live in the leave hub (/dashboard/hr/leaves);
  // this page tracks travel documents only.
  const documents = await getAllDocumentTracking({ family: "travel" });

  const supabase = await createClient();
  const refInfo = await loadDocRefInfo(supabase, documents);

  // Manager gets the same view read-only; hr/admin can edit.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const readOnly = profile?.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ติดตามเอกสารเดินทาง</h1>
        <p className="text-muted-foreground">
          สถานะเส้นทางลงนามคำสั่งเดินทาง + บันทึกงานกระดาษ (ส่งลงนาม, รับคืน, สแกน, ส่งหน่วยงาน)
        </p>
      </div>

      <HrDocumentsClient documents={documents} refInfo={refInfo} readOnly={readOnly} />
    </div>
  );
}

import { redirect } from "next/navigation";

// Merged into the travel hub /dashboard/hr/travel (tabs: รอดำเนินการ /
// คำขอทั้งหมด / ภาพรวม / ติดตามเอกสาร). Kept as a redirect so old
// bookmarks and the manager's former approval-queue link keep working.
export default function ApprovalsTravelPage() {
  redirect("/dashboard/hr/travel");
}

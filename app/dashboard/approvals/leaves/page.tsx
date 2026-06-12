import { redirect } from "next/navigation";

// Merged into the leave hub /dashboard/hr/leaves (tabs: รอดำเนินการ /
// คำขอทั้งหมด / ภาพรวม / ติดตามเอกสาร). Kept as a redirect so old
// bookmarks and the manager's former approval-queue link keep working.
export default function ApprovalsLeavesPage() {
  redirect("/dashboard/hr/leaves");
}

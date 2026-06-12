import { redirect } from "next/navigation";

// Merged into /dashboard/hr/documents (single org-wide tracking page:
// manager read-only, hr/admin editable). Kept as a redirect so old
// bookmarks keep working.
export default function ApprovalsDocumentsPage() {
  redirect("/dashboard/hr/documents");
}

import { redirect } from "next/navigation";

// Travel doc tracking is now the ติดตามเอกสาร tab inside the travel hub
// (/dashboard/hr/travel). Kept as a redirect so old bookmarks keep working.
export default function HrTravelDocumentsPage() {
  redirect("/dashboard/hr/travel");
}

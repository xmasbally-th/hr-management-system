import { redirect } from "next/navigation";

/**
 * /dashboard/hr/departments redirects to /dashboard/hr/master-data
 * where departments (and positions) are already managed.
 */
export default function DepartmentsRedirectPage() {
  redirect("/dashboard/hr/master-data");
}

import { listProfileCorrections, type CorrectionStatus, type CorrectionScope } from "@/lib/actions/correction-actions";
import { ProfileCorrectionsClient } from "./profile-corrections-client";

export const metadata = { title: "อนุมัติคำขอแก้ไขข้อมูล" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    scope?: string;
    search?: string;
    page?: string;
  }>;
}

const ALLOWED_STATUSES = new Set(["all", "pending", "resolved", "rejected", "cancelled"]);
const ALLOWED_SCOPES = new Set(["all", "first_review", "post_approval"]);

export default async function ProfileCorrectionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusParam = sp.status && ALLOWED_STATUSES.has(sp.status) ? sp.status : "pending";
  const scopeParam = sp.scope && ALLOWED_SCOPES.has(sp.scope) ? sp.scope : "all";
  const search = sp.search?.trim() ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const result = await listProfileCorrections({
    status: statusParam as CorrectionStatus | "all",
    scope: scopeParam as CorrectionScope | "all",
    search,
    page,
    pageSize: 20,
  });

  return (
    <ProfileCorrectionsClient
      result={result}
      currentStatus={statusParam}
      currentScope={scopeParam}
      currentSearch={search}
      currentPage={page}
    />
  );
}

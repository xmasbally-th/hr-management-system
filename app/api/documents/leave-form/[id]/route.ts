/**
 * GET /api/documents/leave-form/[id]
 *
 * Generates the leave .docx for a leave request by filling the active
 * Admin-uploaded template (mail-merge, W3). HR/Admin only. The download is
 * audited.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLeaveDocx } from "@/lib/document-templates/leave-merge";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    const isHrAdmin = !!profile && (profile.role === "hr" || profile.role === "admin");
    if (!isHrAdmin) {
      // Non-HR/Admin may download only their OWN leave form (RLS also guards
      // this read; we compare explicitly because the merge uses service-role).
      const { data: lr } = await supabase
        .from("leave_requests").select("employee_id").eq("id", id).single();
      if (!lr || lr.employee_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { buffer, filename } = await generateLeaveDocx(id);

    await logAudit(supabase, user.id, "download_leave_doc", "leave_request", id, {});

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

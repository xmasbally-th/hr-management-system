/**
 * GET /api/documents/leave-cancellation-form/[id]
 *
 * Generates the "แบบใบขอยกเลิกวันลา" .docx for a leave cancellation request
 * (id = leave_cancellation_requests.id) by filling the admin-uploaded
 * CANCELLATION template. HR/Admin only. The download is audited.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLeaveCancellationDocx } from "@/lib/document-templates/leave-merge";
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
    if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { buffer, filename } = await generateLeaveCancellationDocx(id);

    await logAudit(supabase, user.id, "download_leave_cancellation_doc", "leave_cancellation_request", id, {});

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

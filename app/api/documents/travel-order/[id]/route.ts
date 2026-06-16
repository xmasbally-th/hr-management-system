/**
 * API Route: Generate Travel Appointment Order (.docx)
 *
 * GET /api/documents/travel-order/[id]
 *
 * Generates a Word document for the specified travel request.
 * Only accessible by HR and Admin roles.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Packer } from "docx";
import { generateTravelOrderDocument } from "@/lib/document-templates/travel-order";
import { generateTravelDocx, NO_TRAVEL_TEMPLATE } from "@/lib/document-templates/travel-merge";

export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isHrAdmin = !!profile && (profile.role === "hr" || profile.role === "admin");
    if (!isHrAdmin) {
      // Non-HR/Admin may download only their OWN travel order.
      const { data: tr } = await supabase
        .from("travel_requests").select("employee_id").eq("id", id).single();
      if (!tr || tr.employee_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Prefer the Admin-uploaded original .docx template (mail-merge, exact
    // layout). Fall back to the code-built order document when no template
    // has been uploaded yet.
    try {
      const { buffer, filename } = await generateTravelDocx(id);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": DOCX_MIME,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    } catch (e) {
      if (!(e instanceof Error && e.message === NO_TRAVEL_TEMPLATE)) {
        const message = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      // no active template → fall through to the code-built order below
    }

    // Fetch travel request with employee and expenses
    const { data: request, error } = await supabase
      .from("travel_requests")
      .select(`
        *,
        employee:profiles!travel_requests_employee_id_fkey(
          full_name,
          email,
          department:departments(name),
          position:positions(name)
        ),
        expenses:travel_expenses(*)
      `)
      .eq("id", id)
      .single();

    if (error || !request) {
      return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
    }

    // Build document data
    const employee = request.employee as {
      full_name: string;
      email: string;
      department: { name: string } | null;
      position: { name: string } | null;
    } | null;

    const expenses = (request.expenses as { expense_category: string; estimated_amount: number }[]) ?? [];

    const doc = generateTravelOrderDocument({
      title: request.title,
      travelType: request.travel_type,
      location: request.location,
      startDate: request.start_date,
      endDate: request.end_date,
      totalDays: request.total_days,
      employeeName: employee?.full_name ?? "ไม่ระบุ",
      employeePosition: employee?.position?.name ?? undefined,
      departmentName: employee?.department?.name ?? undefined,
      expenses: expenses.map((e) => ({
        category: e.expense_category,
        estimatedAmount: e.estimated_amount,
      })),
    });

    // Generate .docx buffer
    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    // Create safe filename
    const safeName = request.title.replace(/[^a-zA-Z0-9฀-๿._-]/g, "_").slice(0, 50);
    const filename = `travel-order-${safeName}.docx`;

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[travel-order] Generation failed:", err);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}

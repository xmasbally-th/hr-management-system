import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { getAllLeaveBalancesForFY } from "@/lib/actions/leave-actions";
import { LeaveBalancesClient } from "./leave-balances-client";

export const metadata = { title: "จัดการวันลา" };

interface PageProps {
  searchParams?: Promise<{ fy?: string }>;
}

export default async function LeaveBalancesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const curFy = currentFiscalYear();
  const fy = sp.fy ? Number.parseInt(sp.fy, 10) || curFy : curFy;
  const balances = await getAllLeaveBalancesForFY(fy);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการวันลา</h1>
        <p className="text-muted-foreground text-sm">
          ตั้งต้นสิทธิ์วันลาประจำปีงบประมาณ นำเข้ายอดวันลาคงเหลือ
          และแก้ไขยอดวันลาของพนักงานเป็นรายคน (พร้อมบันทึก audit log)
        </p>
      </div>

      <LeaveBalancesClient
        currentFiscalYear={curFy}
        fiscalYearOptions={getFiscalYearOptions()}
        selectedFiscalYear={fy}
        balances={balances}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { LeaveBalancesClient } from "./leave-balances-client";

export const metadata = { title: "จัดการวันลา" };

export default async function LeaveBalancesPage() {
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการวันลา</h1>
        <p className="text-muted-foreground text-sm">
          ตั้งต้นสิทธิ์วันลาประจำปีงบประมาณ และนำเข้ายอดวันลาคงเหลือปัจจุบันจากไฟล์ CSV
          (สำหรับเปิดใช้งานระบบครั้งแรก)
        </p>
      </div>

      <LeaveBalancesClient
        currentFiscalYear={currentFiscalYear()}
        fiscalYearOptions={getFiscalYearOptions()}
      />
    </div>
  );
}

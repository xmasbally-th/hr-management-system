import {
  getLeaveTypes,
  getEmployeesForSelection,
  getMyLeaveBalances,
} from "@/lib/actions/leave-actions";
import { LeaveRequestForm } from "./leave-request-form";

export const metadata = { title: "ยื่นคำขอลา" };

export default async function NewLeavePage() {
  const [leaveTypes, balancesRaw] = await Promise.all([
    getLeaveTypes(),
    getMyLeaveBalances().catch(() => []),
  ]);

  let employees: { id: string; full_name: string; email: string }[] = [];
  try {
    employees = await getEmployeesForSelection();
  } catch {
    // Non-HR users won't have access — that's expected
  }

  const balances = (balancesRaw ?? []).map((b) => {
    const r = b as Record<string, unknown>;
    const lt = r.leave_type as { name: string } | null;
    return {
      typeName: lt?.name ?? "",
      totalDays: Number(r.total_days ?? 0),
      usedDays: Number(r.used_days ?? 0),
    };
  });

  return (
    <LeaveRequestForm
      leaveTypes={leaveTypes}
      employees={employees}
      balances={balances}
    />
  );
}

import { getAllTravelRequests } from "@/lib/actions/travel-actions";
import { HrTravelClient } from "./hr-travel-client";

export const metadata = { title: "จัดการเดินทางราชการ (HR)" };

export default async function HrTravelPage() {
  const requests = await getAllTravelRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการเดินทางราชการ</h1>
        <p className="text-muted-foreground">ตรวจสอบ อนุมัติ และบันทึกค่าใช้จ่ายจริง</p>
      </div>

      <HrTravelClient requests={requests} />
    </div>
  );
}

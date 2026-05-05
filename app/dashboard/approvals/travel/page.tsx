import { getAllTravelRequests } from "@/lib/actions/travel-actions";
import { HrTravelClient } from "../../hr/travel/hr-travel-client";

export const metadata = { title: "อนุมัติการเดินทาง" };

export default async function ApproveTravelPage() {
  const requests = await getAllTravelRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">อนุมัติการเดินทาง</h1>
        <p className="text-muted-foreground">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอเดินทางราชการ</p>
      </div>

      <HrTravelClient requests={requests} />
    </div>
  );
}

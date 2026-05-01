import { getDepartments, getPositions } from "@/lib/actions/master-data-actions";
import { MasterDataClient } from "./master-data-client";

export const metadata = {
  title: "ตั้งค่าองค์กร (Master Data)",
};

export default async function MasterDataPage() {
  const departments = await getDepartments();
  const positions = await getPositions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าองค์กร (Master Data)</h1>
        <p className="text-muted-foreground">จัดการข้อมูลแผนกและตำแหน่งงานในองค์กร</p>
      </div>

      <MasterDataClient initialDepartments={departments} initialPositions={positions} />
    </div>
  );
}

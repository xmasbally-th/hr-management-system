import { TravelRequestForm } from "./travel-request-form";

export const metadata = { title: "ยื่นคำขอเดินทางราชการ" };

export default function NewTravelPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ยื่นคำขอเดินทางราชการ</h1>
        <p className="text-muted-foreground">เลือกประเภทการเดินทางและกรอกข้อมูลงบประมาณ</p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <TravelRequestForm />
      </div>
    </div>
  );
}

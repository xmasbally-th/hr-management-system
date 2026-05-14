import { ImportClient } from "./import-client";

export const metadata = { title: "นำเข้าพนักงานเป็นชุด" };

export default function ImportEmployeesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">นำเข้าพนักงานเป็นชุด</h1>
        <p className="text-muted-foreground text-sm">
          อัปโหลด CSV เพื่อเตรียมบัญชีผู้ใช้ — พนักงานจะอ้างสิทธิ์ของตัวเองเมื่อเข้าสู่ระบบครั้งแรก
        </p>
      </div>
      <ImportClient />
    </div>
  );
}

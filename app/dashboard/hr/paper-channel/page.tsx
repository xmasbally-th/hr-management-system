import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plane } from "lucide-react";

export const metadata: Metadata = { title: "ช่องทางกระดาษ" };

export default function PaperChannelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ช่องทางกระดาษ (Paper Channel)</h1>
        <p className="text-muted-foreground">
          บันทึกคำขอลาหรือคำขอเดินทางราชการแทนพนักงานที่ยื่นเอกสารกระดาษ
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/hr/paper-channel/leave" className="block">
          <div className="border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold">บันทึกคำขอลาแทนพนักงาน</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              บันทึกใบลาที่พนักงานยื่นเป็นกระดาษ สามารถแนบไฟล์สแกนเอกสารได้
            </p>
            <Button variant="outline" size="sm">เริ่มบันทึก</Button>
          </div>
        </Link>

        <Link href="/dashboard/hr/paper-channel/travel" className="block">
          <div className="border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10">
                <Plane className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold">บันทึกคำขอเดินทางแทนพนักงาน</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              บันทึกคำขอเดินทางราชการที่พนักงานยื่นเป็นกระดาษ สามารถแนบไฟล์สแกนเอกสารได้
            </p>
            <Button variant="outline" size="sm">เริ่มบันทึก</Button>
          </div>
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Sparkles, Check, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "หน้าหลัก",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "ผู้ใช้งาน";

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span>หน้าหลัก</span>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium">ภาพรวม</span>
      </div>

      {/* Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 dotted-bg opacity-60"></div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl"></div>

        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              <Sparkles size={12} />
              <span>{today}</span>
            </div>
            <h1 className="mt-3 text-[22px] sm:text-[26px] font-bold text-foreground tracking-tight">
              ยินดีต้อนรับกลับ, <span className="text-primary">{userName}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground max-w-lg">
              คุณมี <span className="font-semibold text-foreground">3 รายการ</span> รออนุมัติ และ <span className="font-semibold text-foreground">2 การแจ้งเตือน</span> ที่ยังไม่ได้อ่าน
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition">
                <Check size={15} />
                ดูรายการอนุมัติ
              </button>
              <button className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-background border border-border text-foreground text-[13px] font-medium hover:bg-muted transition">
                <CalendarDays size={15} />
                ยื่นใบลา
              </button>
            </div>
          </div>

          {/* Decorative stat tile */}
          <div className="hidden sm:flex shrink-0 w-44 h-32 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-4 flex-col justify-between shadow-lg shadow-indigo-900/20">
            <div className="text-[11px] font-medium text-indigo-200">วันลาคงเหลือ</div>
            <div>
              <div className="text-[32px] font-bold leading-none">12<span className="text-[14px] font-medium text-indigo-200">/15</span></div>
              <div className="text-[11px] text-indigo-200 mt-1">วันลาประจำปี 2569</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="พนักงานทั้งหมด" value="248" hint="+12 จากเดือนที่แล้ว" tone="slate" />
        <StatCard label="รออนุมัติ" value="3" hint="ใบลา 2 · เดินทาง 1" tone="indigo" />
        <StatCard label="มาทำงานวันนี้" value="231" hint="93% ของพนักงานทั้งหมด" tone="emerald" />
        <StatCard label="ลาป่วย" value="6" hint="สัปดาห์นี้" tone="amber" />
      </div>

      {/* Two-up panels (placeholders) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PlaceholderPanel title="กิจกรรมล่าสุด">
            <div className="text-center text-muted-foreground">
              <div className="text-[12px] font-mono uppercase tracking-wider">[ activity feed ]</div>
              <div className="text-[11px] mt-1">รายการกิจกรรมจะแสดงที่นี่</div>
            </div>
          </PlaceholderPanel>
        </div>
        <PlaceholderPanel title="ทีมที่ลาวันนี้">
          <div className="text-center text-muted-foreground">
            <div className="text-[12px] font-mono uppercase tracking-wider">[ team roster ]</div>
            <div className="text-[11px] mt-1">รายชื่อพนักงานที่ลา</div>
          </div>
        </PlaceholderPanel>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, tone = "slate" }: { label: string; value: string; hint: string; tone?: "slate" | "indigo" | "emerald" | "amber" }) {
  const tones = {
    slate: "text-foreground",
    indigo: "text-indigo-600 dark:text-indigo-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-[12px] text-muted-foreground font-medium">{label}</div>
      <div className={`mt-2 text-[26px] font-bold tracking-tight ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function PlaceholderPanel({ title, height = "h-72", children }: { title: string; height?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${height} flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-foreground text-[14px]">{title}</div>
        <button className="text-[12px] text-primary hover:underline">ดูทั้งหมด</button>
      </div>
      <div className="flex-1 grid place-items-center">
        {children}
      </div>
    </div>
  );
}

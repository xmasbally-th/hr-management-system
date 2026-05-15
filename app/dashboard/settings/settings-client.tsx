"use client";

import { useState, useTransition } from "react";
import { exportEmployees, exportLeaveRequests, exportTravelRequests } from "@/lib/actions/export-actions";
import { downloadCsv } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import {
  Users,
  CalendarDays,
  Plane,
  Building2,
  Download,
  Database,
  Settings,
  FileSpreadsheet,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DensitySwitcher } from "@/components/density-switcher";
import { SecuritySection } from "./_sections/security-section";

interface SettingsProps {
  systemStats: {
    totalUsers: number;
    totalLeaveRequests: number;
    totalTravelRequests: number;
    totalDepartments: number;
  };
  allowedDomains: string[];
  autoApprove: boolean;
  lastUpdated: {
    allowed_email_domains: string | null;
    auto_approve_new_users: string | null;
  };
}

type Tab = "general" | "appearance" | "security" | "export";

export function SettingsClient({
  systemStats,
  allowedDomains,
  autoApprove,
  lastUpdated,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isPending, startTransition] = useTransition();

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "สถิติระบบ", icon: <Settings className="h-4 w-4" /> },
    { key: "appearance", label: "หน้าตาและธีม", icon: <Palette className="h-4 w-4" /> },
    { key: "security", label: "ความปลอดภัย", icon: <ShieldCheck className="h-4 w-4" /> },
    { key: "export", label: "ส่งออกข้อมูล", icon: <FileSpreadsheet className="h-4 w-4" /> },
  ];

  function handleExport(type: "employees" | "leaves" | "travel") {
    startTransition(async () => {
      if (type === "employees") {
        const data = await exportEmployees();
        downloadCsv("employees.csv",
          ["ชื่อเต็ม", "คำนำหน้า(TH)", "ชื่อ(TH)", "นามสกุล(TH)", "คำนำหน้า(EN)", "ชื่อ(EN)", "นามสกุล(EN)", "อีเมล", "โทรศัพท์", "สถานะ", "เลขที่ตำแหน่ง", "ตำแหน่ง", "แผนก", "ประเภทพนักงาน", "วันเริ่มงาน"],
          data.map((p) => [p.fullName, p.titleTh, p.firstNameTh, p.lastNameTh, p.titleEn, p.firstNameEn, p.lastNameEn, p.email, p.phone, p.status, p.positionNumber, p.positionTitle, p.department, p.employeeType, p.hireDate])
        );
      } else if (type === "leaves") {
        const data = await exportLeaveRequests();
        downloadCsv("leave-requests.csv",
          ["ชื่อ-สกุล", "ประเภทลา", "วันเริ่ม", "วันสิ้นสุด", "จำนวนวัน", "สถานะ", "ช่องทาง", "วันที่ยื่น"],
          data.map((r) => [r.name, r.leaveType, r.startDate, r.endDate, r.totalDays.toString(), r.status, r.channel, r.createdAt])
        );
      } else {
        const data = await exportTravelRequests();
        downloadCsv("travel-requests.csv",
          ["ชื่อ-สกุล", "ประเภท", "เรื่อง", "สถานที่", "วันเริ่ม", "วันสิ้นสุด", "จำนวนวัน", "งบประมาณ", "เบิกจ่ายจริง", "สถานะ", "ช่องทาง", "วันที่ยื่น"],
          data.map((r) => [r.name, r.travelType, r.title, r.location, r.startDate, r.endDate, r.totalDays.toString(), r.estimatedBudget.toString(), r.actualBudget.toString(), r.status, r.channel, r.createdAt])
        );
      }
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar tabs */}
      <nav className="lg:w-56 shrink-0 flex lg:flex-col gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* System stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<Users className="h-5 w-5 text-indigo-500" />} label="ผู้ใช้งาน" value={systemStats.totalUsers} />
              <StatCard icon={<CalendarDays className="h-5 w-5 text-amber-500" />} label="คำขอลา" value={systemStats.totalLeaveRequests} />
              <StatCard icon={<Plane className="h-5 w-5 text-emerald-500" />} label="คำขอเดินทาง" value={systemStats.totalTravelRequests} />
              <StatCard icon={<Building2 className="h-5 w-5 text-blue-500" />} label="หน่วยงาน" value={systemStats.totalDepartments} />
            </div>

            {/* Placeholder for live connection status (S4 will replace this) */}
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Database className="h-4 w-4" /> ข้อมูลระบบ
              </h3>
              <p className="text-xs text-muted-foreground">
                หน้านี้จะแสดงสถานะการเชื่อมต่อระบบจริง ขนาดพื้นที่จัดเก็บ และเวอร์ชันการ deploy
                ในเร็ว ๆ นี้ — สำหรับจัดการ &quot;ประเภทการลา&quot; / &quot;สังกัดหน่วยงาน&quot;
                ดูที่เมนู <b>ข้อมูลหลัก</b>
              </p>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            {/* Theme picker */}
            <div className="bg-card border rounded-xl p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" /> เลือกธีมสี
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ธีมจะถูกบันทึกในเครื่องของคุณและใช้กับทุกหน้า
                </p>
              </div>
              <ThemeSwitcher variant="full" />
            </div>

            {/* Density picker */}
            <div className="bg-card border rounded-xl p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-sm">ขนาดตัวอักษร</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ปรับขนาดตัวอักษรทั้งระบบ — เลือกตามความสบายตา
                  (ทั้งหมดจะ scale ตามขนาดหน้าจอเช่นกัน)
                </p>
              </div>
              <DensitySwitcher variant="segmented" />
            </div>

            {/* Tip card */}
            <div className="bg-muted/40 border border-dashed border-border rounded-xl p-4 text-xs text-muted-foreground">
              <p>
                💡 ค่าที่ตั้งไว้จะคงอยู่บนเครื่องนี้เท่านั้น
                — เปิดบนเครื่องอื่นหรือ browser อื่นจะกลับเป็นค่าเริ่มต้น
              </p>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <SecuritySection
            initialDomains={allowedDomains}
            initialAutoApprove={autoApprove}
            lastUpdated={lastUpdated}
          />
        )}

        {activeTab === "export" && (
          <div className="space-y-4">
            <ExportCard
              icon={<Users className="h-8 w-8 text-indigo-500" />}
              title="ข้อมูลพนักงาน"
              description="ส่งออกรายชื่อพนักงานทั้งหมด พร้อมข้อมูลตำแหน่ง แผนก และสถานะ"
              filename="employees.csv"
              onExport={() => handleExport("employees")}
              isPending={isPending}
            />
            <ExportCard
              icon={<CalendarDays className="h-8 w-8 text-amber-500" />}
              title="ข้อมูลการลา"
              description="ส่งออกประวัติการลาทั้งหมด พร้อมประเภทลา จำนวนวัน และสถานะ"
              filename="leave-requests.csv"
              onExport={() => handleExport("leaves")}
              isPending={isPending}
            />
            <ExportCard
              icon={<Plane className="h-8 w-8 text-emerald-500" />}
              title="ข้อมูลเดินทางราชการ"
              description="ส่งออกประวัติเดินทางทั้งหมด พร้อมงบประมาณประมาณ/จริง และสถานะ"
              filename="travel-requests.csv"
              onExport={() => handleExport("travel")}
              isPending={isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ExportCard({ icon, title, description, filename, onExport, isPending }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  filename: string;
  onExport: () => void;
  isPending: boolean;
}) {
  return (
    <div className="bg-card border rounded-xl p-5 flex items-center gap-4">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">ไฟล์: {filename}</p>
      </div>
      <Button variant="outline" onClick={onExport} disabled={isPending}>
        <Download className="h-4 w-4 mr-2" />
        ส่งออก CSV
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateLeaveType } from "@/lib/actions/settings-actions";
import { exportEmployees, exportLeaveRequests, exportTravelRequests } from "@/lib/actions/export-actions";
import { downloadCsv } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  CalendarDays,
  Plane,
  Building2,
  Download,
  Save,
  Database,
  Settings,
  FileSpreadsheet,
} from "lucide-react";

interface LeaveType {
  id: string;
  name: string;
  max_days_per_year: number;
  is_accumulative: boolean;
  conditions: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  created_at: string;
}

interface SettingsProps {
  leaveTypes: LeaveType[];
  departments: Department[];
  systemStats: {
    totalUsers: number;
    totalLeaveRequests: number;
    totalTravelRequests: number;
    totalDepartments: number;
  };
}

type Tab = "general" | "leave" | "export";

export function SettingsClient({ leaveTypes: initialLeaveTypes, departments, systemStats }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMaxDays, setEditMaxDays] = useState("");
  const [isPending, startTransition] = useTransition();

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "ภาพรวมระบบ", icon: <Settings className="h-4 w-4" /> },
    { key: "leave", label: "ประเภทการลา", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "export", label: "ส่งออกข้อมูล", icon: <FileSpreadsheet className="h-4 w-4" /> },
  ];

  function handleSaveMaxDays(id: string) {
    const days = parseInt(editMaxDays);
    if (isNaN(days) || days < 0) return;
    startTransition(async () => {
      await updateLeaveType(id, { max_days_per_year: days });
      setLeaveTypes((prev) => prev.map((lt) => (lt.id === id ? { ...lt, max_days_per_year: days } : lt)));
      setEditingId(null);
    });
  }

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
              <StatCard icon={<Building2 className="h-5 w-5 text-blue-500" />} label="แผนก" value={systemStats.totalDepartments} />
            </div>

            {/* Department list */}
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">แผนกทั้งหมด</h3>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <Badge key={d.id} variant="secondary" className="text-sm py-1 px-3">{d.name}</Badge>
                ))}
                {departments.length === 0 && (
                  <p className="text-sm text-muted-foreground">ยังไม่มีแผนก</p>
                )}
              </div>
            </div>

            {/* System info */}
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Database className="h-4 w-4" /> ข้อมูลระบบ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <InfoRow label="Framework" value="Next.js (App Router)" />
                <InfoRow label="Database" value="Supabase (PostgreSQL)" />
                <InfoRow label="Authentication" value="Supabase Auth (Google OAuth)" />
                <InfoRow label="Storage" value="Supabase Storage" />
                <InfoRow label="Styling" value="Tailwind CSS + Shadcn UI" />
                <InfoRow label="Deployment" value="Vercel" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "leave" && (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">จัดการประเภทการลา</h3>
              <p className="text-xs text-muted-foreground mt-0.5">กำหนดจำนวนวันลาสูงสุดแต่ละประเภท</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภทลา</TableHead>
                  <TableHead className="text-center w-[140px]">จำนวนวันสูงสุด</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">ยังไม่มีประเภทลา</TableCell>
                  </TableRow>
                )}
                {leaveTypes.map((lt) => (
                  <TableRow key={lt.id}>
                    <TableCell className="font-medium">{lt.name}</TableCell>
                    <TableCell className="text-center">
                      {editingId === lt.id ? (
                        <Input
                          type="number"
                          min={0}
                          value={editMaxDays}
                          onChange={(e) => setEditMaxDays(e.target.value)}
                          className="h-8 w-20 text-center mx-auto"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveMaxDays(lt.id); if (e.key === "Escape") setEditingId(null); }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary"
                          onClick={() => { setEditingId(lt.id); setEditMaxDays(lt.max_days_per_year?.toString() ?? "0"); }}
                        >
                          {lt.max_days_per_year ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === lt.id ? (
                        <Button variant="ghost" size="sm" onClick={() => handleSaveMaxDays(lt.id)} disabled={isPending}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
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

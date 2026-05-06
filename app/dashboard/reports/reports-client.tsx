"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface ReportsProps {
  leaveByType: { name: string; pending: number; approved: number; rejected: number }[];
  travelBudget: { category: string; estimated: number; actual: number }[];
  monthlyLeaves: { month: string; count: number }[];
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const categoryLabels: Record<string, string> = {
  per_diem: "ค่าเบี้ยเลี้ยง",
  accommodation: "ค่าที่พัก",
  transportation: "ค่าพาหนะ",
  fuel_toll: "ค่าน้ำมัน/ทางด่วน",
  registration: "ค่าลงทะเบียน",
  other: "อื่นๆ",
};

function formatCurrency(value: number) {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 0 });
}

export function ReportsClient({ leaveByType, travelBudget, monthlyLeaves }: ReportsProps) {
  const totalLeaves = leaveByType.reduce((acc, r) => acc + r.pending + r.approved + r.rejected, 0);
  const pieData = leaveByType.map((r) => ({
    name: r.name,
    value: r.pending + r.approved + r.rejected,
  }));

  const budgetData = travelBudget.map((b) => ({
    ...b,
    category: categoryLabels[b.category] ?? b.category,
  }));

  const totalEstimated = travelBudget.reduce((acc, b) => acc + b.estimated, 0);
  const totalActual = travelBudget.reduce((acc, b) => acc + b.actual, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="คำขอลาทั้งหมด" value={totalLeaves.toString()} sub="รายการ" />
        <SummaryCard title="งบประมาณเดินทาง (ประมาณ)" value={`฿${formatCurrency(totalEstimated)}`} sub="บาท" />
        <SummaryCard title="งบเบิกจ่ายจริง" value={`฿${formatCurrency(totalActual)}`} sub="บาท" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leave by type - Stacked bar */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">สถิติการลาแยกตามประเภท</h3>
          {leaveByType.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={leaveByType} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="approved" name="อนุมัติ" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" name="รออนุมัติ" fill="#f59e0b" stackId="a" />
                <Bar dataKey="rejected" name="ไม่อนุมัติ" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leave type pie */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">สัดส่วนการลาตามประเภท</h3>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly leaves line chart */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">การลารายเดือน (ปีนี้)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyLeaves}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Travel budget comparison */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">เปรียบเทียบงบประมาณเดินทาง (ประมาณ vs จริง)</h3>
          {budgetData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={budgetData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => `฿${formatCurrency(Number(value))}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="estimated" name="ประมาณการ" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="เบิกจ่ายจริง" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="text-xs text-muted-foreground font-medium">{title}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

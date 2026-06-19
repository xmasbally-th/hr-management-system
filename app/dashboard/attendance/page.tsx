import { ClipboardList, CalendarCheck } from "lucide-react";
import { getMyAttendance } from "@/lib/actions/attendance-actions";
import {
  periodLabel,
  fiscalYearLabel,
  DAY_COLUMNS,
  COUNT_COLUMNS,
  ANNUAL_LEAVE_COLUMNS,
} from "@/lib/attendance/labels";

export const metadata = { title: "การมาปฏิบัติงาน" };

interface MyEntry {
  id: string;
  work_days: number;
  travel_days: number;
  leave_vacation: number;
  leave_personal: number;
  leave_sick: number;
  leave_study: number;
  leave_maternity: number;
  leave_ordination: number;
  leave_spouse_childbirth: number;
  total_days: number;
  late_online_days: number;
  missing_checkout_count: number;
  absent_days: number;
  leave_sick_count: number;
  leave_personal_count: number;
  leave_vacation_count: number;
  leave_maternity_count: number;
  leave_ordination_count: number;
  leave_spouse_childbirth_count: number;
  period: {
    period_type: "monthly" | "annual";
    buddhist_year: number;
    month: number | null;
    working_days: number | null;
    status: string;
    title: string | null;
  } | null;
}

function monthlyLeaveTotal(e: MyEntry): number {
  return (
    e.leave_vacation +
    e.leave_personal +
    e.leave_sick +
    e.leave_study +
    e.leave_maternity +
    e.leave_ordination
  );
}

export default async function MyAttendancePage() {
  // Don't error the page if the attendance tables aren't migrated yet.
  const entries = (await getMyAttendance().catch(() => [])) as unknown as MyEntry[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">การมาปฏิบัติงานของฉัน</h1>
        <p className="text-muted-foreground">
          สรุปการมาปฏิบัติราชการของคุณ (รายเดือน/รายปีงบประมาณ) ตามข้อมูลที่ HR เผยแพร่
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-card py-16 flex flex-col items-center justify-center text-center gap-2">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการมาปฏิบัติงานที่เผยแพร่</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e) =>
            e.period?.period_type === "annual" ? (
              <AnnualCard key={e.id} e={e} />
            ) : (
              <MonthlyCard key={e.id} e={e} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function CardHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
      <div className="rounded-lg bg-primary/10 text-primary p-2">
        <CalendarCheck className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {right}
    </div>
  );
}

function MonthlyCard({ e }: { e: MyEntry }) {
  const p = e.period!;
  const lv = monthlyLeaveTotal(e);
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <CardHeader
        title={periodLabel(p.month ?? 0, p.buddhist_year)}
        sub={`วันทำงานของเดือน ${p.working_days ?? "-"} วัน`}
        right={lv > 0 ? <span className="text-xs text-muted-foreground">ลารวม {lv} วัน</span> : undefined}
      />
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 divide-x divide-y divide-border">
        {DAY_COLUMNS.map((c) => (
          <Cell key={c.key} label={c.label} value={e[c.key] as number} />
        ))}
        <Cell label="รวม" value={e.total_days} strong />
        {COUNT_COLUMNS.map((c) => (
          <Cell key={c.key} label={c.label} value={e[c.key] as number} warn={(e[c.key] as number) > 0} />
        ))}
      </div>
    </div>
  );
}

function AnnualCard({ e }: { e: MyEntry }) {
  const p = e.period!;
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <CardHeader
        title={fiscalYearLabel(p.buddhist_year)}
        sub="สรุปวันลารายปีงบประมาณ (ครั้ง/วัน)"
        right={<span className="text-xs rounded-full bg-muted px-2 py-0.5">รายปี</span>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y divide-border">
        {ANNUAL_LEAVE_COLUMNS.map((c) => {
          const days = e[c.key] as number;
          const count = e[`${c.key}_count` as keyof MyEntry] as number;
          return (
            <Cell key={c.key} label={c.label} value={count || days ? `${count}/${days}` : "·"} />
          );
        })}
        <Cell label="ลงเวลาสาย (วัน)" value={e.late_online_days} warn={e.late_online_days > 0} />
        <Cell label="ขาดงาน (วัน)" value={e.absent_days} warn={e.absent_days > 0} />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: number | string;
  strong?: boolean;
  warn?: boolean;
}) {
  const isZero = value === 0 || value === "·";
  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-[0.7rem] text-muted-foreground leading-tight">{label}</div>
      <div
        className={`mt-0.5 tabular-nums ${strong ? "text-lg font-bold" : "text-base font-semibold"} ${
          warn ? "text-amber-600" : !isZero ? "text-foreground" : "text-muted-foreground/40"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

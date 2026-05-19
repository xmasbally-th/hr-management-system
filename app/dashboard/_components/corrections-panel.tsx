import Link from "next/link";
import { ArrowRight, FileCheck2, Inbox } from "lucide-react";
import { Panel } from "./dashboard-primitives";

interface Props {
  data: {
    total: number;
    recent: Array<{
      id: string;
      target_user_id: string;
      user_name: string | null;
      department: string | null;
      reason_excerpt: string;
      fields_count: number;
      created_at: string;
    }>;
  };
  className?: string;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${(d.getUTCFullYear() + 543) % 100}`;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase() || "?";
}

/**
 * Dashboard panel for HR/Admin showing recent pending correction
 * requests + a deep link to the full queue.
 */
export function CorrectionsPanel({ data, className }: Props) {
  return (
    <Panel
      title="คำขอแก้ไขโปรไฟล์รออนุมัติ"
      sub={
        data.total > 0
          ? `${data.total} รายการรอ HR`
          : "ไม่มีคำขอรอดำเนินการ"
      }
      action={
        <Link
          href="/dashboard/hr/profile-corrections?status=pending"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          ดูทั้งหมด
          <ArrowRight className="size-3" />
        </Link>
      }
      className={className}
    >
      {data.recent.length === 0 ? (
        <div className="py-8 text-center">
          <Inbox className="size-8 mx-auto mb-2 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">
            ไม่มีคำขอรอดำเนินการในขณะนี้
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {data.recent.map((r) => (
            <li
              key={r.id}
              className="py-3 first:pt-0 last:pb-0 flex items-start gap-3"
            >
              <div className="size-8 rounded-full bg-amber-100 text-amber-800 grid place-items-center text-xs font-semibold shrink-0">
                {initialsOf(r.user_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {r.user_name ?? "—"}
                  </span>
                  {r.department && (
                    <span className="text-xs text-muted-foreground">
                      · {r.department}
                    </span>
                  )}
                </div>
                {r.reason_excerpt && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {r.reason_excerpt}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{formatShortDate(r.created_at)}</span>
                  {r.fields_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      <FileCheck2 className="size-3" />
                      {r.fields_count} ฟิลด์
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/dashboard/hr/users/${r.target_user_id}/edit?correction=${r.id}`}
                className="text-xs text-primary hover:underline shrink-0 mt-0.5"
              >
                ไปแก้
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

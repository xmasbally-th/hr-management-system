"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearchInput } from "@/components/search-input";
import { COMMITTED_LEAVE_STATUSES } from "@/lib/leave-rules";
import { cn } from "@/lib/utils";
import type { LeaveRequestRow, LeaveTypeOption, PersonnelRow } from "../leaves-dashboard-client";

interface Props {
  personnel: PersonnelRow[];
  leaveTypes: LeaveTypeOption[];
  requests: LeaveRequestRow[];
}

const COMMITTED = new Set<string>(COMMITTED_LEAVE_STATUSES);

interface Tally {
  count: number;
  days: number;
}

export function LeavesOverviewView({ personnel, leaveTypes, requests }: Props) {
  const [search, setSearch] = useState("");

  // employee_id → leave_type_id → { count, days } (committed requests only)
  const tallies = useMemo(() => {
    const map = new Map<string, Map<string, Tally>>();
    for (const r of requests) {
      if (!COMMITTED.has(r.status)) continue;
      let byType = map.get(r.employee_id);
      if (!byType) {
        byType = new Map();
        map.set(r.employee_id, byType);
      }
      const t = byType.get(r.leave_type_id) ?? { count: 0, days: 0 };
      t.count += 1;
      t.days += Number(r.total_days) || 0;
      byType.set(r.leave_type_id, t);
    }
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personnel;
    return personnel.filter((p) => p.full_name?.toLowerCase().includes(q));
  }, [personnel, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <ClientSearchInput
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อ..."
          className="sm:w-80"
        />
        <span className="text-sm text-muted-foreground shrink-0">
          บุคลากรทั้งหมด: <span className="font-semibold text-foreground">{filtered.length}</span> คน
        </span>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead rowSpan={2} className="align-bottom">ชื่อ-สกุล</TableHead>
              <TableHead rowSpan={2} className="align-bottom">ตำแหน่ง</TableHead>
              {leaveTypes.map((lt) => (
                <TableHead key={lt.id} colSpan={2} className="text-center border-l border-border">
                  {lt.name}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {leaveTypes.map((lt) => (
                <FragmentHead key={lt.id} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const byType = tallies.get(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.position_title ?? "-"}</TableCell>
                  {leaveTypes.map((lt) => {
                    const t = byType?.get(lt.id);
                    return (
                      <FragmentCell key={lt.id} count={t?.count ?? 0} days={t?.days ?? 0} />
                    );
                  })}
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + leaveTypes.length * 2} className="h-24 text-center text-muted-foreground">
                  ไม่พบบุคลากร
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** ครั้ง / วัน sub-header pair for a leave-type group. */
function FragmentHead() {
  return (
    <>
      <TableHead className="text-center text-xs font-normal text-muted-foreground border-l border-border">ครั้ง</TableHead>
      <TableHead className="text-center text-xs font-normal text-muted-foreground">วัน</TableHead>
    </>
  );
}

/** ครั้ง / วัน value pair for a leave-type group ("-" when zero). */
function FragmentCell({ count, days }: { count: number; days: number }) {
  return (
    <>
      <TableCell className={cn("text-center tabular-nums border-l border-border", count === 0 && "text-muted-foreground/40")}>
        {count === 0 ? "-" : count}
      </TableCell>
      <TableCell className={cn("text-center tabular-nums", days === 0 && "text-muted-foreground/40")}>
        {days === 0 ? "-" : days}
      </TableCell>
    </>
  );
}

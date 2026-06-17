"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearchInput } from "@/components/search-input";
import { cn } from "@/lib/utils";
import type { TravelRequestRow } from "@/components/travel-request-table";

/** Statuses that commit budget (everything except rejected/cancelled). */
const COMMITTED = new Set<string>([
  "pending",
  "awaiting_director",
  "awaiting_dean",
  "approved",
  "awaiting_university",
  "completed",
]);

interface Tally {
  name: string;
  position: string | null;
  count: number;
  estimated: number;
  actual: number;
}

/**
 * Budget summary for the travel hub's "ภาพรวม" tab (hr/admin only).
 * Aggregates estimated vs actual disbursed budget per employee across the
 * selected round — the two-phase budget separation per CLAUDE.md §3.3.
 */
export function TravelBudgetOverview({ requests }: { requests: TravelRequestRow[] }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const r of requests) {
      if (!COMMITTED.has(r.status)) continue;
      const t =
        map.get(r.employee_id) ??
        { name: r.employee?.full_name ?? "-", position: r.employee?.position_title ?? null, count: 0, estimated: 0, actual: 0 };
      t.count += 1;
      for (const e of r.expenses ?? []) {
        t.estimated += Number(e.estimated_amount) || 0;
        t.actual += Number(e.actual_amount) || 0;
      }
      map.set(r.employee_id, t);
    }
    return Array.from(map.values()).sort((a, b) => b.estimated - a.estimated);
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => {
          acc.count += r.count;
          acc.estimated += r.estimated;
          acc.actual += r.actual;
          return acc;
        },
        { count: 0, estimated: 0, actual: 0 },
      ),
    [filtered],
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="รวมประมาณการ" value={totals.estimated} tone="sky" />
        <SummaryCard label="รวมเบิกจริง" value={totals.actual} tone="emerald" />
        <SummaryCard label="คงเหลือ (ประมาณการ − เบิกจริง)" value={totals.estimated - totals.actual} tone="slate" />
      </div>

      <div className="flex items-center justify-between gap-4">
        <ClientSearchInput
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อ..."
          className="sm:w-80"
        />
        <span className="text-sm text-muted-foreground shrink-0">
          บุคลากรที่เดินทาง: <span className="font-semibold text-foreground">{filtered.length}</span> คน
        </span>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ชื่อ-สกุล</TableHead>
              <TableHead>ตำแหน่ง</TableHead>
              <TableHead className="text-center">ครั้ง</TableHead>
              <TableHead className="text-right">ประมาณการ (฿)</TableHead>
              <TableHead className="text-right">เบิกจริง (฿)</TableHead>
              <TableHead className="text-right">ส่วนต่าง (฿)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => {
              const diff = r.estimated - r.actual;
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.position ?? "-"}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.estimated.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.actual.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", diff < 0 && "text-destructive")}>
                    {diff.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ไม่มีข้อมูลงบประมาณในรอบนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  slate: "bg-muted text-foreground",
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-lg p-4", TONE_BG[tone])}>
      <p className="text-xs">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value.toLocaleString()} ฿</p>
    </div>
  );
}

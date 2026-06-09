"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setApprover,
  removeApprover,
  addActingDelegation,
  removeActingDelegation,
  type ApproverAssignment,
  type ActingDelegation,
  type ApproverRole,
} from "@/lib/actions/approver-actions";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatThai } from "@/lib/date-ranges";
import { Loader2, Trash2, UserCog, ShieldCheck, CalendarRange, Plus } from "lucide-react";
import { toast } from "sonner";

interface Emp {
  id: string;
  full_name: string;
  email: string;
}
interface Dept {
  id: string;
  name: string;
}

interface Props {
  approvers: ApproverAssignment[];
  delegations: ActingDelegation[];
  employees: Emp[];
  departments: Dept[];
}

const SELECT_CLS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm w-full max-w-xs disabled:opacity-50";

export function ApproversSection({ approvers, delegations, employees, departments }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const director = approvers.find((a) => a.approver_role === "director") ?? null;
  const dean = approvers.find((a) => a.approver_role === "dean") ?? null;
  const chairByDept = new Map(
    approvers.filter((a) => a.approver_role === "chair").map((a) => [a.department_id, a]),
  );

  function assign(role: ApproverRole, userId: string, current: ApproverAssignment | null, departmentId?: string | null) {
    start(async () => {
      try {
        if (!userId) {
          if (current) await removeApprover(current.id);
        } else {
          await setApprover({ approverRole: role, userId, departmentId });
        }
        toast.success("บันทึกแล้ว");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  // ── Acting delegation add form ──
  const [delUser, setDelUser] = useState("");
  const [delStart, setDelStart] = useState("");
  const [delEnd, setDelEnd] = useState("");
  const [delNote, setDelNote] = useState("");

  function addDeleg() {
    if (!delUser || !delStart || !delEnd) {
      toast.error("กรุณาเลือกผู้รักษาราชการแทน และช่วงวันที่");
      return;
    }
    start(async () => {
      try {
        await addActingDelegation({ delegateUserId: delUser, startDate: delStart, endDate: delEnd, note: delNote });
        toast.success("เพิ่มการรักษาราชการแทนแล้ว");
        setDelUser(""); setDelStart(""); setDelEnd(""); setDelNote("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function removeDeleg(id: string) {
    start(async () => {
      try {
        await removeActingDelegation(id);
        toast.success("ลบแล้ว");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
      }
    });
  }

  const empOption = (e: Emp) => (
    <option key={e.id} value={e.id}>
      {e.full_name} ({e.email})
    </option>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── ผอ. / คณบดี (faculty-wide) ── */}
      <div className="border rounded-lg p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-600" />
          <h3 className="font-semibold text-base">ผู้ลงนามระดับคณะ</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-3 items-center">
          <Label className="text-sm">ผู้อำนวยการ (ผอ.)</Label>
          <select
            className={SELECT_CLS}
            value={director?.user?.id ?? ""}
            disabled={busy}
            onChange={(e) => assign("director", e.target.value, director)}
          >
            <option value="">— ยังไม่กำหนด —</option>
            {employees.map(empOption)}
          </select>

          <Label className="text-sm">คณบดี</Label>
          <select
            className={SELECT_CLS}
            value={dean?.user?.id ?? ""}
            disabled={busy}
            onChange={(e) => assign("dean", e.target.value, dean)}
          >
            <option value="">— ยังไม่กำหนด —</option>
            {employees.map(empOption)}
          </select>
        </div>
      </div>

      {/* ── ประธานสาขาวิชา (per department) ── */}
      <div className="border rounded-lg p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-base">ประธานสาขาวิชา (ต่อหน่วยงาน)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ใช้เฉพาะ <b>ลาพักผ่อนของบุคลากรสายวิชาการ</b> — ประธานสาขาให้ความเห็นก่อนส่ง ผอ./คณบดี
        </p>

        <div className="divide-y">
          {departments.map((d) => {
            const cur = chairByDept.get(d.id) ?? null;
            return (
              <div key={d.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 py-2 items-center">
                <span className="text-sm">{d.name}</span>
                <select
                  className={SELECT_CLS}
                  value={cur?.user?.id ?? ""}
                  disabled={busy}
                  onChange={(e) => assign("chair", e.target.value, cur, d.id)}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {employees.map(empOption)}
                </select>
              </div>
            );
          })}
          {departments.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">ยังไม่มีหน่วยงาน — เพิ่มที่แท็บ &quot;หน่วยงาน&quot;</p>
          )}
        </div>
      </div>

      {/* ── รักษาราชการแทนคณบดี ── */}
      <div className="border rounded-lg p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-violet-600" />
          <h3 className="font-semibold text-base">รักษาราชการแทนคณบดี (ชั่วคราว)</h3>
        </div>

        {/* existing delegations */}
        <div className="space-y-2">
          {delegations.map((dg) => (
            <div key={dg.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{dg.delegate?.full_name ?? "-"}</span>
                <span className="text-muted-foreground">
                  {" "}· {formatThai(dg.start_date)} – {formatThai(dg.end_date)}
                  {dg.note ? ` · ${dg.note}` : ""}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => removeDeleg(dg.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {delegations.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มีการมอบหมาย</p>
          )}
        </div>

        {/* add form */}
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">ผู้รักษาราชการแทน</Label>
              <select className={SELECT_CLS + " max-w-none"} value={delUser} disabled={busy} onChange={(e) => setDelUser(e.target.value)}>
                <option value="">— เลือกผู้รักษาราชการแทน —</option>
                {employees.map(empOption)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ตั้งแต่วันที่</Label>
              <ThaiDatePicker value={delStart} onChange={setDelStart} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ถึงวันที่</Label>
              <ThaiDatePicker value={delEnd} onChange={setDelEnd} disabled={busy} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">หมายเหตุ (ถ้ามี)</Label>
              <Input value={delNote} disabled={busy} onChange={(e) => setDelNote(e.target.value)} placeholder="เช่น คณบดีไปราชการต่างประเทศ" />
            </div>
          </div>
          <Button onClick={addDeleg} disabled={busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            เพิ่มการรักษาราชการแทน
          </Button>
        </div>
      </div>
    </div>
  );
}

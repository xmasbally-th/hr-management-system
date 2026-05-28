"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeaveOnlineEnabled,
  updateLeavePolicy,
  type LeavePolicy,
} from "@/lib/actions/settings-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wifi, WifiOff, Save, SlidersHorizontal, Wallet, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  enabled: boolean;
  policy: LeavePolicy;
}

export function LeaveSettingsSection({ enabled, policy }: Props) {
  const router = useRouter();
  const [isToggling, startToggle] = useTransition();
  const [isSavingPolicy, startSavePolicy] = useTransition();
  const [current, setCurrent] = useState(enabled);

  const [certThreshold, setCertThreshold] = useState(
    String(policy.sick_cert_threshold_working_days),
  );
  const [advanceNotice, setAdvanceNotice] = useState(
    String(policy.personal_advance_notice_days),
  );

  const certNum = Number.parseInt(certThreshold, 10);
  const noticeNum = Number.parseInt(advanceNotice, 10);
  const policyDirty =
    certNum !== policy.sick_cert_threshold_working_days ||
    noticeNum !== policy.personal_advance_notice_days;
  const policyValid =
    Number.isInteger(certNum) && certNum >= 0 &&
    Number.isInteger(noticeNum) && noticeNum >= 0;

  function handleToggle() {
    const next = !current;
    startToggle(async () => {
      try {
        await updateLeaveOnlineEnabled(next);
        setCurrent(next);
        toast.success(next ? "เปิดระบบยื่นลาออนไลน์แล้ว" : "ปิดระบบยื่นลาออนไลน์แล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
      }
    });
  }

  function handleSavePolicy() {
    if (!policyValid) {
      toast.error("กรุณากรอกตัวเลขจำนวนเต็ม ≥ 0");
      return;
    }
    startSavePolicy(async () => {
      try {
        await updateLeavePolicy({
          sick_cert_threshold_working_days: certNum,
          personal_advance_notice_days: noticeNum,
        });
        toast.success("บันทึกนโยบายการลาแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Online toggle */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-base flex items-center gap-2">
              {current ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              ระบบยื่นคำขอลาออนไลน์
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              เมื่อเปิด พนักงานสามารถยื่นคำขอลาผ่านระบบได้โดยตรง
              <br />
              เมื่อปิด พนักงานจะไม่สามารถยื่นออนไลน์ได้ แต่ HR ยังสามารถกรอกแทนได้ผ่านช่องทางกระดาษ
            </p>
          </div>

          <Badge
            variant={current ? "default" : "secondary"}
            className={current ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
          >
            {current ? "เปิด" : "ปิด"}
          </Badge>
        </div>

        <Button
          variant={current ? "destructive" : "default"}
          onClick={handleToggle}
          disabled={isToggling}
          className="w-full sm:w-auto"
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : current ? (
            <WifiOff className="h-4 w-4 mr-2" />
          ) : (
            <Wifi className="h-4 w-4 mr-2" />
          )}
          {current ? "ปิดระบบยื่นลาออนไลน์" : "เปิดระบบยื่นลาออนไลน์"}
        </Button>
      </div>

      {/* Leave policy thresholds */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-sky-600" />
            นโยบายการลา
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ปรับเกณฑ์ที่ระบบใช้ตรวจสอบคำขอลา — มีผลทันทีกับฟอร์มยื่นลาและตรวจสอบฝั่งเซิร์ฟเวอร์
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cert-threshold" className="text-sm">
              ลาป่วยกี่วันทำการ ต้องแนบใบรับรองแพทย์
            </Label>
            <Input
              id="cert-threshold"
              type="number"
              min={0}
              max={30}
              value={certThreshold}
              onChange={(e) => setCertThreshold(e.target.value)}
              disabled={isSavingPolicy}
            />
            <p className="text-xs text-muted-foreground">
              ถ้าลาป่วย <b>เกิน</b> ค่านี้ → บังคับแนบใบรับรอง (ค่าเริ่มต้น: 2)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="advance-notice" className="text-sm">
              ลากิจวางแผน ยื่นล่วงหน้า (วัน)
            </Label>
            <Input
              id="advance-notice"
              type="number"
              min={0}
              max={30}
              value={advanceNotice}
              onChange={(e) => setAdvanceNotice(e.target.value)}
              disabled={isSavingPolicy}
            />
            <p className="text-xs text-muted-foreground">
              ลากิจประเภท &quot;วางแผน&quot; ต้องยื่น ≥ ค่านี้วัน (ค่าเริ่มต้น: 3)
            </p>
          </div>
        </div>

        <Button
          onClick={handleSavePolicy}
          disabled={isSavingPolicy || !policyDirty || !policyValid}
          className="w-full sm:w-auto"
        >
          {isSavingPolicy ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          บันทึกนโยบาย
        </Button>
      </div>

      {/* Cross-link → operational sibling page (initialize + import + edit per
          employee). Lives here because HR who tunes leave config is the same
          person who tends to year-rollover balance work. */}
      <div className="border border-dashed border-sky-300 rounded-lg p-4 bg-sky-50/40 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <Wallet className="h-4 w-4 mt-0.5 text-sky-600 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">จัดการยอดวันลาพนักงาน</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              ตั้งต้นสิทธิ์วันลาประจำปีงบประมาณ · นำเข้ายอดคงเหลือจาก CSV ·
              ดูตารางพนักงาน × ประเภทลา · แก้ไขรายคนพร้อม audit log
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/hr/leave-balances"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          ไปยังหน้า
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Link>
      </div>
    </div>
  );
}

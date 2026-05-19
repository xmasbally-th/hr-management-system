"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitCorrectionRequest } from "@/lib/actions/welcome-actions";

interface Props {
  scope: "first_review" | "post_approval";
  /** Pre-checked fields when opening — e.g. user clicked "ขอแก้" on
   *  the ข้อมูลส่วนตัว section, so that section's keys are flagged. */
  initialFields?: string[];
  /** Called after a successful submit. The form lives inside dialogs or
   *  pages — the parent decides what to do (close, navigate, refresh). */
  onSubmitted?: () => void;
  onCancel?: () => void;
}

/**
 * Shared correction-request form used by:
 *   • /welcome (scope=first_review)
 *   • /dashboard/profile (scope=post_approval)
 *
 * Lets the user check off fields that need updating and write a freeform
 * description of the requested changes. HR/Admin will apply the change
 * after reviewing.
 */
export function CorrectionRequestForm({
  scope,
  initialFields = [],
  onSubmitted,
  onCancel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [flagged, setFlagged] = useState<Set<string>>(
    new Set(initialFields),
  );
  const [reason, setReason] = useState("");

  function toggleField(key: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error("กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร");
      return;
    }
    startTransition(async () => {
      try {
        await submitCorrectionRequest({
          fields_flagged: Array.from(flagged),
          reason_text: reason,
          scope,
        });
        toast.success(
          scope === "first_review"
            ? "ส่งคำขอแก้ไขแล้ว — เริ่มใช้งานระบบได้เลย"
            : "ส่งคำขอแก้ไขให้ฝ่ายบุคคลแล้ว",
          { duration: 5000 },
        );
        onSubmitted?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ส่งคำขอไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">
            แจ้งข้อมูลที่ต้องแก้ไขให้ฝ่ายบุคคล
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            กรุณาเลือกหัวข้อที่ต้องแก้ไข และระบุรายละเอียด
            เพื่อให้ฝ่ายบุคคลดำเนินการได้ถูกต้อง
          </p>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold mb-2 block">
          หัวข้อที่ต้องแก้ไข
        </Label>
        <div className="space-y-3">
          {FIELD_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                {g.title}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.keys.map((k) => (
                  <label
                    key={k}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition",
                      flagged.has(k)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={flagged.has(k)}
                      onChange={() => toggleField(k)}
                      disabled={isPending}
                      className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-sm">{FIELD_LABELS[k]}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="reason" className="text-sm font-semibold mb-2 block">
          รายละเอียด <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="โปรดระบุรายละเอียดข้อมูลที่ต้องการแก้ไข เช่น 'นามสกุลสะกดผิด ที่ถูกต้องคือ ...' หรือ 'เบอร์โทรเปลี่ยนเป็น 089-xxx-xxxx'"
          rows={6}
          disabled={isPending}
          maxLength={2000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        <div className="text-xs text-muted-foreground mt-1 text-right">
          {reason.length} / 2000
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            <ArrowLeft className="size-4 mr-2" />
            ยกเลิก
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || reason.trim().length < 10}
        >
          {isPending ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Send className="size-4 mr-2" />
          )}
          ส่งคำขอให้ฝ่ายบุคคล
        </Button>
      </div>
    </div>
  );
}

// Field key → Thai label
export const FIELD_LABELS: Record<string, string> = {
  title_th: "คำนำหน้า (ไทย)",
  first_name_th: "ชื่อ (ไทย)",
  last_name_th: "นามสกุล (ไทย)",
  title_en: "คำนำหน้า (อังกฤษ)",
  first_name_en: "ชื่อ (อังกฤษ)",
  last_name_en: "นามสกุล (อังกฤษ)",
  phone: "เบอร์โทรศัพท์",
  gender: "เพศ",
  birth_date: "วันเดือนปีเกิด",
  current_address: "ที่อยู่ปัจจุบัน",
  position_title: "ตำแหน่ง",
  position_number: "เลขที่ตำแหน่ง",
  employee_type: "ประเภทบุคลากร",
  department_id: "สังกัดหน่วยงาน",
  hire_date: "วันที่เริ่มทำงาน",
  educations: "ประวัติการศึกษา",
  decorations: "เครื่องราชอิสริยาภรณ์",
  admin_positions: "ประวัติการดำรงตำแหน่งบริหาร",
};

// Section key → field keys (used by per-section "ขอแก้" buttons to pre-check)
export const SECTION_FIELDS: Record<string, string[]> = {
  identity: [
    "title_th","first_name_th","last_name_th",
    "title_en","first_name_en","last_name_en",
    "phone","gender","birth_date","current_address",
  ],
  position: [
    "position_title","position_number","employee_type",
    "department_id","hire_date",
  ],
  educations: ["educations"],
  decorations: ["decorations"],
  admin_positions: ["admin_positions"],
};

export const FIELD_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "ข้อมูลส่วนตัว", keys: SECTION_FIELDS.identity },
  { title: "ข้อมูลตำแหน่ง", keys: SECTION_FIELDS.position },
  {
    title: "ข้อมูลอื่นๆ",
    keys: ["educations", "decorations", "admin_positions"],
  },
];

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelMyCorrectionRequest } from "@/lib/actions/welcome-actions";

interface Correction {
  id: string;
  reason_text: string;
  fields_flagged: string[];
  scope: "first_review" | "post_approval";
  created_at: string;
}

interface Props {
  corrections: Correction[];
}

const FIELD_LABELS: Record<string, string> = {
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

const THAI_MONTHS = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const yearBE = (d.getUTCFullYear() + 543) % 100;
  return `${day} ${month} ${yearBE}`;
}

/**
 * Banner shown on every /dashboard page when the user has pending profile
 * correction requests waiting on HR. Includes a cancel button so the user
 * can withdraw if they change their mind.
 */
export function CorrectionStatusBanner({ corrections }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (corrections.length === 0) return null;

  function handleCancel(id: string) {
    startTransition(async () => {
      try {
        await cancelMyCorrectionRequest(id);
        toast.success("ยกเลิกคำขอแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="size-9 grid place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
          <Clock className="size-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="font-semibold text-amber-900">
              ฝ่ายบุคคลกำลังดำเนินการแก้ไขข้อมูลของคุณ
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              มีคำขอแก้ไขข้อมูล {corrections.length} รายการรอ HR ดำเนินการ
              — คุณสามารถใช้งานระบบได้ตามปกติระหว่างรอ
            </p>
          </div>

          <ul className="space-y-2">
            {corrections.map((c) => (
              <li
                key={c.id}
                className="rounded-lg bg-white border border-amber-200 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-amber-900">
                        {formatShortDate(c.created_at)}
                      </span>
                      {c.scope === "first_review" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          คำขอตรวจสอบครั้งแรก
                        </span>
                      )}
                      {c.scope === "post_approval" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          คำขอแก้ไขเพิ่มเติม
                        </span>
                      )}
                    </div>
                    {c.fields_flagged.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.fields_flagged.map((k) => (
                          <span
                            key={k}
                            className="inline-flex items-center px-1.5 py-px rounded text-xs bg-amber-50 text-amber-900 border border-amber-200"
                          >
                            {FIELD_LABELS[k] ?? k}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-foreground mt-1.5 whitespace-pre-wrap line-clamp-3">
                      {c.reason_text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(c.id)}
                    disabled={isPending}
                    className="size-7 grid place-items-center rounded text-muted-foreground hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50 transition shrink-0"
                    title="ยกเลิกคำขอนี้"
                    aria-label="ยกเลิกคำขอนี้"
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

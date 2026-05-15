"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSetting } from "@/lib/system-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, X, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  initialDomains: string[];
  initialAutoApprove: boolean;
  /** Last `updated_at` timestamp for each setting, for "saved X ago" display */
  lastUpdated?: {
    allowed_email_domains?: string | null;
    auto_approve_new_users?: string | null;
  };
}

export function SecuritySection({
  initialDomains,
  initialAutoApprove,
  lastUpdated,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [domains, setDomains] = useState<string[]>(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [autoApprove, setAutoApprove] = useState(initialAutoApprove);

  function addDomain() {
    const v = newDomain.trim().toLowerCase();
    if (!v) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) {
      toast.error("รูปแบบโดเมนไม่ถูกต้อง (เช่น g.lpru.ac.th)");
      return;
    }
    if (domains.includes(v)) {
      toast.error("โดเมนนี้มีอยู่แล้ว");
      return;
    }
    setDomains([...domains, v]);
    setNewDomain("");
  }

  function removeDomain(d: string) {
    setDomains(domains.filter((x) => x !== d));
  }

  function saveDomains() {
    if (domains.length === 0) {
      toast.error("ต้องมีอย่างน้อย 1 โดเมน (หรือคงค่าเดิม)");
      return;
    }
    startTransition(async () => {
      try {
        await updateSetting("allowed_email_domains", domains);
        toast.success("บันทึกรายการโดเมนแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function saveAutoApprove(value: boolean) {
    setAutoApprove(value);
    startTransition(async () => {
      try {
        await updateSetting("auto_approve_new_users", value);
        toast.success(
          value
            ? "เปิดอนุมัติอัตโนมัติแล้ว"
            : "ปิดอนุมัติอัตโนมัติแล้ว — ต้อง HR อนุมัติด้วยมือ",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
        setAutoApprove(!value); // revert local state on error
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Allowed email domains */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> โดเมนอีเมลที่อนุญาต
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            เฉพาะอีเมลที่ลงท้ายด้วยโดเมนในรายการนี้เท่านั้นจึงจะ login ผ่าน Google ได้
            — ถ้าว่าง = ไม่จำกัด (อันตราย, ใช้เฉพาะ dev)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {domains.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              (ว่าง — ใครก็ login ได้)
            </span>
          ) : (
            domains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-mono"
              >
                @{d}
                <button
                  type="button"
                  onClick={() => removeDomain(d)}
                  disabled={isPending}
                  className="hover:text-rose-600 disabled:opacity-50"
                  aria-label={`ลบโดเมน ${d}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="newDomain" className="sr-only">โดเมนใหม่</Label>
            <Input
              id="newDomain"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="g.lpru.ac.th"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDomain();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addDomain}
            disabled={isPending || !newDomain.trim()}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            เพิ่ม
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {lastUpdated?.allowed_email_domains
              ? `อัปเดตล่าสุด ${new Date(lastUpdated.allowed_email_domains).toLocaleString("th-TH")}`
              : "ยังไม่เคยแก้ไขจาก UI"}
          </div>
          <Button type="button" onClick={saveDomains} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Auto-approve toggle */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              อนุมัติบัญชีใหม่อัตโนมัติ
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              เมื่อเปิด — ผู้ใช้ใหม่ที่ login ครั้งแรกจะเข้าใช้งานได้ทันที (status = approved)
              <br />
              เมื่อปิด — ต้องรอ HR/Admin อนุมัติก่อน (status = pending) ที่หน้า{" "}
              <span className="font-medium">จัดการผู้ใช้งาน</span>
            </p>
            {lastUpdated?.auto_approve_new_users && (
              <p className="text-xs text-muted-foreground mt-2">
                อัปเดตล่าสุด{" "}
                {new Date(lastUpdated.auto_approve_new_users).toLocaleString("th-TH")}
              </p>
            )}
          </div>
          <ToggleSwitch
            checked={autoApprove}
            onChange={saveAutoApprove}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        💡 ค่าเหล่านี้บันทึกในตาราง <code className="font-mono bg-muted px-1 rounded">system_settings</code>{" "}
        — auth callback จะอ่านค่าใหม่ภายใน 1 นาทีหลังบันทึก
        (มี in-process cache เพื่อลดการเรียก DB)
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-emerald-500" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

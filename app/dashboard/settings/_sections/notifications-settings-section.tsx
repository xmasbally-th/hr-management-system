"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  updateNotificationTypeSetting,
  type TypeSettingRow,
} from "@/lib/actions/notification-settings-actions";
import { Input } from "@/components/ui/input";
import { Bell, Calendar, Plane, UserCog, FileEdit, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  initial: TypeSettingRow[];
}

const GROUP_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  leave: { label: "การลา", icon: Calendar },
  travel: { label: "การเดินทาง", icon: Plane },
  account: { label: "บัญชีผู้ใช้", icon: UserCog },
  profile: { label: "โปรไฟล์", icon: FileEdit },
  hr_inbox: { label: "กล่องงาน HR/Admin", icon: Inbox },
};

const ROLES: Array<{ key: "admin" | "hr" | "manager" | "employee"; label: string }> = [
  { key: "admin", label: "Admin" },
  { key: "hr", label: "HR" },
  { key: "manager", label: "Manager" },
  { key: "employee", label: "Employee" },
];

function Toggle({
  checked,
  onChange,
  disabled,
  tone = "emerald",
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  tone?: "emerald" | "sky";
}) {
  const onColor = tone === "sky" ? "bg-sky-500" : "bg-emerald-500";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? onColor : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function NotificationsSettingsSection({ initial }: Props) {
  const [rows, setRows] = useState<TypeSettingRow[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [savingType, setSavingType] = useState<string | null>(null);

  function patchRow(type: string, patch: Partial<TypeSettingRow>) {
    setRows((prev) =>
      prev.map((r) => (r.type === type ? { ...r, ...patch } : r)),
    );
  }

  function persist(type: string, patch: {
    enabled?: boolean;
    realtime_enabled?: boolean;
    cooldown_seconds?: number;
    recipient_roles?: Record<string, boolean>;
  }) {
    setSavingType(type);
    startTransition(async () => {
      try {
        await updateNotificationTypeSetting(type, patch);
        toast.success("บันทึกการตั้งค่าแล้ว", { duration: 1500 });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      } finally {
        setSavingType(null);
      }
    });
  }

  // Group by category
  const grouped = rows.reduce<Record<string, TypeSettingRow[]>>((acc, r) => {
    (acc[r.group] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
        <Bell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            ตั้งค่าการแจ้งเตือนระดับระบบ — มีผลกับผู้ใช้ทุกคน (ไม่ใช่รายบุคคล)
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><span className="font-medium text-foreground">เปิด</span> — ส่งการแจ้งเตือนประเภทนี้หรือไม่</li>
            <li><span className="font-medium text-foreground">Realtime</span> — เด้ง toast/แจ้งเตือนทันที (ปิด = ขึ้นที่กระดิ่งเท่านั้น)</li>
            <li><span className="font-medium text-foreground">Cooldown</span> — เว้นระยะขั้นต่ำ (วินาที) ก่อนส่งซ้ำชนิดเดียวกันให้คนเดิม</li>
            <li><span className="font-medium text-foreground">ผู้รับ</span> — role ที่จะได้รับการแจ้งเตือนนี้</li>
          </ul>
        </div>
      </div>

      {Object.entries(grouped).map(([groupKey, items]) => {
        const meta = GROUP_META[groupKey] ?? { label: groupKey, icon: Bell };
        const Icon = meta.icon;
        return (
          <div key={groupKey} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{meta.label}</span>
            </div>
            <ul className="divide-y divide-border/70">
              {items.map((r) => {
                const saving = savingType === r.type;
                return (
                  <li key={r.type} className="px-4 py-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.description}
                        </div>
                      </div>
                      {saving && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          กำลังบันทึก...
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {/* Enabled */}
                      <label className="flex items-center gap-2 text-xs">
                        <Toggle
                          checked={r.enabled}
                          disabled={isPending}
                          onChange={() => {
                            const next = !r.enabled;
                            patchRow(r.type, { enabled: next });
                            persist(r.type, { enabled: next });
                          }}
                        />
                        <span className="text-muted-foreground">เปิด</span>
                      </label>

                      {/* Realtime */}
                      <label className="flex items-center gap-2 text-xs">
                        <Toggle
                          checked={r.realtime_enabled}
                          tone="sky"
                          disabled={isPending || !r.enabled}
                          onChange={() => {
                            const next = !r.realtime_enabled;
                            patchRow(r.type, { realtime_enabled: next });
                            persist(r.type, { realtime_enabled: next });
                          }}
                        />
                        <span className="text-muted-foreground">Realtime</span>
                      </label>

                      {/* Cooldown */}
                      <label className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Cooldown</span>
                        <Input
                          type="number"
                          min={0}
                          max={86400}
                          value={r.cooldown_seconds}
                          disabled={isPending || !r.enabled}
                          onChange={(e) =>
                            patchRow(r.type, {
                              cooldown_seconds: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          onBlur={(e) =>
                            persist(r.type, {
                              cooldown_seconds: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 w-20 text-xs"
                        />
                        <span className="text-muted-foreground">วิ</span>
                      </label>

                      {/* Recipient roles */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">ผู้รับ:</span>
                        {ROLES.map((role) => {
                          const on = r.recipient_roles[role.key] !== false;
                          return (
                            <button
                              key={role.key}
                              type="button"
                              disabled={isPending || !r.enabled}
                              onClick={() => {
                                const nextRoles = {
                                  ...r.recipient_roles,
                                  [role.key]: !on,
                                };
                                patchRow(r.type, { recipient_roles: nextRoles });
                                persist(r.type, { recipient_roles: nextRoles });
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium border transition",
                                on
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-border",
                                (isPending || !r.enabled) && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              {role.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

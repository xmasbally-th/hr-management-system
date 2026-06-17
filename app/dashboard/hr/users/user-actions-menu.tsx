"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateUserStatus,
  updateUserRole
} from "@/lib/actions/user-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserCheck, UserX, Shield, Loader2, Pencil, KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SetPasswordDialog } from "./set-password-dialog";
import { toast } from "sonner";
import type { ProfileStatus, UserRole } from "@/types/supabase";

export function UserActionsMenu({ profile }: { profile: { id: string; status: ProfileStatus; role: UserRole; full_name?: string; email?: string } }) {
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<{
    type: "status" | "role";
    value: string;
    label: string;
  } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  function handleConfirm() {
    if (!confirmAction) return;
    const { type, value } = confirmAction;
    setConfirmAction(null);

    if (type === "status") {
      startTransition(async () => {
        try {
          await updateUserStatus(profile.id, value as ProfileStatus);
          toast.success("เปลี่ยนสถานะเรียบร้อยแล้ว");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        }
      });
    } else {
      startTransition(async () => {
        try {
          await updateUserRole(profile.id, value as UserRole);
          toast.success("เปลี่ยนระดับสิทธิ์เรียบร้อยแล้ว");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        }
      });
    }
  }

  return (
    <>
      {/* Edit profile link — kept outside the dropdown to avoid a
          Base UI Menu/Next.js Link prefetch interaction (Base UI #31) */}
      <Link
        href={`/dashboard/hr/users/${profile.id}/edit`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-muted"
        title="แก้ไขโปรไฟล์"
        aria-label="แก้ไขโปรไฟล์"
      >
        <Pencil className="h-4 w-4" />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <span className="sr-only">เปิดเมนู</span>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>จัดการผู้ใช้</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {/* Status Actions */}
        {profile.status === "pending" && (
          <DropdownMenuItem onClick={() => setConfirmAction({ type: "status", value: "approved", label: "อนุมัติผู้ใช้งาน" })}>
            <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
            อนุมัติผู้ใช้งาน
          </DropdownMenuItem>
        )}

        {profile.status === "approved" && (
          <DropdownMenuItem onClick={() => setConfirmAction({ type: "status", value: "rejected", label: "ระงับการใช้งาน" })}>
            <UserX className="mr-2 h-4 w-4 text-destructive" />
            ระงับการใช้งาน
          </DropdownMenuItem>
        )}

        {profile.status === "rejected" && (
          <DropdownMenuItem onClick={() => setConfirmAction({ type: "status", value: "approved", label: "คืนสิทธิ์การใช้งาน" })}>
            <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
            คืนสิทธิ์การใช้งาน
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Set / reset login password — for users who can't use Google SSO */}
        <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
          <KeyRound className="mr-2 h-4 w-4" />
          ตั้ง/รีเซ็ตรหัสผ่าน
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Role Sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Shield className="mr-2 h-4 w-4" />
            เปลี่ยนระดับสิทธิ์
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={profile.role}
              onValueChange={(val) => setConfirmAction({ type: "role", value: val, label: `เปลี่ยนสิทธิ์เป็น ${val}` })}
            >
              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="hr">HR</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="manager">Manager</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="employee">Employee</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        </DropdownMenuContent>

        {/* Confirmation dialog */}
        <ConfirmDialog
          open={confirmAction !== null}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title={`ยืนยัน: ${confirmAction?.label ?? ""}`}
          description={`คุณต้องการ${confirmAction?.label ?? ""}สำหรับ ${profile.full_name ?? "ผู้ใช้นี้"} ใช่หรือไม่?`}
          confirmLabel="ยืนยัน"
          variant={confirmAction?.value === "rejected" ? "destructive" : "default"}
          onConfirm={handleConfirm}
        />
      </DropdownMenu>

      <SetPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        userId={profile.id}
        fullName={profile.full_name ?? "ผู้ใช้นี้"}
        email={profile.email ?? ""}
      />
    </>
  );
}

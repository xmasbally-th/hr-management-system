"use client";

import { useTransition } from "react";
import { 
  updateUserStatus, 
  updateUserRole 
} from "@/lib/actions/user-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { MoreHorizontal, UserCheck, UserX, Shield, Loader2 } from "lucide-react";
import type { ProfileStatus, UserRole } from "@/types/supabase";

export function UserActionsMenu({ profile }: { profile: { id: string; status: ProfileStatus; role: UserRole } }) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(newStatus: ProfileStatus) {
    startTransition(async () => {
      try {
        await updateUserStatus(profile.id, newStatus);
      } catch (err) {
        console.error(err);
        alert("Failed to update status");
      }
    });
  }

  function handleRoleChange(newRole: UserRole) {
    startTransition(async () => {
      try {
        await updateUserRole(profile.id, newRole);
      } catch (err) {
        console.error(err);
        alert("Failed to update role");
      }
    });
  }

  return (
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
        <DropdownMenuLabel>จัดการผู้ใช้</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Status Actions */}
        {profile.status === "pending" && (
          <DropdownMenuItem onClick={() => handleStatusChange("approved")}>
            <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
            อนุมัติผู้ใช้งาน
          </DropdownMenuItem>
        )}
        
        {profile.status === "approved" && (
          <DropdownMenuItem onClick={() => handleStatusChange("rejected")}>
            <UserX className="mr-2 h-4 w-4 text-destructive" />
            ระงับการใช้งาน
          </DropdownMenuItem>
        )}
        
        {profile.status === "rejected" && (
          <DropdownMenuItem onClick={() => handleStatusChange("approved")}>
            <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
            คืนสิทธิ์การใช้งาน
          </DropdownMenuItem>
        )}

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
              onValueChange={(val) => handleRoleChange(val as UserRole)}
            >
              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="hr">HR</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="manager">Manager</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="employee">Employee</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

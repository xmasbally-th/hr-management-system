"use client";

import { useState, useTransition } from "react";
import { updateUserStatus } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProfileStatus } from "@/types/supabase";

interface Props {
  id: string;
  status: ProfileStatus;
  fullName: string;
}

/**
 * Inline approve/reject buttons for HR users list — appears only on
 * "pending" rows. For other statuses, the cog (UserActionsMenu) still
 * handles transitions.
 */
export function UserRowActions({ id, status, fullName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"approved" | "rejected" | null>(null);

  if (status !== "pending") return null;

  function handleAction(action: "approved" | "rejected") {
    setConfirmAction(action);
  }

  function handleConfirm() {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    startTransition(async () => {
      try {
        await updateUserStatus(id, action);
        toast.success(
          action === "approved" ? "อนุมัติผู้ใช้งานแล้ว" : "ระงับการใช้งานแล้ว",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          onClick={() => handleAction("approved")}
          disabled={isPending}
          title="อนุมัติ"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleAction("rejected")}
          disabled={isPending}
          title="ปฏิเสธ"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmAction === "approved"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการอนุมัติ"
        description={`อนุมัติผู้ใช้งาน "${fullName}" ใช่หรือไม่?`}
        confirmLabel="อนุมัติ"
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirmAction === "rejected"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการระงับการใช้งาน"
        description={`ระงับการใช้งานของ "${fullName}" ใช่หรือไม่?`}
        confirmLabel="ระงับ"
        variant="destructive"
        onConfirm={handleConfirm}
      />
    </>
  );
}

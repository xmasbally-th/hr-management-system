"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  /** If true, shows a text input for a reason/note */
  withInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  onConfirm: (inputValue?: string) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "default",
  withInput = false,
  inputLabel,
  inputPlaceholder,
  onConfirm,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  function handleConfirm() {
    onConfirm(withInput ? inputValue : undefined);
    setInputValue("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setInputValue("");
    onOpenChange(nextOpen);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {withInput && (
          <div className="space-y-2 py-2">
            {inputLabel && <Label>{inputLabel}</Label>}
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            variant={variant === "destructive" ? "destructive" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

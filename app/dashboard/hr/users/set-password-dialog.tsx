"use client";

import { useState, useTransition } from "react";
import { setUserPassword } from "@/lib/actions/user-actions";
import { toCanonicalAuthEmail } from "@/lib/auth/canonical-email";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Copy, Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  email: string;
}

const MIN_LENGTH = 8;

/** Crypto-strong password generator (avoids ambiguous chars like O/0, l/1). */
function generatePassword(length = 12): string {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#%&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
}

/**
 * HR dialog to set or reset a user's login password.
 *
 * Used for employees who can't access Google SSO — HR issues a password the
 * employee then types at the login form. No email is sent; HR communicates the
 * password directly. The login email shown is the canonical @g.lpru.ac.th form
 * (the employee may also type their @lpru.ac.th address, which is folded to it).
 */
export function SetPasswordDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  email,
}: Props) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loginEmail = toCanonicalAuthEmail(email);
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  function reset() {
    setPassword("");
    setCopied(false);
    setShow(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleGenerate() {
    setPassword(generatePassword());
    setCopied(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  function handleSubmit() {
    if (password.length < MIN_LENGTH) return;
    startTransition(async () => {
      try {
        await setUserPassword(userId, password);
        toast.success(`ตั้งรหัสผ่านให้ "${fullName}" เรียบร้อยแล้ว`);
        handleOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ตั้งรหัสผ่านไม่สำเร็จ");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            ตั้ง/รีเซ็ตรหัสผ่าน
          </DialogTitle>
          <DialogDescription>
            ออกรหัสผ่านให้ <span className="font-medium text-foreground">{fullName}</span>{" "}
            สำหรับเข้าสู่ระบบด้วยอีเมล + รหัสผ่าน (ไม่มีการส่งอีเมล — กรุณาแจ้งรหัสให้ผู้ใช้เอง)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Login email the employee will use */}
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">อีเมลสำหรับเข้าสู่ระบบ: </span>
            <span className="font-mono font-medium">{loginEmail}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ผู้ใช้พิมพ์ <span className="font-mono">@lpru.ac.th</span> ก็ได้ ระบบจะจับคู่ให้อัตโนมัติ
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs">
              รหัสผ่านใหม่ <span className="text-muted-foreground">(อย่างน้อย {MIN_LENGTH} ตัวอักษร)</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setCopied(false);
                  }}
                  placeholder="กรอกหรือสุ่มรหัสผ่าน"
                  className="pr-9 font-mono"
                  autoComplete="new-password"
                  aria-invalid={tooShort}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!password}
                title="คัดลอกรหัสผ่าน"
              >
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
            {tooShort && (
              <p className="text-[11px] text-destructive">
                รหัสผ่านต้องมีอย่างน้อย {MIN_LENGTH} ตัวอักษร
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleGenerate}
            >
              <RefreshCw className="size-3.5" />
              สุ่มรหัสผ่านที่ปลอดภัย
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || password.length < MIN_LENGTH}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              "บันทึกรหัสผ่าน"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

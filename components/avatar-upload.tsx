"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateMyAvatar } from "@/lib/actions/profile-actions";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  currentUrl: string | null;
  userId: string;
  initials: string;
  /** Optional callback after a successful upload (e.g. local state update). */
  onChange?: (url: string | null) => void;
  className?: string;
}

const AVATAR_SIZE = 500;
const MAX_SOURCE_MB = 5;
const AVATAR_BUCKET = "avatars";
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Avatar uploader with client-side canvas resize.
 *
 * Steps:
 *   1. User picks an image (JPG/PNG/WebP, up to 5 MB)
 *   2. The image is drawn onto a 500×500 canvas with center-crop
 *      ("cover" behavior — short side fills, long side trims)
 *   3. Canvas is exported as JPEG (~95% quality) and uploaded directly
 *      to the `avatars` Supabase Storage bucket under `{userId}/avatar.jpg`
 *   4. Server action persists the public URL to `profiles.avatar_url`
 *
 * The bucket is public-readable so the URL can be used directly in <img>.
 */
export function AvatarUpload({
  currentUrl,
  userId,
  initials,
  onChange,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("รองรับเฉพาะไฟล์รูปภาพ");
      return;
    }
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) {
      toast.error(`ขนาดไฟล์เกิน ${MAX_SOURCE_MB} MB`);
      return;
    }

    setBusy(true);
    try {
      const blob = await resizeToSquare(file, AVATAR_SIZE);
      const path = `${userId}/avatar.jpg`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "0",
        });
      if (uploadError) {
        console.error(uploadError);
        toast.error("อัปโหลดไม่สำเร็จ: " + uploadError.message);
        setBusy(false);
        return;
      }

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      // Bust cache with timestamp so the new image shows immediately
      const finalUrl = `${data.publicUrl}?t=${Date.now()}`;

      startTransition(async () => {
        try {
          await updateMyAvatar(finalUrl);
          setPreviewUrl(finalUrl);
          onChange?.(finalUrl);
          // Notify the dashboard shell so the navbar avatar refreshes too
          window.dispatchEvent(
            new CustomEvent("profile-avatar-changed", { detail: finalUrl }),
          );
          toast.success("อัปเดตรูปภาพแล้ว");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
        }
      });
    } catch (err) {
      console.error(err);
      toast.error("ประมวลผลรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    setBusy(true);
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([`${userId}/avatar.jpg`]);
        await updateMyAvatar(null);
        setPreviewUrl(null);
        onChange?.(null);
        window.dispatchEvent(
          new CustomEvent("profile-avatar-changed", { detail: null }),
        );
        toast.success("ลบรูปภาพแล้ว");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    });
  }

  const working = busy || isPending;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover ring-2 ring-border shadow-sm"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 grid place-items-center text-white text-2xl font-semibold ring-2 ring-border shadow-sm">
            {initials}
          </div>
        )}
        {working && (
          <div className="absolute inset-0 rounded-full bg-black/40 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-foreground text-background grid place-items-center shadow-md hover:bg-foreground/90 transition disabled:opacity-50"
          aria-label="เปลี่ยนรูป"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="text-sm font-medium">รูปประจำตัว</div>
        <div className="text-xs text-muted-foreground">
          ระบบจะปรับเป็น 500×500 อัตโนมัติ · JPG/PNG/WebP · สูงสุด {MAX_SOURCE_MB} MB
        </div>
        <div className="flex gap-2 mt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={working}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {previewUrl ? "เปลี่ยนรูป" : "อัปโหลด"}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={working}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              ลบรูป
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

/**
 * Loads an image and draws a center-cropped square version onto a canvas,
 * returning the result as a JPEG Blob.
 */
async function resizeToSquare(file: File, size: number): Promise<Blob> {
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // "cover" — short side fills, long side trims
  const ratio = Math.max(size / img.width, size / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Encode failed"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

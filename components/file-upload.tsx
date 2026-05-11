"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadDocument } from "@/lib/actions/storage-actions";
import { toast } from "sonner";

interface FileUploadProps {
  /** Storage path prefix, e.g. "leaves/req-123" */
  pathPrefix: string;
  /** Called after a successful upload with the storage path */
  onUploaded: (path: string) => void;
  /** Accepted file types */
  accept?: string;
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Currently uploaded file path (for showing existing file) */
  existingPath?: string | null;
  /** Label text */
  label?: string;
  disabled?: boolean;
}

export function FileUpload({
  pathPrefix,
  onUploaded,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  maxSize = 5 * 1024 * 1024,
  existingPath,
  label = "อัปโหลดเอกสาร",
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(existingPath ?? null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > maxSize) {
      toast.error(`ไฟล์มีขนาดเกิน ${Math.round(maxSize / 1024 / 1024)} MB`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("path", pathPrefix);

      const { path } = await uploadDocument(formData);
      setUploadedPath(path);
      setPreviewName(file.name);
      onUploaded(path);
      toast.success("อัปโหลดไฟล์สำเร็จ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  }, [maxSize, pathPrefix, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemove = () => {
    setUploadedPath(null);
    setPreviewName(null);
    onUploaded("");
  };

  const isImage = (name: string) => /\.(jpg|jpeg|png|webp)$/i.test(name);

  if (uploadedPath) {
    const displayName = previewName || uploadedPath.split("/").pop() || "ไฟล์";
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
        {isImage(displayName) ? (
          <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
        ) : (
          <FileText className="h-5 w-5 text-red-500 shrink-0" />
        )}
        <span className="text-sm truncate flex-1">{displayName}</span>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg
          cursor-pointer transition-colors
          ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">กำลังอัปโหลด...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              ลากไฟล์มาวาง หรือ <span className="text-primary font-medium">คลิกเลือกไฟล์</span>
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG (สูงสุด {Math.round(maxSize / 1024 / 1024)} MB)
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>
    </div>
  );
}

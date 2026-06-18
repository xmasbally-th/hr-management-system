"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { checkRateLimit } from "@/lib/rate-limit";

const BUCKET = "documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function checkHrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: ไม่มีสิทธิ์อัปโหลดไฟล์");
  }
}

/**
 * Upload a document to Supabase Storage.
 * Only HR/Admin can upload.
 *
 * @param formData - FormData with `file` field and optional `path` prefix
 * @returns The storage path of the uploaded file
 */
export async function uploadDocument(formData: FormData): Promise<{ path: string }> {
  const file = formData.get("file") as File | null;
  const pathPrefix = (formData.get("path") as string) || "general";

  if (!file || file.size === 0) {
    throw new Error("กรุณาเลือกไฟล์");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ไฟล์มีขนาดเกิน 5 MB");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("รองรับเฉพาะไฟล์ PDF, JPG, PNG, WebP เท่านั้น");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  await checkHrAdmin(supabase, user.id);

  // Generate unique filename: prefix/timestamp-originalname
  // Supabase storage rejects non-ASCII keys ("Invalid key", 400 — verified
  // with Thai filenames), so the name must be ASCII-safe. A Thai-only name
  // like "ลาพักผ่อน.pdf" would sanitize to "_________.pdf"; fall back to a
  // readable date-stamped name instead so HR can still tell files apart.
  const timestamp = Date.now();
  let safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stem = safeName.replace(/\.[^.]*$/, "");
  if (!/[a-zA-Z0-9]/.test(stem)) {
    const ext = (safeName.match(/\.[^.]*$/) ?? [".pdf"])[0];
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    safeName = `doc-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${ext}`;
  }
  const storagePath = `${pathPrefix}/${timestamp}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[storage-actions] Upload failed:", error);
    throw new Error("ไม่สามารถอัปโหลดไฟล์ได้");
  }

  return { path: storagePath };
}

/**
 * Get a signed URL for a document (valid for 1 hour).
 */
export async function getDocumentUrl(path: string): Promise<string> {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.error("[storage-actions] Get URL failed:", error);
    throw new Error("ไม่สามารถสร้างลิงก์ไฟล์ได้");
  }

  return data.signedUrl;
}

/**
 * Delete a document from storage.
 * Only HR/Admin can delete.
 */
export async function deleteDocument(path: string): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error("[storage-actions] Delete failed:", error);
    throw new Error("ไม่สามารถลบไฟล์ได้");
  }
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, createMockChain, profileRow } from "./helpers";

// ---- module mocks ----
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { uploadDocument, getDocumentUrl, deleteDocument } from "../storage-actions";

const mockedCreateClient = vi.mocked(createClient);

function setHrClient() {
  const sb = createMockSupabase({
    authUser: { id: "hr-1", email: "hr@example.com" },
    fromOverrides: {
      profiles: createMockChain({ data: profileRow("hr") }),
    },
  });

  // Add storage mock
  (sb as Record<string, unknown>).storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "test/file.pdf" }, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };

  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

function setEmployeeClient() {
  const sb = createMockSupabase({
    authUser: { id: "emp-1" },
    fromOverrides: {
      profiles: createMockChain({ data: profileRow("employee") }),
    },
  });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

function setUnauthClient() {
  const sb = createMockSupabase({ authUser: null });
  mockedCreateClient.mockResolvedValue(sb as never);
  return sb;
}

function createTestFile(name = "test.pdf", size = 1024, type = "application/pdf") {
  const content = new Uint8Array(size);
  const file = new File([content], name, { type });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadDocument", () => {
  it("HR can upload a valid file", async () => {
    const sb = setHrClient();
    const formData = new FormData();
    formData.set("file", createTestFile());
    formData.set("path", "leaves/test");

    const result = await uploadDocument(formData);

    expect(result).toHaveProperty("path");
    expect((sb as any).storage.from).toHaveBeenCalledWith("documents");
  });

  it("rejects when no file provided", async () => {
    setHrClient();
    const formData = new FormData();

    await expect(uploadDocument(formData)).rejects.toThrow("กรุณาเลือกไฟล์");
  });

  it("rejects file over 5MB", async () => {
    setHrClient();
    const formData = new FormData();
    formData.set("file", createTestFile("large.pdf", 6 * 1024 * 1024));

    await expect(uploadDocument(formData)).rejects.toThrow("ไฟล์มีขนาดเกิน 5 MB");
  });

  it("rejects unsupported file type", async () => {
    setHrClient();
    const formData = new FormData();
    formData.set("file", createTestFile("script.js", 100, "application/javascript"));

    await expect(uploadDocument(formData)).rejects.toThrow("รองรับเฉพาะไฟล์ PDF, JPG, PNG, WebP");
  });

  it("non-HR is rejected", async () => {
    setEmployeeClient();
    const formData = new FormData();
    formData.set("file", createTestFile());

    await expect(uploadDocument(formData)).rejects.toThrow("Forbidden");
  });

  it("unauthenticated is rejected", async () => {
    setUnauthClient();
    const formData = new FormData();
    formData.set("file", createTestFile());

    await expect(uploadDocument(formData)).rejects.toThrow("Unauthorized");
  });
});

describe("getDocumentUrl", () => {
  it("returns a signed URL", async () => {
    setHrClient();
    const url = await getDocumentUrl("test/file.pdf");
    expect(url).toBe("https://example.com/signed");
  });

  it("unauthenticated is rejected", async () => {
    setUnauthClient();
    await expect(getDocumentUrl("test/file.pdf")).rejects.toThrow("Unauthorized");
  });
});

describe("deleteDocument", () => {
  it("HR can delete a document", async () => {
    const sb = setHrClient();
    await deleteDocument("test/file.pdf");
    const storageMock = (sb as any).storage.from("documents");
    expect(storageMock.remove).toHaveBeenCalledWith(["test/file.pdf"]);
  });

  it("non-HR is rejected", async () => {
    setEmployeeClient();
    await expect(deleteDocument("test/file.pdf")).rejects.toThrow("Forbidden");
  });
});

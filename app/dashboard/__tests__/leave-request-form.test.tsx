import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LeaveRequestForm } from "../leaves/new/leave-request-form";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: vi.fn() })),
}));

const mockCreateLeaveRequest = vi.fn();
const mockPreviewWorkingDays = vi.fn().mockResolvedValue({ workingDays: 5, calendarDays: 7 });
vi.mock("@/lib/actions/leave-actions", () => ({
  createLeaveRequest: (...args: unknown[]) => mockCreateLeaveRequest(...args),
  previewWorkingDays: (...args: unknown[]) => mockPreviewWorkingDays(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock FileUpload — no real upload in tests
vi.mock("@/components/file-upload", () => ({
  FileUpload: () => <div data-testid="file-upload" />,
}));

// Mock Shadcn Select as native <select>
let __latestOnValueChange: ((v: string) => void) | null = null;
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => {
    __latestOnValueChange = onValueChange;
    return <div data-value={value}>{children}</div>;
  },
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => (
    <select
      data-testid="mock-select"
      onChange={(e: any) => __latestOnValueChange?.(e.target.value)}
    >
      <option value="">--</option>
      {children}
    </select>
  ),
  SelectItem: ({ children, value }: any) => (
    <option value={value}>{children}</option>
  ),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { id: "lt-vac", name: "ลาพักผ่อน", code: "VACATION", max_days_per_year: 10, is_accumulative: true, conditions: null, created_at: "2024-01-01" },
  { id: "lt-sick", name: "ลาป่วย", code: "SICK", max_days_per_year: 30, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
  { id: "lt-per", name: "ลากิจ", code: "PERSONAL", max_days_per_year: 10, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
  { id: "lt-mat", name: "ลาคลอด", code: "MATERNITY", max_days_per_year: 90, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
];

const EMPLOYEES = [
  { id: "emp-1", full_name: "สมชาย ใจดี", email: "somchai@test.com" },
  { id: "emp-2", full_name: "สมหญิง ดีใจ", email: "somying@test.com" },
];

beforeEach(() => {
  mockPush.mockClear();
  mockCreateLeaveRequest.mockReset();
  localStorage.clear();
});

function renderForm(overrides?: Partial<React.ComponentProps<typeof LeaveRequestForm>>) {
  return render(
    <LeaveRequestForm
      leaveTypes={LEAVE_TYPES}
      employees={EMPLOYEES}
      leaveOnlineEnabled={true}
      gender="หญิง"
      employeeType="ข้าราชการ"
      {...overrides}
    />
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LeaveRequestForm (4-in-1 redesign)", () => {
  it("renders the 4 leave type tiles", () => {
    renderForm();
    expect(screen.getAllByText("ลาพักผ่อน").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ลาป่วย").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ลากิจ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ลาคลอด").length).toBeGreaterThanOrEqual(1);
  });

  it("defaults to vacation type and shows substitute fields", () => {
    renderForm();
    expect(screen.getByText(/ผู้ปฏิบัติหน้าที่แทนคนที่ 1/)).toBeTruthy();
  });

  it("switches to sick type and shows symptoms field", () => {
    renderForm();
    // Click the sick tab pill (one of them in the pill row — last "ลาป่วย" is the pill)
    const sickTexts = screen.getAllByText("ลาป่วย");
    fireEvent.click(sickTexts[sickTexts.length - 1].closest("button")!);
    expect(screen.getByText(/อาการเจ็บป่วย/)).toBeTruthy();
  });

  it("auto-fills date range from EDD when maternity is selected", () => {
    renderForm();
    const matTexts = screen.getAllByText("ลาคลอด");
    fireEvent.click(matTexts[matTexts.length - 1].closest("button")!);

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    // First date input in the rose pregnancy-info card is the EDD
    const edd = dateInputs[0];
    fireEvent.change(edd, { target: { value: "2026-06-01" } });

    // Start date = EDD - 30 = 2026-05-02 ; End date = +89 = 2026-07-30
    const startInput = dateInputs[1];
    const endInput = dateInputs[2];
    expect(startInput.value).toBe("2026-05-02");
    expect(endInput.value).toBe("2026-07-30");
  });

  it("blocks vacation submit without substitute 1", async () => {
    renderForm();
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-06-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-06-03" } });

    fireEvent.click(screen.getByRole("button", { name: /ส่งคำขอลา/ }));

    // Validation should prevent submit
    expect(mockCreateLeaveRequest).not.toHaveBeenCalled();
  });
});

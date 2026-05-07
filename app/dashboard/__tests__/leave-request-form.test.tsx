import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LeaveRequestForm } from "../leaves/new/leave-request-form";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: mockBack })),
}));

const mockCreateLeaveRequest = vi.fn();
vi.mock("@/lib/actions/leave-actions", () => ({
  createLeaveRequest: (...args: unknown[]) => mockCreateLeaveRequest(...args),
}));

// Mock Shadcn Select as native <select> using module-level callback ref.
let __latestOnValueChange: ((v: string) => void) | null = null;

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => {
    __latestOnValueChange = onValueChange;
    return (
      <div data-testid="select-wrapper" data-value={value}>
        {children}
      </div>
    );
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

// ─── Test fixtures ──────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { id: "lt-1", name: "ลาป่วย", max_days_per_year: 30, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
  { id: "lt-2", name: "ลากิจ", max_days_per_year: 10, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
  { id: "lt-3", name: "ลาคลอด", max_days_per_year: 90, is_accumulative: false, conditions: null, created_at: "2024-01-01" },
  { id: "lt-4", name: "ลาพักผ่อน", max_days_per_year: 10, is_accumulative: true, conditions: null, created_at: "2024-01-01" },
];

const EMPLOYEES = [
  { id: "emp-1", full_name: "สมชาย ใจดี", email: "somchai@test.com" },
  { id: "emp-2", full_name: "สมหญิง ดีใจ", email: "somying@test.com" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderForm() {
  return render(
    <LeaveRequestForm leaveTypes={LEAVE_TYPES} employees={EMPLOYEES} />,
  );
}

function selectLeaveType(id: string) {
  const selects = screen.getAllByTestId("mock-select");
  fireEvent.change(selects[0], { target: { value: id } });
}

function getDateInputs() {
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]');
}

function fillRequiredFields(leaveTypeId = "lt-2") {
  selectLeaveType(leaveTypeId);
  const dateInputs = getDateInputs();
  fireEvent.change(dateInputs[0], { target: { value: "2026-06-01" } });
  fireEvent.change(dateInputs[1], { target: { value: "2026-06-03" } });
  // Placeholder has encoding artifacts — find the reason input by its text input type
  // It's the first non-date, non-number text input after the date fields
  const textInputs = document.querySelectorAll<HTMLInputElement>(
    'input:not([type="date"]):not([type="number"])',
  );
  // First text input = reason, second = contact number
  const reasonInput = textInputs[0];
  fireEvent.change(reasonInput, { target: { value: "ธุระส่วนตัว" } });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LeaveRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLeaveRequest.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    renderForm();
    expect(screen.getByText("ส่งคำขอลา")).toBeInTheDocument();
  });

  it("shows submit button disabled when required fields are empty", () => {
    renderForm();
    const button = screen.getByRole("button", { name: /ส่งคำขอลา/ });
    expect(button).toBeDisabled();
  });

  it("shows validation error when submitting without required fields", () => {
    renderForm();
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    expect(screen.getByText("กรุณากรอกข้อมูลให้ครบถ้วน")).toBeInTheDocument();
  });

  it("calculates totalDays correctly from start and end dates", () => {
    renderForm();
    selectLeaveType("lt-2");
    const dateInputs = getDateInputs();
    fireEvent.change(dateInputs[0], { target: { value: "2026-06-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-06-03" } });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows maternity field when maternity type is selected", () => {
    renderForm();
    selectLeaveType("lt-3"); // ลาคลอด

    // Source has encoding corruption on first char, use partial match
    expect(screen.getByText(/คาดว่าจะคลอด/)).toBeInTheDocument();
  });

  it("shows vacation fields when vacation type is selected", () => {
    renderForm();
    selectLeaveType("lt-4"); // ลาพักผ่อน

    expect(screen.getByText("ข้อมูลเพิ่มเติมสำหรับลาพักผ่อน")).toBeInTheDocument();
    // "วันสะสมจากปีก่อน" has corrupted last char in source
    expect(screen.getByText(/วันสะสมจากปีก่อ/)).toBeInTheDocument();
    expect(screen.getByText("วันลาพักผ่อนประจำปี")).toBeInTheDocument();
    expect(screen.getByText("ความเห็นหัวหน้าสาขา")).toBeInTheDocument();
  });

  it("does NOT show maternity or vacation fields for sick leave", () => {
    renderForm();
    selectLeaveType("lt-1"); // ลาป่วย

    expect(screen.queryByText("วันที่คาดว่าจะคลอด")).not.toBeInTheDocument();
    expect(screen.queryByText("ข้อมูลเพิ่มเติมสำหรับลาพักผ่อน")).not.toBeInTheDocument();
  });

  it("calls createLeaveRequest on successful submit", async () => {
    renderForm();
    fillRequiredFields("lt-2");

    const button = screen.getByRole("button", { name: /ส่งคำขอลา/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreateLeaveRequest).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        leave_type_id: "lt-2",
        start_date: "2026-06-01",
        end_date: "2026-06-03",
        total_days: 3,
        reason: "ธุระส่วนตัว",
        submission_channel: "digital",
      }),
    );
  });

  it("displays error from server action failure", async () => {
    mockCreateLeaveRequest.mockRejectedValue(new Error("Server error: ไม่สามารถบันทึกได้"));

    renderForm();
    fillRequiredFields("lt-2");

    const button = screen.getByRole("button", { name: /ส่งคำขอลา/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Server error: ไม่สามารถบันทึกได้")).toBeInTheDocument();
    });
  });

  it("navigates to leaves list after successful submit", async () => {
    renderForm();
    fillRequiredFields("lt-2");

    const button = screen.getByRole("button", { name: /ส่งคำขอลา/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/leaves");
    });
  });
});

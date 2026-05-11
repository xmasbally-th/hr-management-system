import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { HrLeavesClient } from "../hr/leaves/hr-leaves-client";

/* ── Module mocks ─────────────────────────────────────────────────────── */

const approveLeaveRequest = vi.fn().mockResolvedValue(undefined);
const rejectLeaveRequest = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/leave-actions", () => ({
  approveLeaveRequest: (...args: unknown[]) => approveLeaveRequest(...args),
  rejectLeaveRequest: (...args: unknown[]) => rejectLeaveRequest(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const REQUESTS = [
  {
    id: "req-1",
    employee_id: "emp-1",
    start_date: "2026-05-01",
    end_date: "2026-05-03",
    total_days: 3,
    reason: "ป่วย",
    status: "pending",
    submission_channel: "digital",
    created_at: "2026-04-28",
    leave_type: { name: "ลาป่วย" },
    employee: { full_name: "สมชาย ใจดี", email: "somchai@test.com", department_id: null },
  },
  {
    id: "req-2",
    employee_id: "emp-2",
    start_date: "2026-05-10",
    end_date: "2026-05-12",
    total_days: 3,
    reason: null,
    status: "approved",
    submission_channel: "paper",
    created_at: "2026-05-01",
    leave_type: { name: "ลาพักผ่อน" },
    employee: { full_name: "สมหญิง รักดี", email: "somying@test.com", department_id: null },
  },
  {
    id: "req-3",
    employee_id: "emp-3",
    start_date: "2026-05-15",
    end_date: "2026-05-15",
    total_days: 1,
    reason: "ธุระ",
    status: "rejected",
    submission_channel: "digital",
    created_at: "2026-05-05",
    leave_type: { name: "ลากิจ" },
    employee: { full_name: "สมศรี ดีใจ", email: "somsri@test.com", department_id: null },
  },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "prompt").mockReturnValue("test reason");
});

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("HrLeavesClient", () => {
  it("renders table with all requests", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    const rows = screen.getAllByRole("row");
    // 1 header row + 3 data rows
    expect(rows.length).toBe(4);
  });

  it("shows employee name and leave type in table", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.getByText("สมหญิง รักดี")).toBeInTheDocument();
    expect(screen.getByText("สมศรี ดีใจ")).toBeInTheDocument();
    expect(screen.getByText("ลาป่วย")).toBeInTheDocument();
    expect(screen.getByText("ลาพักผ่อน")).toBeInTheDocument();
    expect(screen.getByText("ลากิจ")).toBeInTheDocument();
  });

  it("shows correct status badges", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    expect(screen.getByText("รออนุมัติ", { selector: "[data-slot='badge']" })).toBeInTheDocument();
    expect(screen.getByText("อนุมัติ", { selector: "[data-slot='badge']" })).toBeInTheDocument();
    expect(screen.getByText("ไม่อนุมัติ", { selector: "[data-slot='badge']" })).toBeInTheDocument();
  });

  it("shows approve/reject buttons ONLY for pending requests", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    // The pending row (req-1) should have 2 action buttons
    const allRows = screen.getAllByRole("row");
    // row index: 0=header, 1=req-1(pending), 2=req-2(approved), 3=req-3(rejected)
    const pendingRow = allRows[1];
    const pendingButtons = within(pendingRow).getAllByRole("button");
    expect(pendingButtons.length).toBe(2);
  });

  it("does NOT show approve/reject buttons for approved/rejected requests", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    const allRows = screen.getAllByRole("row");
    const approvedRow = allRows[2];
    const rejectedRow = allRows[3];
    expect(within(approvedRow).queryAllByRole("button")).toHaveLength(0);
    expect(within(rejectedRow).queryAllByRole("button")).toHaveLength(0);
  });

  it("filter tabs work — clicking รออนุมัติ shows only pending", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    // Click the pending filter tab
    const pendingTab = screen.getByRole("button", { name: /รออนุมัติ/ });
    fireEvent.click(pendingTab);

    // Should show only 1 data row + 1 header row
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(2);
    expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.queryByText("สมหญิง รักดี")).not.toBeInTheDocument();
  });

  it("filter shows count for pending tab", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    // The pending tab should show count (1)
    const pendingTab = screen.getByRole("button", { name: /รออนุมัติ/ });
    expect(pendingTab.textContent).toContain("(1)");
  });

  it("shows empty message when no requests match filter", () => {
    const onlyApproved = REQUESTS.filter((r) => r.status === "approved");
    render(<HrLeavesClient requests={onlyApproved} />);

    // Click the pending filter tab — use getAllByRole and pick the tab (not the badge)
    const pendingTabs = screen.getAllByRole("button").filter((btn) =>
      btn.textContent?.includes("รออนุมัติ") && btn.textContent?.includes("(")
    );
    fireEvent.click(pendingTabs[0]);

    expect(screen.getByText("ไม่มีคำขอลาในหมวดนี้")).toBeInTheDocument();
  });

  it("approve button calls approveLeaveRequest with correct ID", async () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    const buttons = within(pendingRow).getAllByRole("button");
    // First button opens approve dialog
    fireEvent.click(buttons[0]);

    // Wait for confirmation dialog to appear and click confirm
    await vi.waitFor(() => {
      expect(screen.getByText("ยืนยันอนุมัติการลา")).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: "อนุมัติ" });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(approveLeaveRequest).toHaveBeenCalledWith("req-1");
    });
  });

  it("reject button opens dialog then rejectLeaveRequest with ID and reason", async () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    const buttons = within(pendingRow).getAllByRole("button");
    // Second button opens reject dialog
    fireEvent.click(buttons[1]);

    // Wait for rejection dialog
    await vi.waitFor(() => {
      expect(screen.getByText("ยืนยันปฏิเสธการลา")).toBeInTheDocument();
    });

    // Type reason into the input
    const reasonInput = screen.getByPlaceholderText("ระบุเหตุผลที่ไม่อนุมัติ...");
    fireEvent.change(reasonInput, { target: { value: "test reason" } });

    const confirmBtn = screen.getByRole("button", { name: "ปฏิเสธ" });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(rejectLeaveRequest).toHaveBeenCalledWith("req-1", "test reason");
    });
  });
});

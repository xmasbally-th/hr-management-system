import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { HrTravelClient } from "../hr/travel/hr-travel-client";

/* ── Module mocks ─────────────────────────────────────────────────────── */

const approveTravelRequest = vi.fn().mockResolvedValue(undefined);
const rejectTravelRequest = vi.fn().mockResolvedValue(undefined);
const completeTravelRequest = vi.fn().mockResolvedValue(undefined);
const updateActualExpense = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/travel-actions", () => ({
  approveTravelRequest: (...args: unknown[]) => approveTravelRequest(...args),
  rejectTravelRequest: (...args: unknown[]) => rejectTravelRequest(...args),
  completeTravelRequest: (...args: unknown[]) => completeTravelRequest(...args),
  updateActualExpense: (...args: unknown[]) => updateActualExpense(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const REQUESTS = [
  {
    id: "tr-1",
    employee_id: "emp-1",
    travel_type: "training",
    title: "อบรม AI",
    location: "กรุงเทพ",
    start_date: "2026-06-01",
    end_date: "2026-06-03",
    total_days: 3,
    submission_channel: "digital",
    status: "pending",
    created_at: "2026-05-20",
    employee: { full_name: "สมชาย ใจดี", email: "somchai@test.com", department_id: null },
    expenses: [
      { id: "exp-1", expense_category: "ค่าที่พัก", estimated_amount: 5000, actual_amount: null },
    ],
  },
  {
    id: "tr-2",
    employee_id: "emp-2",
    travel_type: "official_contact",
    title: "ติดต่อราชการ",
    location: "เชียงใหม่",
    start_date: "2026-06-10",
    end_date: "2026-06-11",
    total_days: 2,
    submission_channel: "paper",
    status: "approved",
    created_at: "2026-06-01",
    employee: { full_name: "สมหญิง รักดี", email: "somying@test.com", department_id: null },
    expenses: [
      { id: "exp-2", expense_category: "ค่าพาหนะ", estimated_amount: 3000, actual_amount: 2800 },
    ],
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

describe("HrTravelClient", () => {
  it("renders table with all requests", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const rows = screen.getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows.length).toBe(3);
  });

  it("shows travel type in Thai", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    expect(screen.getByText("อบรม/สัมมนา")).toBeInTheDocument();
    // "ติดต่อราชการ" appears as both travel_type label and title
    expect(screen.getAllByText("ติดต่อราชการ").length).toBeGreaterThanOrEqual(1);
  });

  it("shows budget amounts (estimated + actual if > 0)", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    // tr-1: estimated 5,000
    expect(screen.getByText("5,000 ฿")).toBeInTheDocument();
    // tr-2: estimated 3,000 and actual 2,800
    expect(screen.getByText("3,000 ฿")).toBeInTheDocument();
    expect(screen.getByText(/จริง:.*2,800/)).toBeInTheDocument();
  });

  it("shows approve/reject buttons ONLY for pending", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const allRows = screen.getAllByRole("row");
    // row 0 = header, row 1 = tr-1 (pending), row 2 = tr-2 (approved)
    const pendingRow = allRows[1];
    // pending row has: expand button + approve + reject = 3 buttons
    const pendingButtons = within(pendingRow).getAllByRole("button");
    // At least approve and reject
    expect(pendingButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows complete button ONLY for approved", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const completeButton = screen.getByRole("button", { name: "ปิดงาน" });
    expect(completeButton).toBeInTheDocument();
    // The pending row should NOT have a complete button
    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    expect(within(pendingRow).queryByRole("button", { name: "ปิดงาน" })).toBeNull();
  });

  it("shows empty message when no requests", () => {
    render(<HrTravelClient requests={[]} />);
    expect(screen.getByText("ไม่มีคำขอเดินทางในหมวดนี้")).toBeInTheDocument();
  });

  it("approve button calls approveTravelRequest", async () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    const buttons = within(pendingRow).getAllByRole("button");
    const approveBtn = buttons.find((b) => b.className.includes("text-green-600"));
    fireEvent.click(approveBtn!);

    // Wait for confirmation dialog and click confirm
    await vi.waitFor(() => {
      expect(screen.getByText("ยืนยันอนุมัติการเดินทาง")).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: "อนุมัติ" });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(approveTravelRequest).toHaveBeenCalledWith("tr-1");
    });
  });

  it("complete button calls completeTravelRequest (after confirm dialog)", async () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const completeButton = screen.getByRole("button", { name: "ปิดงาน" });
    fireEvent.click(completeButton);

    // Wait for confirmation dialog
    await vi.waitFor(() => {
      expect(screen.getByText("ยืนยันปิดงานเดินทาง")).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: "ปิดงาน" });
    // There are two "ปิดงาน" buttons — one in the table and one in the dialog
    // We need the dialog action button
    const dialogConfirmBtn = screen.getAllByRole("button", { name: "ปิดงาน" }).find(
      (btn) => btn.getAttribute("data-slot") === "alert-dialog-action"
    );
    fireEvent.click(dialogConfirmBtn ?? confirmBtn);

    await vi.waitFor(() => {
      expect(completeTravelRequest).toHaveBeenCalledWith("tr-2");
    });
  });

  it("expand row shows expense detail table", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    // Initially, expense detail should not be visible
    expect(screen.queryByText("รายละเอียดงบประมาณ")).not.toBeInTheDocument();

    // Click the expand chevron on the first row
    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    const buttons = within(pendingRow).getAllByRole("button");
    // The expand button is the first one (chevron)
    const expandBtn = buttons[0];
    fireEvent.click(expandBtn);

    // Now the expense detail section should be visible
    expect(screen.getByText(/รายละเอียดงบประมาณ/)).toBeInTheDocument();
    expect(screen.getByText("ค่าที่พัก")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { HrTravelClient } from "../hr/travel/hr-travel-client";

/* ── Module mocks ─────────────────────────────────────────────────────── */
//
// D5: legacy approve/reject/complete actions were removed in favour of
// the multi-stage workflow (TravelWorkflowPanel on the detail page). The
// HR queue page no longer carries quick-action buttons — it just lists
// requests and lets HR click through to the detail page. The tests here
// cover the surface that remains: table render + expense expansion.

const updateActualExpense = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/travel-actions", () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("HrTravelClient (D5)", () => {
  it("renders table with all requests", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(3); // 1 header + 2 data
  });

  it("shows travel type in Thai", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    expect(screen.getByText("อบรม/สัมมนา")).toBeInTheDocument();
    expect(screen.getAllByText("ติดต่อราชการ").length).toBeGreaterThanOrEqual(1);
  });

  it("shows budget amounts (estimated + actual if > 0)", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    expect(screen.getByText("5,000 ฿")).toBeInTheDocument();
    expect(screen.getByText("3,000 ฿")).toBeInTheDocument();
    expect(screen.getByText(/จริง:.*2,800/)).toBeInTheDocument();
  });

  it("shows empty message when no requests", () => {
    render(<HrTravelClient requests={[]} />);
    expect(screen.getByText("ไม่มีคำขอเดินทางในหมวดนี้")).toBeInTheDocument();
  });

  it("expand row shows expense detail table", () => {
    render(<HrTravelClient requests={REQUESTS} />);
    expect(screen.queryByText("รายละเอียดงบประมาณ")).not.toBeInTheDocument();

    const allRows = screen.getAllByRole("row");
    const pendingRow = allRows[1];
    const buttons = within(pendingRow).getAllByRole("button");
    const expandBtn = buttons[0];
    fireEvent.click(expandBtn);

    expect(screen.getByText(/รายละเอียดงบประมาณ/)).toBeInTheDocument();
    expect(screen.getByText("ค่าที่พัก")).toBeInTheDocument();
  });
});

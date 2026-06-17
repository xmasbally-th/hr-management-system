import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TravelRequestTable } from "@/components/travel-request-table";

/*
 * TravelRequestTable is the unified read-only travel list used across the
 * travel hub (รอดำเนินการ / คำขอทั้งหมด tabs). Each row links to the travel
 * detail page; workflow actions happen there, not inline. HR/Admin (`canEdit`)
 * additionally get the .docx download + an expandable budget panel with
 * inline actual-expense editing — that behaviour moved here from the former
 * HrTravelClient.
 */

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
    employee: { full_name: "สมชาย ใจดี", email: "somchai@test.com", position_title: "อาจารย์" },
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
    employee: { full_name: "สมหญิง รักดี", email: "somying@test.com", position_title: "เจ้าหน้าที่" },
    expenses: [
      { id: "exp-2", expense_category: "ค่าพาหนะ", estimated_amount: 3000, actual_amount: 2800 },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("TravelRequestTable", () => {
  it("renders one row per request", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(3); // 1 header + 2 data
  });

  it("shows travel type in Thai", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    expect(screen.getByText("อบรม/สัมมนา")).toBeInTheDocument();
    expect(screen.getAllByText("ติดต่อราชการ").length).toBeGreaterThanOrEqual(1);
  });

  it("shows budget amounts (estimated + actual if > 0)", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    expect(screen.getByText("5,000 ฿")).toBeInTheDocument();
    expect(screen.getByText("3,000 ฿")).toBeInTheDocument();
    expect(screen.getByText(/จริง:.*2,800/)).toBeInTheDocument();
  });

  it("shows status badges that spell out who the request waits on", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    expect(screen.getByText("รอ HR ตรวจสอบ/ส่งลงนาม")).toBeInTheDocument();
    expect(screen.getByText("คณบดีลงนามแล้ว — รอ HR ส่งมหาวิทยาลัย")).toBeInTheDocument();
  });

  it("renders one 'ดูรายละเอียด' action per row", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    expect(screen.getAllByText("ดูรายละเอียด")).toHaveLength(2);
  });

  it("shows the empty message when no requests", () => {
    render(<TravelRequestTable requests={[]} emptyText="ไม่มีคำขอเดินทางในรอบนี้" />);
    expect(screen.getByText("ไม่มีคำขอเดินทางในรอบนี้")).toBeInTheDocument();
  });

  it("expand row shows expense detail table", () => {
    render(<TravelRequestTable requests={REQUESTS} />);
    expect(screen.queryByText(/รายละเอียดงบประมาณ/)).not.toBeInTheDocument();

    const pendingRow = screen.getAllByRole("row")[1];
    const expandBtn = within(pendingRow).getAllByRole("button")[0];
    fireEvent.click(expandBtn);

    expect(screen.getByText(/รายละเอียดงบประมาณ/)).toBeInTheDocument();
    expect(screen.getByText("ค่าที่พัก")).toBeInTheDocument();
  });
});

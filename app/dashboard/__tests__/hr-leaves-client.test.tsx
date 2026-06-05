import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HrLeavesClient } from "../hr/leaves/hr-leaves-client";

/*
 * HrLeavesClient is a read-only table used by the approvals/leaves queue.
 * Each row links to the leave detail page ("เดินเอกสาร"); approve/reject
 * is performed there, not inline — so this suite only covers rendering.
 */

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
    expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByText("อนุมัติ")).toBeInTheDocument();
    expect(screen.getByText("ไม่อนุมัติ")).toBeInTheDocument();
  });

  it("renders one 'เดินเอกสาร' action per row, regardless of status", () => {
    render(<HrLeavesClient requests={REQUESTS} />);
    const dataRows = screen.getAllByRole("row").slice(1); // drop header
    for (const row of dataRows) {
      expect(within(row).getAllByRole("button")).toHaveLength(1);
    }
    expect(screen.getAllByText("เดินเอกสาร")).toHaveLength(3);
  });

  it("shows empty message when no requests", () => {
    render(<HrLeavesClient requests={[]} />);
    expect(screen.getByText("ไม่มีคำขอลาในหมวดนี้")).toBeInTheDocument();
  });
});

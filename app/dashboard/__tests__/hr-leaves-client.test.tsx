import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaveRequestTable } from "@/components/leave-request-table";

/*
 * LeaveRequestTable is the unified read-only leave list used across the
 * leave hub (รอดำเนินการ / คำขอทั้งหมด tabs). Each row links to the leave
 * detail page ("เดินเอกสาร"); approve/reject happens there, not inline —
 * so this suite only covers rendering.
 */

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const REQUESTS = [
  {
    id: "req-1",
    employee_id: "emp-1",
    start_date: "2026-05-01",
    end_date: "2026-05-03",
    total_days: 3,
    working_days: 3,
    status: "pending",
    submission_channel: "digital",
    medical_cert_url: null,
    leave_type_id: "lt-1",
    leave_type: { name: "ลาป่วย", code: "SICK" },
    employee: { full_name: "สมชาย ใจดี", email: "somchai@test.com", position_title: "อาจารย์" },
  },
  {
    id: "req-2",
    employee_id: "emp-2",
    start_date: "2026-05-10",
    end_date: "2026-05-12",
    total_days: 3,
    working_days: 3,
    status: "approved",
    submission_channel: "paper",
    medical_cert_url: null,
    leave_type_id: "lt-2",
    leave_type: { name: "ลาพักผ่อน", code: "VACATION" },
    employee: { full_name: "สมหญิง รักดี", email: "somying@test.com", position_title: "เจ้าหน้าที่" },
  },
  {
    id: "req-3",
    employee_id: "emp-3",
    start_date: "2026-05-15",
    end_date: "2026-05-15",
    total_days: 1,
    working_days: 1,
    status: "rejected",
    submission_channel: "digital",
    medical_cert_url: null,
    leave_type_id: "lt-3",
    leave_type: { name: "ลากิจ", code: "PERSONAL" },
    employee: { full_name: "สมศรี ดีใจ", email: "somsri@test.com", position_title: "อาจารย์" },
  },
];

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("LeaveRequestTable", () => {
  it("renders one row per request", () => {
    render(<LeaveRequestTable requests={REQUESTS} />);
    const rows = screen.getAllByRole("row");
    // 1 header row + 3 data rows
    expect(rows.length).toBe(4);
  });

  it("shows employee name and leave type", () => {
    render(<LeaveRequestTable requests={REQUESTS} />);
    expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.getByText("สมหญิง รักดี")).toBeInTheDocument();
    expect(screen.getByText("สมศรี ดีใจ")).toBeInTheDocument();
    expect(screen.getByText("ลาป่วย")).toBeInTheDocument();
    expect(screen.getByText("ลาพักผ่อน")).toBeInTheDocument();
    expect(screen.getByText("ลากิจ")).toBeInTheDocument();
  });

  it("shows correct status badges", () => {
    render(<LeaveRequestTable requests={REQUESTS} />);
    expect(screen.getByText("รอ HR ตรวจสอบ/ส่งลงนาม")).toBeInTheDocument();
    expect(screen.getByText("คณบดีลงนามแล้ว — รอ HR ส่งมหาวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("ไม่อนุมัติ")).toBeInTheDocument();
  });

  it("renders one 'ดูรายละเอียด' action per row, regardless of status", () => {
    render(<LeaveRequestTable requests={REQUESTS} />);
    expect(screen.getAllByText("ดูรายละเอียด")).toHaveLength(3);
  });

  it("shows the empty message when no requests", () => {
    render(<LeaveRequestTable requests={[]} emptyText="ไม่มีคำขอลาในรอบนี้" />);
    expect(screen.getByText("ไม่มีคำขอลาในรอบนี้")).toBeInTheDocument();
  });
});

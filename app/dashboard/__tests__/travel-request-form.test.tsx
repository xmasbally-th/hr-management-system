import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TravelRequestForm } from "../travel/new/travel-request-form";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: vi.fn() })),
}));

const mockCreateTravelRequest = vi.fn();
vi.mock("@/lib/actions/travel-actions", () => ({
  createTravelRequest: (...args: unknown[]) => mockCreateTravelRequest(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock ThaiDatePicker as a native <input type="date"> — its public contract is
// ISO YYYY-MM-DD in/out, so tests drive it like a native date input.
vi.mock("@/components/ui/thai-date-picker", () => ({
  ThaiDatePicker: ({ value, onChange, disabled, id }: any) => (
    <input
      type="date"
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e: any) => onChange(e.target.value)}
    />
  ),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockCreateTravelRequest.mockReset();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TravelRequestForm (3-tab redesign)", () => {
  it("renders the details tab by default", () => {
    render(<TravelRequestForm />);
    expect(screen.getByText("รายละเอียดการเดินทาง")).toBeTruthy();
    expect(screen.getByText("อบรม/สัมมนา")).toBeTruthy();
    expect(screen.getByText("นิเทศนักศึกษา")).toBeTruthy();
    expect(screen.getByText("ติดต่อราชการ")).toBeTruthy();
  });

  it("blocks advancing to budget when details are incomplete", () => {
    render(<TravelRequestForm />);
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));
    expect(
      screen.getByText(/กรุณากรอกรายละเอียดการเดินทางให้ครบถ้วน/),
    ).toBeTruthy();
  });

  it("advances to budget tab once details are complete", () => {
    render(<TravelRequestForm />);

    // Click "อบรม/สัมมนา" travel type card
    fireEvent.click(screen.getByText("อบรม/สัมมนา").closest("button")!);

    const inputs = document.querySelectorAll<HTMLInputElement>("input");
    // 0=title, 1=location, 2=startDate, 3=endDate
    fireEvent.change(inputs[0], { target: { value: "อบรมหลักสูตร X" } });
    fireEvent.change(inputs[1], { target: { value: "เชียงใหม่" } });
    fireEvent.change(inputs[2], { target: { value: "2026-06-01" } });
    fireEvent.change(inputs[3], { target: { value: "2026-06-03" } });

    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ }));

    expect(screen.getByText("ค่าลงทะเบียน")).toBeTruthy();
    expect(screen.getByText(/รวมงบประมาณ/)).toBeTruthy();
  });

  it("blocks advancing to channel without any budget", () => {
    render(<TravelRequestForm />);

    // Complete details first
    fireEvent.click(screen.getByText("อบรม/สัมมนา").closest("button")!);
    const inputs = document.querySelectorAll<HTMLInputElement>("input");
    fireEvent.change(inputs[0], { target: { value: "เรื่อง" } });
    fireEvent.change(inputs[1], { target: { value: "สถานที่" } });
    fireEvent.change(inputs[2], { target: { value: "2026-06-01" } });
    fireEvent.change(inputs[3], { target: { value: "2026-06-03" } });

    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ })); // -> budget
    fireEvent.click(screen.getByRole("button", { name: /ถัดไป/ })); // try -> channel

    expect(
      screen.getByText(/กรุณากรอกประมาณการค่าใช้จ่ายอย่างน้อย 1 หมวด/),
    ).toBeTruthy();
  });
});

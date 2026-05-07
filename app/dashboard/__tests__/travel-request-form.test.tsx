import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TravelRequestForm } from "../travel/new/travel-request-form";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: mockBack })),
}));

const mockCreateTravelRequest = vi.fn();
vi.mock("@/lib/actions/travel-actions", () => ({
  createTravelRequest: (...args: unknown[]) => mockCreateTravelRequest(...args),
}));

// Mock Shadcn Select as native <select>.
vi.mock("@/components/ui/select", () => {
  const callbacks = new Map<number, (v: string) => void>();
  let counter = 0;

  return {
    Select: ({ children, value, onValueChange }: any) => {
      const id = ++counter;
      callbacks.set(id, onValueChange);
      return <div data-select-id={id}>{children}</div>;
    },
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => {
      return (
        <select
          data-testid="mock-select"
          onChange={(e: any) => {
            const parent = e.target.closest("[data-select-id]");
            const id = parent ? Number(parent.getAttribute("data-select-id")) : 0;
            const cb = callbacks.get(id);
            cb?.(e.target.value);
          }}
        >
          <option value="">--</option>
          {children}
        </select>
      );
    },
    SelectItem: ({ children, value }: any) => (
      <option value={value}>{children}</option>
    ),
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderForm() {
  return render(<TravelRequestForm />);
}

function getDateInputs() {
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]');
}

function selectTravelType(value: string) {
  const selects = screen.getAllByTestId("mock-select");
  fireEvent.change(selects[0], { target: { value } });
}

function fillRequiredFields() {
  selectTravelType("training");

  const titleInput = screen.getByPlaceholderText(/อบรมหลักสูตร/);
  fireEvent.change(titleInput, { target: { value: "อบรม React" } });

  const locationInput = screen.getByPlaceholderText(/โรงแรม/);
  fireEvent.change(locationInput, { target: { value: "กรุงเทพฯ" } });

  const dateInputs = getDateInputs();
  fireEvent.change(dateInputs[0], { target: { value: "2026-07-01" } });
  fireEvent.change(dateInputs[1], { target: { value: "2026-07-03" } });
}

/** Find all trash/remove buttons. */
function getRemoveButtons(): HTMLButtonElement[] {
  const allButtons = document.querySelectorAll<HTMLButtonElement>("button[type='button']");
  return Array.from(allButtons).filter(
    (btn) => !btn.textContent?.includes("เพิ่มรายการ"),
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TravelRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTravelRequest.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    renderForm();
    expect(screen.getByText("ส่งคำขอเดินทาง")).toBeInTheDocument();
  });

  it("shows submit button disabled when required fields are empty", () => {
    renderForm();
    const button = screen.getByRole("button", { name: /ส่งคำขอเดินทาง/ });
    expect(button).toBeDisabled();
  });

  it("shows validation error when submitting without required fields", () => {
    renderForm();
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    expect(screen.getByText("กรุณากรอกข้อมูลให้ครบถ้วน")).toBeInTheDocument();
  });

  it("starts with one expense row", () => {
    renderForm();
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    expect(amountInputs).toHaveLength(1);
  });

  it("adds a new expense row when clicking the add button", () => {
    renderForm();
    const addBtn = screen.getByRole("button", { name: /เพิ่มรายการ/ });
    fireEvent.click(addBtn);

    const amountInputs = screen.getAllByPlaceholderText("0.00");
    expect(amountInputs).toHaveLength(2);
  });

  it("does not allow removing the last expense row", () => {
    renderForm();
    const removeButtons = getRemoveButtons();
    expect(removeButtons.length).toBe(1);
    expect(removeButtons[0]).toBeDisabled();
  });

  it("removes an expense row when there are multiple rows", () => {
    renderForm();

    const addBtn = screen.getByRole("button", { name: /เพิ่มรายการ/ });
    fireEvent.click(addBtn);
    expect(screen.getAllByPlaceholderText("0.00")).toHaveLength(2);

    const removeButtons = getRemoveButtons();
    const enabledBtn = removeButtons.find((b) => !b.disabled);
    expect(enabledBtn).toBeTruthy();
    fireEvent.click(enabledBtn!);

    expect(screen.getAllByPlaceholderText("0.00")).toHaveLength(1);
  });

  it("calculates totalBudget from expense amounts", () => {
    renderForm();

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "1500" } });

    const addBtn = screen.getByRole("button", { name: /เพิ่มรายการ/ });
    fireEvent.click(addBtn);
    const amountInputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[1], { target: { value: "2500" } });

    expect(screen.getByText(/4,000/)).toBeInTheDocument();
  });

  it("calls createTravelRequest on successful submit", async () => {
    renderForm();
    fillRequiredFields();

    const button = screen.getByRole("button", { name: /ส่งคำขอเดินทาง/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreateTravelRequest).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateTravelRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        travel_type: "training",
        title: "อบรม React",
        location: "กรุงเทพฯ",
        start_date: "2026-07-01",
        end_date: "2026-07-03",
        total_days: 3,
        submission_channel: "digital",
      }),
    );
  });

  it("displays error from server action failure", async () => {
    mockCreateTravelRequest.mockRejectedValue(
      new Error("Server error: ไม่สามารถบันทึกได้"),
    );

    renderForm();
    fillRequiredFields();

    const button = screen.getByRole("button", { name: /ส่งคำขอเดินทาง/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("Server error: ไม่สามารถบันทึกได้"),
      ).toBeInTheDocument();
    });
  });

  it("navigates to travel list after successful submit", async () => {
    renderForm();
    fillRequiredFields();

    const button = screen.getByRole("button", { name: /ส่งคำขอเดินทาง/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/travel");
    });
  });
});

import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThaiDatePicker } from "../thai-date-picker";

// base-ui's Popover relies on browser APIs jsdom doesn't implement. Polyfill the
// minimum needed so the calendar popup can mount when opened.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe("ThaiDatePicker", () => {
  it("renders the selected ISO date as a Buddhist-era label on the trigger", () => {
    render(<ThaiDatePicker value="2026-06-15" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("15 มิ.ย. 2569");
  });

  it("renders the placeholder when no value is set", () => {
    render(<ThaiDatePicker value="" onChange={() => {}} placeholder="เลือกวันที่" />);
    expect(screen.getByRole("button")).toHaveTextContent("เลือกวันที่");
  });

  it("shows a B.E. label even for distant (birthdate-style) dates", () => {
    render(<ThaiDatePicker value="1967-03-05" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("5 มี.ค. 2510");
  });

  it("disables the trigger when disabled", () => {
    render(<ThaiDatePicker value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("opens a พ.ศ. calendar and emits an ISO (ค.ศ.) string on day click", async () => {
    const onChange = vi.fn();
    render(<ThaiDatePicker value="2026-06-15" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    // Calendar grid is labelled with the Thai month + Buddhist year.
    const grid = await screen.findByRole("grid", { name: "มิถุนายน 2569" });
    expect(grid).toBeTruthy();

    // Day cells expose a full Thai date as their accessible name.
    const day20 = await screen.findByRole("gridcell", { name: "20 มิถุนายน 2569" });
    fireEvent.click(day20);

    // Value emitted back to the form stays ISO Gregorian.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-06-20"));
  });

  it("navigates day → month → year views and emits the drilled date", async () => {
    const onChange = vi.fn();
    render(<ThaiDatePicker value="2026-06-15" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));

    // Click the header title to drill day → month, then month → year.
    fireEvent.click(await screen.findByText("มิถุนายน 2569"));
    fireEvent.click(await screen.findByText("2569")); // now in year (decade) view

    // Pick a year, then a month, then a day.
    fireEvent.click(await screen.findByRole("button", { name: "พ.ศ. 2569" }));
    fireEvent.click(await screen.findByRole("button", { name: "มีนาคม 2569" }));
    fireEvent.click(await screen.findByRole("gridcell", { name: "5 มีนาคม 2569" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-05"));
  });
});

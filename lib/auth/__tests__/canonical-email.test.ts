import { describe, it, expect } from "vitest";
import { toCanonicalAuthEmail } from "../canonical-email";

describe("toCanonicalAuthEmail", () => {
  it("folds the Microsoft domain onto the Google domain", () => {
    expect(toCanonicalAuthEmail("john@lpru.ac.th")).toBe("john@g.lpru.ac.th");
  });

  it("leaves the Google domain unchanged", () => {
    expect(toCanonicalAuthEmail("john@g.lpru.ac.th")).toBe("john@g.lpru.ac.th");
  });

  it("preserves the full local-part (dots, plus, etc.)", () => {
    expect(toCanonicalAuthEmail("first.last+x@lpru.ac.th")).toBe(
      "first.last+x@g.lpru.ac.th",
    );
  });

  it("lower-cases and trims", () => {
    expect(toCanonicalAuthEmail("  John@LPRU.AC.TH  ")).toBe(
      "john@g.lpru.ac.th",
    );
  });

  it("passes through unrelated domains so the backend can reject them", () => {
    expect(toCanonicalAuthEmail("someone@gmail.com")).toBe("someone@gmail.com");
  });

  it("does not touch an already-prefixed g.lpru subdomain match", () => {
    // Guard against accidentally rewriting g.lpru.ac.th (it is not the
    // Microsoft domain, so it stays as-is).
    expect(toCanonicalAuthEmail("a@g.lpru.ac.th")).toBe("a@g.lpru.ac.th");
  });

  it("handles empty / malformed input gracefully", () => {
    expect(toCanonicalAuthEmail("")).toBe("");
    expect(toCanonicalAuthEmail(null)).toBe("");
    expect(toCanonicalAuthEmail("no-at-sign")).toBe("no-at-sign");
  });
});

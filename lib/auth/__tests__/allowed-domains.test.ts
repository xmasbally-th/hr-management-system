import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAllowedDomains,
  isEmailAllowed,
  getSingleHostedDomain,
} from "../allowed-domains";

const ENV = "NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS";

describe("allowed-domains", () => {
  const original = process.env[ENV];

  beforeEach(() => {
    delete process.env[ENV];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV];
    else process.env[ENV] = original;
  });

  describe("getAllowedDomains()", () => {
    it("returns [] when env var is unset", () => {
      expect(getAllowedDomains()).toEqual([]);
    });

    it("returns [] when env var is empty/whitespace", () => {
      process.env[ENV] = "   ";
      expect(getAllowedDomains()).toEqual([]);
    });

    it("parses single domain", () => {
      process.env[ENV] = "g.lpru.ac.th";
      expect(getAllowedDomains()).toEqual(["g.lpru.ac.th"]);
    });

    it("parses comma-separated domains and trims whitespace", () => {
      process.env[ENV] = " g.lpru.ac.th , lpru.ac.th ";
      expect(getAllowedDomains()).toEqual(["g.lpru.ac.th", "lpru.ac.th"]);
    });

    it("dedupes and lowercases", () => {
      process.env[ENV] = "G.LPRU.AC.TH,g.lpru.ac.th,Lpru.AC.th";
      expect(getAllowedDomains()).toEqual(["g.lpru.ac.th", "lpru.ac.th"]);
    });
  });

  describe("isEmailAllowed()", () => {
    it("returns false for empty/null/undefined", () => {
      expect(isEmailAllowed("")).toBe(false);
      expect(isEmailAllowed(null)).toBe(false);
      expect(isEmailAllowed(undefined)).toBe(false);
    });

    it("returns true for any email when allowlist is empty (check disabled)", () => {
      expect(isEmailAllowed("anyone@gmail.com")).toBe(true);
      expect(isEmailAllowed("foo@example.org")).toBe(true);
    });

    it("returns true for an allowed domain (case-insensitive)", () => {
      process.env[ENV] = "g.lpru.ac.th";
      expect(isEmailAllowed("user@g.lpru.ac.th")).toBe(true);
      expect(isEmailAllowed("user@G.LPRU.AC.TH")).toBe(true);
      expect(isEmailAllowed("User.Name@g.LPru.ac.TH")).toBe(true);
    });

    it("returns false for a disallowed domain", () => {
      process.env[ENV] = "g.lpru.ac.th";
      expect(isEmailAllowed("user@gmail.com")).toBe(false);
      expect(isEmailAllowed("user@other.ac.th")).toBe(false);
    });

    it("matches against any domain in a multi-domain list", () => {
      process.env[ENV] = "g.lpru.ac.th,lpru.ac.th";
      expect(isEmailAllowed("user@g.lpru.ac.th")).toBe(true);
      expect(isEmailAllowed("user@lpru.ac.th")).toBe(true);
      expect(isEmailAllowed("user@other.com")).toBe(false);
    });

    it("returns false for malformed emails (no @)", () => {
      process.env[ENV] = "g.lpru.ac.th";
      expect(isEmailAllowed("not-an-email")).toBe(false);
    });

    it("matches against the last @ to be defensive", () => {
      // Pathological email — Supabase wouldn't accept this but worth covering
      process.env[ENV] = "g.lpru.ac.th";
      expect(isEmailAllowed("a@b@g.lpru.ac.th")).toBe(true);
    });
  });

  describe("getSingleHostedDomain()", () => {
    it("returns null when allowlist is empty", () => {
      expect(getSingleHostedDomain()).toBeNull();
    });

    it("returns the single domain", () => {
      process.env[ENV] = "g.lpru.ac.th";
      expect(getSingleHostedDomain()).toBe("g.lpru.ac.th");
    });

    it("returns null when multiple domains configured", () => {
      process.env[ENV] = "g.lpru.ac.th,lpru.ac.th";
      expect(getSingleHostedDomain()).toBeNull();
    });
  });
});

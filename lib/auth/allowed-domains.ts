/**
 * Email domain allowlist for sign-in.
 *
 * Reads NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS (comma-separated list).
 * - Empty/unset → check disabled (any email allowed; useful for local dev)
 * - One or more domains → only those domains may sign in
 *
 * The value is NEXT_PUBLIC_ so both server and client can use it.
 */

const ENV_VAR = "NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS";

/**
 * Parsed list of allowed domains (lowercased, trimmed, deduped).
 * Returns [] when no allowlist is configured.
 */
export function getAllowedDomains(): string[] {
  const raw = process.env[ENV_VAR] ?? "";
  if (!raw.trim()) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const d = part.trim().toLowerCase();
    if (d) out.add(d);
  }
  return [...out];
}

/**
 * Returns true when an email is allowed to sign in.
 *
 * When the allowlist is empty (no env var configured), every email passes
 * — this is intentional for local development. In production set the env
 * variable to enforce the restriction.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domains = getAllowedDomains();
  if (domains.length === 0) return true; // check disabled
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domains.includes(domain);
}

/**
 * Returns the single domain when exactly one is configured.
 * Used for the Google OAuth `hd` (hosted-domain) hint — only useful when
 * the org has a single domain. Returns null otherwise.
 */
export function getSingleHostedDomain(): string | null {
  const domains = getAllowedDomains();
  return domains.length === 1 ? domains[0] : null;
}

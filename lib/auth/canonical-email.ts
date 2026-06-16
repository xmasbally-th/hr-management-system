/**
 * Canonical auth-email mapping.
 *
 * Every user at the organization owns two mailboxes that share the SAME
 * local-part:
 *   - Google Workspace:   name@g.lpru.ac.th   (used by Google SSO)
 *   - Microsoft/Outlook:  name@lpru.ac.th     (used by some who can't access Google)
 *
 * Supabase auth keys every account off the Google form (`@g.lpru.ac.th`) so a
 * single account works with BOTH Google SSO and email+password. This helper
 * folds the Microsoft form onto the Google form, letting a user type whichever
 * address they know at the password login form and still land on the one
 * account.
 *
 * Password auth is pure Supabase — it never contacts Google — so this works
 * even when the user's actual Google account is broken/inaccessible.
 */

const MICROSOFT_DOMAIN = "lpru.ac.th";
const GOOGLE_DOMAIN = "g.lpru.ac.th";

/**
 * Returns the canonical (`@g.lpru.ac.th`) form of an email used as the Supabase
 * auth identifier. Lower-cases and trims. Non-org domains pass through
 * unchanged so the backend allowlist can still reject them.
 */
export function toCanonicalAuthEmail(raw: string | null | undefined): string {
  const email = (raw ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain === MICROSOFT_DOMAIN) return `${local}@${GOOGLE_DOMAIN}`;
  return email;
}

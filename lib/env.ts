/**
 * Server-side environment variable validation.
 * Uses lazy getters — validated on first access, not at import time.
 * This prevents test failures while still failing fast in production.
 *
 * NOTE: Do NOT use this in client components — NEXT_PUBLIC_* vars
 * are inlined at build time for the browser bundle.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please check your .env.local or Vercel environment settings.`
    );
  }
  return value;
}

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL(): string {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY(): string {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  /**
   * Comma-separated list of email domains allowed to sign in (e.g. "g.lpru.ac.th").
   * Empty/unset disables the check (any Google account can sign in).
   * NEXT_PUBLIC_ so the login page can use it for the Google `hd` hint.
   */
  get NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS(): string {
    return process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "";
  },
} as const;

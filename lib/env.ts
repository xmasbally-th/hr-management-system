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
} as const;

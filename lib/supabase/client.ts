import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Creates a Supabase client for use in Client Components ('use client').
 *
 * The browser client automatically uses `document.cookie` for cookie
 * management and is a singleton by default — calling this function
 * multiple times returns the same instance.
 *
 * Use this client for:
 * - Client-side auth (sign in, sign up, sign out)
 * - Real-time subscriptions
 * - Client-side data fetching triggered by user interaction
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

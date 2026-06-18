import { cache } from "react";
import { createClient } from "./server";

/**
 * Returns the authenticated Supabase user, memoized for the duration of a
 * single React server render. Multiple server actions called from the same
 * page share this result without extra network round-trips to Supabase Auth.
 *
 * Safe to call multiple times — only the first call goes to the network.
 * Each new request gets a fresh cache (React's `cache()` scope = one render).
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
});

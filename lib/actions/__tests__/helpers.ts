/**
 * Shared test helpers — Supabase mock factory.
 *
 * Every server action calls `createClient()` then chains query-builder
 * methods like `.from("table").select("*").eq("col", val).single()`.
 * We build a chainable mock that records the calls and returns
 * configurable data/error at the terminal method.
 */
import { vi } from "vitest";

/* ---------- chain builder ------------------------------------------------ */

export interface MockChainConfig {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

/**
 * Creates a chainable mock that mirrors the Supabase query builder.
 * Every method returns `this` (chainable) except terminal methods
 * (`.single()`, `.limit()`, terminal `.select()` on update/delete)
 * which resolve `{ data, error, count }`.
 */
export function createMockChain(config: MockChainConfig = {}) {
  const result = {
    data: config.data ?? null,
    error: config.error ?? null,
    count: config.count ?? null,
  };

  const chain: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "in",
    "or",
    "gte",
    "lte",
    "gt",
    "lt",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
    "filter",
    "not",
    "is",
    "match",
    "textSearch",
    "csv",
    "head",
  ];

  for (const m of chainMethods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // Terminal methods that resolve the result
  chain.single = vi.fn().mockReturnValue({ ...result });
  chain.maybeSingle = vi.fn().mockReturnValue({ ...result });

  // Non-terminal `.limit()` / `.order()` still chainable but
  // the "bare await" (no `.single()`) should also resolve
  // We make the chain thenable so `await supabase.from(...).select(...)` works.
  (chain as Record<string, unknown>).then = (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void,
  ) => {
    try {
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
    }
  };

  return chain;
}

/* ---------- supabase client mock ----------------------------------------- */

export interface MockClientOverrides {
  /** Override `.from(table)` per table name */
  fromOverrides?: Record<string, ReturnType<typeof createMockChain>>;
  /** Default chain config when no override matches */
  defaultChain?: MockChainConfig;
  /** Auth user — null means unauthenticated */
  authUser?: { id: string; email?: string } | null;
  /** Override auth.admin methods */
  authAdmin?: {
    createUser?: MockChainConfig;
    deleteUser?: MockChainConfig;
  };
}

export function createMockSupabase(overrides: MockClientOverrides = {}) {
  const defaultChain = createMockChain(overrides.defaultChain ?? { data: null, error: null });

  const fromFn = vi.fn((table: string) => {
    if (overrides.fromOverrides?.[table]) {
      return overrides.fromOverrides[table];
    }
    return defaultChain;
  });

  const authUser = overrides.authUser === undefined
    ? { id: "user-1", email: "test@example.com" }
    : overrides.authUser;

  const supabase = {
    from: fromFn,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
      }),
      admin: {
        createUser: vi.fn().mockResolvedValue(
          overrides.authAdmin?.createUser
            ? {
                data: { user: overrides.authAdmin.createUser.data },
                error: overrides.authAdmin.createUser.error ?? null,
              }
            : { data: { user: { id: "new-user-1" } }, error: null }
        ),
        deleteUser: vi.fn().mockResolvedValue(
          overrides.authAdmin?.deleteUser
            ? { data: overrides.authAdmin.deleteUser.data, error: overrides.authAdmin.deleteUser.error }
            : { data: null, error: null }
        ),
      },
    },
  };

  return supabase;
}

/* ---------- module mocks ------------------------------------------------- */

/**
 * Call in `beforeEach` — sets up vi.mock for createClient + revalidatePath.
 * Returns a getter so tests can access the current supabase mock.
 */
export function setupActionMocks() {
  let currentSupabase: ReturnType<typeof createMockSupabase>;

  return {
    /** Set the supabase mock for the current test and mock createClient to return it */
    setSupabase(overrides: MockClientOverrides = {}) {
      currentSupabase = createMockSupabase(overrides);
      vi.mocked(createClientMock).mockResolvedValue(currentSupabase as never);
      return currentSupabase;
    },
    getSupabase() {
      return currentSupabase;
    },
  };
}

// Placeholder — actual mock wiring is done per-test file via vi.mock
let createClientMock: () => Promise<unknown>;
export function setCreateClientRef(ref: () => Promise<unknown>) {
  createClientMock = ref;
}

/* ---------- common test data --------------------------------------------- */

export const TEST_USER = { id: "user-1", email: "test@example.com" };
export const TEST_HR_USER = { id: "hr-1", email: "hr@example.com" };
export const TEST_ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

export const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
export const INVALID_UUID = "not-a-uuid";

export function profileRow(role: string, status = "approved") {
  return { role, status };
}

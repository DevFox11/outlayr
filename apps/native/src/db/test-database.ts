import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { SpendDb } from "@/data/budget-spent";
import type { Database } from "@/db/client";

/**
 * Wraps an in-memory better-sqlite3 handle as the app's {@link Database}.
 *
 * Test-only. The app opens SQLite through `drizzle-orm/expo-sqlite`; tests run
 * on node and open it through `drizzle-orm/better-sqlite3`. The two drivers
 * expose the same query builders but drizzle declares them as unrelated types,
 * so bridging them needs an assertion with no overlap to narrow through. This
 * is the one place in the tree that makes it — callers build their own schema
 * with `sqlite.exec(...)` first and pass the handle in.
 */
// oxlint-disable-next-line anti-slop/no-chained-type-assertions -- the two drizzle drivers share no declared members, so there is no intermediate type to step through
export const testDatabase = (sqlite: BetterSqlite3.Database): Database => drizzle(sqlite) as unknown as Database;

/**
 * The same bridge for {@link SpendDb}, the narrower read-only view the budget
 * and rate queries take. See {@link testDatabase} for why the assertion exists.
 */
// oxlint-disable-next-line anti-slop/no-chained-type-assertions -- as above: better-sqlite3's database type and the schema-bound SpendDb overlap in no declared member
export const testSpendDb = (sqlite: BetterSqlite3.Database): SpendDb => drizzle(sqlite) as unknown as SpendDb;

/**
 * A stand-in {@link Database} for a suite that mocks `useDatabase` but never
 * queries through it — the component under test only forwards the handle, and
 * the assertion is on what it was forwarded to.
 *
 * Deliberately inert rather than a throwing stub: the handle reaches jest
 * matchers (`expect.anything()` probes it for `asymmetricMatch`), so a stub that
 * threw on unknown property reads would fail the assertion instead of the call.
 */
// SAFETY: an empty object declares none of Database's members; this exists precisely for the suites that touch none of them.
export const unusedDatabase = (): Database => ({}) as Database;

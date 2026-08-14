import type { Database } from "./client";

/**
 * Runs `task` inside a single SQLite transaction, so a multi-statement write
 * either lands whole or not at all.
 *
 * Drizzle's own `db.transaction()` must NOT be used here. The expo-sqlite driver
 * builds it in `"sync"` mode and issues `commit` immediately after invoking the
 * callback, without awaiting it (`drizzle-orm/expo-sqlite/session.js:31-42`), so
 * handing it an async function commits an empty transaction and then runs every
 * statement outside the boundary — strictly worse than no transaction, because
 * the call site looks protected.
 *
 * `withExclusiveTransactionAsync` is the stronger primitive but opens a separate
 * connection, which this Drizzle client does not use, so statements built from
 * `db` would land outside the transaction. `withTransactionAsync` shares the
 * connection, so Drizzle writes are enclosed. Its documented tradeoff is that
 * concurrent async queries can interleave, which is acceptable for the short,
 * user-initiated writes this wraps.
 *
 * The import above is type-only on purpose: `-core.ts` modules are React-free
 * and run under `node --test` against better-sqlite3, so this file must never
 * pull `expo-sqlite` into their runtime graph.
 */
export async function withTransaction(db: Database, task: () => Promise<void>): Promise<void> {
    const client = db.$client as {
        withTransactionAsync?: (t: () => Promise<void>) => Promise<void>;
    };

    // The better-sqlite3 client most tests inject has no async transaction API, and
    // running the task bare keeps those meaningful rather than silently skipped. A
    // test that needs real rollback injects one — see `transfers-core.test.ts`.
    if (typeof client.withTransactionAsync !== "function") {
        await task();
        return;
    }

    await client.withTransactionAsync(task);
}

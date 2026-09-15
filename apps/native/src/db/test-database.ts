import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
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

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

/** The shipped migration files, in the order the app applies them. */
const migrationFiles = (): string[] =>
    readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort();

/** Runs one shipped migration file against a raw handle, statement by statement. */
export function applyMigration(sqlite: BetterSqlite3.Database, file: string): void {
    for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
        if (statement.trim()) {
            sqlite.exec(statement);
        }
    }
}

/**
 * Applies the shipped migrations in order. `include` lets a suite stop short of
 * one (`(file) => file < "0011_"`) to get the ledger as an earlier build left
 * it. Real SQL rather than a hand-rolled schema because the outbox triggers and
 * foreign keys under test exist only in the migration files; re-declaring them
 * would test a copy.
 */
export function applyMigrations(sqlite: BetterSqlite3.Database, include: (file: string) => boolean = () => true): void {
    for (const file of migrationFiles().filter(include)) {
        applyMigration(sqlite, file);
    }
}

/**
 * A fresh in-memory handle with every shipped migration applied. better-sqlite3
 * enforces foreign keys by default (and the rebuild migrations switch them back on); `foreignKeys: false` matches the app on a
 * store with orphans (see `db/client.ts`) for a suite that seeds bare ids.
 */
export function migratedSqlite({ foreignKeys = true } = {}): BetterSqlite3.Database {
    const sqlite = new BetterSqlite3(":memory:");
    applyMigrations(sqlite);
    if (!foreignKeys) {
        sqlite.pragma("foreign_keys = OFF");
    }
    return sqlite;
}

/** {@link migratedSqlite} wrapped as the app's {@link Database}. */
export const migratedDatabase = (options?: { foreignKeys?: boolean }): Database =>
    testDatabase(migratedSqlite(options));

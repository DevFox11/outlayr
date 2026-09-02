import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");
const REBUILD = "0024_goal_start_and_required_date";

/** Every migration file in order, so a phase can stop before a given one. */
function files(): string[] {
    return readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort();
}

function run(sqlite: BetterSqlite3.Database, file: string): void {
    for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
        if (statement.trim()) {
            sqlite.exec(statement);
        }
    }
}

/**
 * A ledger as it stood BEFORE the rebuild, so the rebuild's own behaviour can be
 * observed rather than assumed. The suites elsewhere replay every migration at
 * once, which leaves nothing for `0024` to find.
 */
function beforeRebuild(): BetterSqlite3.Database {
    const sqlite = new BetterSqlite3(":memory:");
    for (const file of files()) {
        if (file.startsWith(REBUILD)) {
            break;
        }
        run(sqlite, file);
    }
    sqlite.exec(
        "INSERT INTO accounts (id, name, currency, initialBalance, initialBalanceDate, dateCreated, updatedAt) VALUES ('acct', 'Savings', 'USD', 0, 0, 0, 0)"
    );
    return sqlite;
}

function seedGoal(sqlite: BetterSqlite3.Database, id: string, targetDate: number | null): void {
    sqlite
        .prepare(
            "INSERT INTO savingsGoals (id, accountId, currency, name, sortOrder, targetAmount, targetAmountUsd, targetDate, dateCreated, deletedAt, updatedAt) VALUES (?, 'acct', 'USD', ?, 0, 1000, 1000, ?, 5000, NULL, 5000)"
        )
        .run(id, id, targetDate);
}

describe("the rebuild that made a goal's date required", () => {
    it("keeps a dated goal untouched", () => {
        const sqlite = beforeRebuild();
        seedGoal(sqlite, "dated", 9000);
        run(sqlite, `${REBUILD}.sql`);

        const row = sqlite.prepare("SELECT * FROM savingsGoals WHERE id = 'dated'").get() as {
            deletedAt: number | null;
            targetDate: number;
        };
        expect(row.deletedAt).toBeNull();
        expect(row.targetDate).toBe(9000);
    });

    it("tombstones a dateless goal rather than dropping it", () => {
        // Dropping the row would leave nothing to carry the removal: a device that
        // had already synced would consider the goal gone while the server kept it.
        const sqlite = beforeRebuild();
        seedGoal(sqlite, "dateless", null);
        run(sqlite, `${REBUILD}.sql`);

        const row = sqlite.prepare("SELECT * FROM savingsGoals WHERE id = 'dateless'").get() as {
            deletedAt: number | null;
            targetDate: number;
        };
        expect(row.deletedAt).not.toBeNull();
        // Dated from its own creation, since the column can no longer hold null.
        expect(row.targetDate).toBe(5000);
    });

    it("queues that removal when the ledger syncs", () => {
        const sqlite = beforeRebuild();
        sqlite.exec("INSERT OR REPLACE INTO appMeta (key, value) VALUES ('syncEnabled', '1')");
        seedGoal(sqlite, "dateless", null);
        run(sqlite, `${REBUILD}.sql`);

        const queued = sqlite.prepare("SELECT localId FROM outbox WHERE tableName = 'savingsGoals'").all() as {
            localId: string;
        }[];
        expect(queued.map((entry) => entry.localId)).toStrictEqual(["dateless"]);
    });

    it("queues nothing on a ledger that does not sync", () => {
        const sqlite = beforeRebuild();
        seedGoal(sqlite, "dateless", null);
        run(sqlite, `${REBUILD}.sql`);

        const queued = sqlite.prepare("SELECT localId FROM outbox WHERE tableName = 'savingsGoals'").all();
        expect(queued).toStrictEqual([]);
    });
});

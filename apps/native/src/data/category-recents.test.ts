import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import {
	RECENT_CATEGORY_LIMIT,
	recentCategoryIdsQuery,
} from "./category-recents";

const MIGRATIONS = join(__dirname, "..", "..", "drizzle");

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
			"--> statement-breakpoint",
		)) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

let clock = 0;

function log(
	db: Database,
	categoryId: string | null,
	options: { income?: boolean; deleted?: boolean; at?: number } = {},
): void {
	const at = options.at ?? ++clock;
	const date = new Date(at * 1000);
	if (categoryId != null) {
		db.insert(categories)
			.values({
				id: categoryId,
				name: categoryId,
				income: options.income ?? false,
				sortOrder: 0,
				updatedAt: date,
			})
			.onConflictDoNothing()
			.run();
	}
	db.insert(transactions)
		.values({
			id: `tx-${at}-${categoryId ?? "none"}`,
			amount: 10,
			income: options.income ?? false,
			note: "",
			date,
			day: date,
			month: date,
			categoryId,
			updatedAt: date,
			deletedAt: options.deleted === true ? date : null,
		})
		.run();
}

function ids(
	db: Database,
	income: boolean,
	limit = RECENT_CATEGORY_LIMIT,
): string[] {
	return recentCategoryIdsQuery(db, income, limit)
		.all()
		.map((row) => row.categoryId)
		.filter((id): id is string => id != null);
}

beforeEach(() => {
	clock = 0;
});

describe("recentCategoryIdsQuery", () => {
	it("returns nothing on an empty ledger", () => {
		expect(ids(makeDb(), false)).toEqual([]);
	});

	it("orders by the most recent transaction, newest first", () => {
		const db = makeDb();
		log(db, "rent");
		log(db, "groceries");
		log(db, "transport");
		expect(ids(db, false)).toEqual(["transport", "groceries", "rent"]);
	});

	it("lists a category once, ranked by its newest transaction", () => {
		const db = makeDb();
		log(db, "groceries");
		log(db, "rent");
		log(db, "groceries");
		expect(ids(db, false)).toEqual(["groceries", "rent"]);
	});

	it("ignores soft-deleted transactions", () => {
		const db = makeDb();
		log(db, "rent");
		log(db, "groceries", { deleted: true });
		expect(ids(db, false)).toEqual(["rent"]);
	});

	it("ignores uncategorised transactions", () => {
		const db = makeDb();
		log(db, null);
		log(db, "rent");
		expect(ids(db, false)).toEqual(["rent"]);
	});

	it("keeps the two namespaces apart", () => {
		const db = makeDb();
		log(db, "groceries", { income: false });
		log(db, "paycheck", { income: true });
		expect(ids(db, false)).toEqual(["groceries"]);
		expect(ids(db, true)).toEqual(["paycheck"]);
	});

	it("caps the list at the requested limit", () => {
		const db = makeDb();
		for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
			log(db, name);
		}
		expect(ids(db, false, 5)).toHaveLength(5);
		expect(ids(db, false, 5)[0]).toBe("g");
	});
});

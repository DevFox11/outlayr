import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories } from "@/db/schema";
import {
	type Category,
	categoriesRepo,
	ensureCategoryByName,
	pickFreeCategoryIcon,
	SUGGESTED_CATEGORY_PRESETS,
} from "./categories-core";

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");

function migratedDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

async function liveCategories(db: Database, income: boolean): Promise<Category[]> {
	return db
		.select()
		.from(categories)
		.where(and(eq(categories.income, income), isNull(categories.deletedAt)));
}

describe("ensureCategoryByName", () => {
	let db: Database;

	beforeEach(() => {
		db = migratedDb();
	});

	it("creates a category when nothing in the namespace answers to the name", async () => {
		const id = await ensureCategoryByName(db, "Entertainment", false, "FilmRoll01", "#AF52DE");
		const rows = await liveCategories(db, false);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(id);
		expect(rows[0].name).toBe("Entertainment");
		expect(rows[0].icon).toBe("FilmRoll01");
	});

	it("resolves to the existing category on a same-namespace name collision instead of duplicating it", async () => {
		const first = await categoriesRepo.create(db, {
			color: "#AF52DE",
			icon: "FilmRoll01",
			income: false,
			name: "Entertainment",
		});

		const second = await ensureCategoryByName(db, "entertainment", false, "Tv01", "#000000");

		expect(second).toBe(first);
		expect(await liveCategories(db, false)).toHaveLength(1);
	});

	it("treats expense and income as separate namespaces", async () => {
		const expenseId = await ensureCategoryByName(db, "Gifts", false, "Gift", "#FF375F");
		const incomeId = await ensureCategoryByName(db, "Gifts", true, "GiftCard", "#E5484D");

		expect(expenseId).not.toBe(incomeId);
		expect(await liveCategories(db, false)).toHaveLength(1);
		expect(await liveCategories(db, true)).toHaveLength(1);
	});
});

describe("pickFreeCategoryIcon", () => {
	it("returns the preferred icon when no sibling already uses it", () => {
		const siblings: Category[] = [];
		expect(pickFreeCategoryIcon(siblings, "FilmRoll01")).toBe("FilmRoll01");
	});

	it("falls back to the first unused preset icon when the preferred icon collides", () => {
		const taken: Category = {
			color: "#AF52DE",
			dateCreated: new Date(0),
			deletedAt: null,
			emoji: null,
			icon: "FilmRoll01",
			id: "c1",
			income: false,
			name: "Entertainment",
			parentId: null,
			sortOrder: 0,
			updatedAt: new Date(0),
		};

		const result = pickFreeCategoryIcon([taken], "FilmRoll01");

		expect(result).not.toBe("FilmRoll01");
		const allPresetIcons = [...SUGGESTED_CATEGORY_PRESETS.expense, ...SUGGESTED_CATEGORY_PRESETS.income].map(
			(preset) => preset.icon
		);
		expect(allPresetIcons).toContain(result);
	});
});

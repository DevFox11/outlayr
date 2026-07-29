import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { budgets, categories, transactions } from "@/db/schema";
import {
	CATEGORY_ERROR_MESSAGES,
	capitalizeCategoryName,
	categoriesRepo,
	getCategoryById,
	SEEDED_CATEGORY_NAMES,
	SUGGESTED_CATEGORY_PRESETS,
	seedCategories,
	suggestedCategoriesNotAdded,
	validateCategoryCreate,
	validateCategoryEdit,
} from "./categories-core";

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE categories (
			id text PRIMARY KEY NOT NULL,
			name text,
			color text DEFAULT '#FFFFFF',
			icon text,
			emoji text,
			income integer NOT NULL DEFAULT 0,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer,
			parentId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			currency text,
			note text NOT NULL DEFAULT '',
			details text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			categoryId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE budgets (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			categoryId text UNIQUE,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

async function addTransaction(db: Database, categoryId: string): Promise<void> {
	const now = new Date();
	await db.insert(transactions).values({
		id: `tx-${Math.random().toString(36).slice(2)}`,
		amount: 10,
		income: false,
		note: "",
		date: now,
		day: now,
		month: now,
		categoryId,
		updatedAt: now,
	});
}

async function assertRejectsWith(
	fn: () => Promise<unknown>,
	message: string,
): Promise<void> {
	await assert.rejects(fn, (error: unknown) => {
		assert.ok(error instanceof Error);
		assert.equal(error.message, message);
		return true;
	});
}

describe("capitalizeCategoryName", () => {
	it("trims, collapses whitespace, and title-cases", () => {
		assert.equal(capitalizeCategoryName("  dining   out "), "Dining Out");
		assert.equal(capitalizeCategoryName("COFFEE"), "Coffee");
		assert.equal(capitalizeCategoryName("groceries"), "Groceries");
		assert.equal(capitalizeCategoryName("   "), "");
	});
});

describe("categoriesRepo.create validation", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("reports incomplete when both name and symbol are missing", async () => {
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "  ",
					icon: "",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.incomplete,
		);
	});

	it("reports missingName when only the name is blank", async () => {
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "  ",
					icon: "Coffee02",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.missingName,
		);
	});

	it("reports missingIcon when the name is set but no symbol", async () => {
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "Coffee",
					icon: "",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.missingIcon,
		);
	});

	it("accepts an emoji as the symbol (no icon)", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			emoji: "☕",
			color: "#279AF4",
			income: false,
		});
		const row = await getCategoryById(db, id);
		assert.equal(row?.emoji, "☕");
		assert.equal(row?.icon, null);
	});

	it("title-cases and trims the stored name", async () => {
		const id = await categoriesRepo.create(db, {
			name: "  coffee shop  ",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const row = await getCategoryById(db, id);
		assert.equal(row?.name, "Coffee Shop");
		assert.equal(row?.icon, "Coffee02");
		assert.equal(row?.color, "#279AF4");
		assert.equal(row?.income, false);
	});
});

describe("categoriesRepo.create collisions", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("rejects a duplicate icon in the same namespace", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "Tea",
					icon: "Coffee02",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.duplicateIcon,
		);
	});

	it("rejects a duplicate emoji, normalizing variation selectors", async () => {
		const heart = String.fromCodePoint(0x2764);
		const heartVs = heart + String.fromCharCode(0xfe0f);
		await categoriesRepo.create(db, {
			name: "Love",
			emoji: heart,
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "Adore",
					emoji: heartVs,
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.duplicateEmoji,
		);
	});

	it("rejects a duplicate name (case-insensitive) with a distinct icon", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "coffee",
					icon: "Restaurant02",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.duplicateName,
		);
	});

	it("reports the combined duplicate when both symbol and name match", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() =>
				categoriesRepo.create(db, {
					name: "Coffee",
					icon: "Coffee02",
					color: "#279AF4",
					income: false,
				}),
			CATEGORY_ERROR_MESSAGES.duplicate,
		);
	});

	it("allows the same symbol and name in the other namespace", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: true,
		});
		assert.notEqual(await getCategoryById(db, id), null);
	});

	it("ignores a soft-deleted sibling when checking collisions", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await db
			.update(categories)
			.set({ deletedAt: new Date() })
			.where(eq(categories.id, id));
		const reused = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		assert.notEqual(await getCategoryById(db, reused), null);
	});
});

describe("categoriesRepo.create sortOrder", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	const make = (name: string, income: boolean, parentId?: string) =>
		categoriesRepo.create(db, {
			name,
			icon: name,
			color: "#279AF4",
			income,
			parentId,
		});

	it("starts at 0 and increments within a namespace", async () => {
		const first = await getCategoryById(db, await make("A", false));
		const second = await getCategoryById(db, await make("B", false));
		assert.equal(first?.sortOrder, 0);
		assert.equal(second?.sortOrder, 1);
	});

	it("scopes ordering per income/expense namespace", async () => {
		await make("A", false);
		await make("B", false);
		const income = await getCategoryById(db, await make("Salary", true));
		assert.equal(income?.sortOrder, 0);
	});

	it("appends after seeded categories", async () => {
		await seedCategories(db);
		const nextExpense = await getCategoryById(db, await make("Coffee", false));
		const nextIncome = await getCategoryById(db, await make("Bonus", true));
		assert.equal(nextExpense?.sortOrder, 10);
		assert.equal(nextIncome?.sortOrder, 4);
	});

	it("scopes ordering to a parent for subcategories", async () => {
		const parentId = await make("Food", false);
		const childA = await getCategoryById(
			db,
			await make("Coffee", false, parentId),
		);
		const childB = await getCategoryById(
			db,
			await make("Snacks", false, parentId),
		);
		assert.equal(childA?.sortOrder, 0);
		assert.equal(childB?.sortOrder, 1);
	});
});

describe("validateCategoryCreate", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("returns the append order alongside a null error when valid", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const result = await validateCategoryCreate(db, {
			name: "Tea",
			icon: "Restaurant02",
			income: false,
		});
		assert.equal(result.error, null);
		assert.equal(result.order, 1);
	});
});

describe("categoriesRepo.update", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("renames, recolors, and title-cases without touching other fields", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await categoriesRepo.update(db, id, {
			name: "morning coffee",
			color: "#EC7A58",
		});
		const row = await getCategoryById(db, id);
		assert.equal(row?.name, "Morning Coffee");
		assert.equal(row?.color, "#EC7A58");
		assert.equal(row?.icon, "Coffee02");
		assert.equal(row?.income, false);
	});

	it("excludes the edited row from its own collision check", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await categoriesRepo.update(db, id, { name: "Coffee", icon: "Coffee02" });
		const row = await getCategoryById(db, id);
		assert.equal(row?.name, "Coffee");
	});

	it("rejects renaming onto a sibling's name", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const other = await categoriesRepo.create(db, {
			name: "Tea",
			icon: "Restaurant02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() => categoriesRepo.update(db, other, { name: "coffee" }),
			CATEGORY_ERROR_MESSAGES.duplicateName,
		);
	});

	it("rejects adopting a sibling's icon", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const other = await categoriesRepo.create(db, {
			name: "Tea",
			icon: "Restaurant02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() => categoriesRepo.update(db, other, { icon: "Coffee02" }),
			CATEGORY_ERROR_MESSAGES.duplicateIcon,
		);
	});

	it("rejects a blank rename", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() => categoriesRepo.update(db, id, { name: "   " }),
			CATEGORY_ERROR_MESSAGES.missingName,
		);
	});

	it("rejects clearing the only symbol of a symbol-bearing row", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await assertRejectsWith(
			() => categoriesRepo.update(db, id, { icon: "" }),
			CATEGORY_ERROR_MESSAGES.missingIcon,
		);
	});

	it("allows renaming a legacy symbol-less row", async () => {
		const now = new Date();
		await db.insert(categories).values({
			id: "legacy",
			name: "Legacy",
			icon: null,
			emoji: null,
			color: "#279AF4",
			income: false,
			sortOrder: 0,
			parentId: null,
			dateCreated: now,
			updatedAt: now,
			deletedAt: null,
		});
		await categoriesRepo.update(db, "legacy", { name: "renamed" });
		const row = await getCategoryById(db, "legacy");
		assert.equal(row?.name, "Renamed");
	});
});

describe("validateCategoryEdit", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("does not flag the edited row against itself", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const result = await validateCategoryEdit(db, id, {
			name: "Coffee",
			icon: "Coffee02",
		});
		assert.equal(result.error, null);
	});
});

describe("categoriesRepo.reorder", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("persists sortOrder as the array index", async () => {
		const a = await categoriesRepo.create(db, {
			name: "A",
			icon: "IconA",
			color: "#279AF4",
			income: false,
		});
		const b = await categoriesRepo.create(db, {
			name: "B",
			icon: "IconB",
			color: "#279AF4",
			income: false,
		});
		const c = await categoriesRepo.create(db, {
			name: "C",
			icon: "IconC",
			color: "#279AF4",
			income: false,
		});

		await categoriesRepo.reorder(db, [c, a, b]);

		assert.equal((await getCategoryById(db, c))?.sortOrder, 0);
		assert.equal((await getCategoryById(db, a))?.sortOrder, 1);
		assert.equal((await getCategoryById(db, b))?.sortOrder, 2);
	});
});

describe("categoriesRepo.setParent", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("nests a top-level category under a parent, appending in scope", async () => {
		const parent = await categoriesRepo.create(db, {
			name: "Food",
			icon: "IconFood",
			color: "#279AF4",
			income: false,
		});
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "IconCoffee",
			color: "#279AF4",
			income: false,
			parentId: parent,
		});
		const moving = await categoriesRepo.create(db, {
			name: "Snacks",
			icon: "IconSnacks",
			color: "#279AF4",
			income: false,
		});

		await categoriesRepo.setParent(db, moving, parent);

		const row = await getCategoryById(db, moving);
		assert.equal(row?.parentId, parent);
		assert.equal(row?.sortOrder, 1);
	});

	it("inherits the destination parent's income namespace", async () => {
		const incomeParent = await categoriesRepo.create(db, {
			name: "Earnings",
			icon: "IconEarnings",
			color: "#279AF4",
			income: true,
		});
		const expenseChild = await categoriesRepo.create(db, {
			name: "Bonus",
			icon: "IconBonus",
			color: "#279AF4",
			income: false,
		});

		await categoriesRepo.setParent(db, expenseChild, incomeParent);

		const row = await getCategoryById(db, expenseChild);
		assert.equal(row?.income, true);
		assert.equal(row?.parentId, incomeParent);
	});

	it("promotes a subcategory back to the top level", async () => {
		const parent = await categoriesRepo.create(db, {
			name: "Food",
			icon: "IconFood",
			color: "#279AF4",
			income: false,
		});
		const child = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "IconCoffee",
			color: "#279AF4",
			income: false,
			parentId: parent,
		});

		await categoriesRepo.setParent(db, child, null);

		const row = await getCategoryById(db, child);
		assert.equal(row?.parentId, null);
	});
});

describe("suggestedCategoriesNotAdded", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("returns every preset for an empty namespace", async () => {
		const expense = await suggestedCategoriesNotAdded(db, false);
		const income = await suggestedCategoriesNotAdded(db, true);
		assert.equal(expense.length, SUGGESTED_CATEGORY_PRESETS.expense.length);
		assert.equal(income.length, SUGGESTED_CATEGORY_PRESETS.income.length);
	});

	it("excludes a preset whose name is already used", async () => {
		await categoriesRepo.create(db, {
			name: "coffee",
			icon: "SomeOtherIcon",
			color: "#279AF4",
			income: false,
		});
		const remaining = await suggestedCategoriesNotAdded(db, false);
		assert.ok(!remaining.some((preset) => preset.name === "Coffee"));
		assert.equal(
			remaining.length,
			SUGGESTED_CATEGORY_PRESETS.expense.length - 1,
		);
	});

	it("excludes a preset whose icon is already used", async () => {
		await categoriesRepo.create(db, {
			name: "Java",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const remaining = await suggestedCategoriesNotAdded(db, false);
		assert.ok(!remaining.some((preset) => preset.icon === "Coffee02"));
	});

	it("scopes the filter to the requested namespace", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const income = await suggestedCategoriesNotAdded(db, true);
		assert.equal(income.length, SUGGESTED_CATEGORY_PRESETS.income.length);
	});
});

describe("categoriesRepo.addSuggested", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("adds a preset and skips it on a second attempt", async () => {
		const [preset] = SUGGESTED_CATEGORY_PRESETS.expense;
		const id = await categoriesRepo.addSuggested(db, {
			name: preset.name,
			icon: preset.icon,
			color: preset.color,
			income: false,
		});
		assert.notEqual(id, null);
		const row = await getCategoryById(db, id as string);
		assert.equal(row?.name, capitalizeCategoryName(preset.name));
		assert.equal(row?.icon, preset.icon);
		assert.equal(row?.sortOrder, 0);

		const second = await categoriesRepo.addSuggested(db, {
			name: preset.name,
			icon: preset.icon,
			color: preset.color,
			income: false,
		});
		assert.equal(second, null);
	});
});

describe("categoriesRepo.remove cascade", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("deletes the category and its transactions", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await addTransaction(db, id);
		await addTransaction(db, id);

		await categoriesRepo.remove(db, id);

		assert.equal(await getCategoryById(db, id), null);
		const remaining = await db
			.select()
			.from(transactions)
			.where(eq(transactions.categoryId, id));
		assert.equal(remaining.length, 0);
	});

	it("promotes subcategories to the top level", async () => {
		const parentId = await categoriesRepo.create(db, {
			name: "Food",
			icon: "IconFood",
			color: "#279AF4",
			income: false,
		});
		const childId = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "IconCoffee",
			color: "#279AF4",
			income: false,
			parentId,
		});

		await categoriesRepo.remove(db, parentId);

		const child = await getCategoryById(db, childId);
		assert.notEqual(child, null);
		assert.equal(child?.parentId, null);
	});

	it("deletes a budget attached to the category", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const now = new Date();
		await db.insert(budgets).values({
			id: "b1",
			name: "Coffee budget",
			amount: 100,
			type: 2,
			categoryId: id,
			updatedAt: now,
		});

		await categoriesRepo.remove(db, id);

		const remaining = await db
			.select()
			.from(budgets)
			.where(eq(budgets.categoryId, id));
		assert.equal(remaining.length, 0);
	});
});

describe("seedCategories idempotency", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("seeds one full set on a fresh store", async () => {
		await seedCategories(db);

		const rows = await db.select().from(categories);
		assert.ok(rows.length > 0);
		assert.equal(
			rows.length,
			SEEDED_CATEGORY_NAMES.expense.length +
				SEEDED_CATEGORY_NAMES.income.length,
		);
	});

	it("does not seed a second set when run again", async () => {
		await seedCategories(db);
		const first = await db.select().from(categories);

		await seedCategories(db);
		const second = await db.select().from(categories);

		// bootstrap writes the firstLaunch marker only after seeding returns, so a
		// crash in between would otherwise double the whole category set.
		assert.equal(second.length, first.length);
		assert.deepEqual(
			second.map((row) => row.id).sort(),
			first.map((row) => row.id).sort(),
		);
	});

	it("leaves a store that already has categories untouched", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});

		await seedCategories(db);

		const rows = await db.select().from(categories);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.id, id);
	});
});

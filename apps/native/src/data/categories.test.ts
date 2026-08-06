import BetterSqlite3 from "better-sqlite3";
import { and, eq, isNull } from "drizzle-orm";
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
	seededCategoryId,
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
			imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			reminderLeadDays integer,
			categoryId text,
			accountId text,
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
			rollover integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			categoryId text UNIQUE,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

async function addTransaction(
	db: Database,
	categoryId: string,
	overrides: Partial<typeof transactions.$inferInsert> = {},
): Promise<void> {
	const now = new Date();
	await db.insert(transactions).values({
		id: `tx-${Math.random().toString(36).slice(2)}`,
		amount: 10,
		income: false,
		note: "Flat white",
		date: now,
		day: now,
		month: now,
		categoryId,
		updatedAt: now,
		...overrides,
	});
}

async function assertRejectsWith(
	fn: () => Promise<unknown>,
	message: string,
): Promise<void> {
	await expect(fn()).rejects.toThrow(new Error(message));
}

describe("capitalizeCategoryName", () => {
	it("trims, collapses whitespace, and title-cases", () => {
		expect(capitalizeCategoryName("  dining   out ")).toBe("Dining Out");
		expect(capitalizeCategoryName("COFFEE")).toBe("Coffee");
		expect(capitalizeCategoryName("groceries")).toBe("Groceries");
		expect(capitalizeCategoryName("   ")).toBe("");
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
		expect(row?.emoji).toBe("☕");
		expect(row?.icon).toBe(null);
	});

	it("title-cases and trims the stored name", async () => {
		const id = await categoriesRepo.create(db, {
			name: "  coffee shop  ",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const row = await getCategoryById(db, id);
		expect(row?.name).toBe("Coffee Shop");
		expect(row?.icon).toBe("Coffee02");
		expect(row?.color).toBe("#279AF4");
		expect(row?.income).toBe(false);
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
		expect(await getCategoryById(db, id)).not.toBe(null);
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
		expect(await getCategoryById(db, reused)).not.toBe(null);
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
		expect(first?.sortOrder).toBe(0);
		expect(second?.sortOrder).toBe(1);
	});

	it("scopes ordering per income/expense namespace", async () => {
		await make("A", false);
		await make("B", false);
		const income = await getCategoryById(db, await make("Salary", true));
		expect(income?.sortOrder).toBe(0);
	});

	it("appends after seeded categories", async () => {
		await seedCategories(db);
		const nextExpense = await getCategoryById(db, await make("Coffee", false));
		const nextIncome = await getCategoryById(db, await make("Bonus", true));
		expect(nextExpense?.sortOrder).toBe(10);
		expect(nextIncome?.sortOrder).toBe(4);
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
		expect(childA?.sortOrder).toBe(0);
		expect(childB?.sortOrder).toBe(1);
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
		expect(result.error).toBe(null);
		expect(result.order).toBe(1);
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
		expect(row?.name).toBe("Morning Coffee");
		expect(row?.color).toBe("#EC7A58");
		expect(row?.icon).toBe("Coffee02");
		expect(row?.income).toBe(false);
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
		expect(row?.name).toBe("Coffee");
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
		expect(row?.name).toBe("Renamed");
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
		expect(result.error).toBe(null);
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

		expect((await getCategoryById(db, c))?.sortOrder).toBe(0);
		expect((await getCategoryById(db, a))?.sortOrder).toBe(1);
		expect((await getCategoryById(db, b))?.sortOrder).toBe(2);
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
		expect(row?.parentId).toBe(parent);
		expect(row?.sortOrder).toBe(1);
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
		expect(row?.income).toBe(true);
		expect(row?.parentId).toBe(incomeParent);
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
		expect(row?.parentId).toBe(null);
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
		expect(expense.length).toBe(SUGGESTED_CATEGORY_PRESETS.expense.length);
		expect(income.length).toBe(SUGGESTED_CATEGORY_PRESETS.income.length);
	});

	it("excludes a preset whose name is already used", async () => {
		await categoriesRepo.create(db, {
			name: "coffee",
			icon: "SomeOtherIcon",
			color: "#279AF4",
			income: false,
		});
		const remaining = await suggestedCategoriesNotAdded(db, false);
		expect(!remaining.some((preset) => preset.name === "Coffee")).toBeTruthy();
		expect(remaining.length).toBe(
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
		expect(
			!remaining.some((preset) => preset.icon === "Coffee02"),
		).toBeTruthy();
	});

	it("scopes the filter to the requested namespace", async () => {
		await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const income = await suggestedCategoriesNotAdded(db, true);
		expect(income.length).toBe(SUGGESTED_CATEGORY_PRESETS.income.length);
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
		expect(id).not.toBe(null);
		const row = await getCategoryById(db, id as string);
		expect(row?.name).toBe(capitalizeCategoryName(preset.name));
		expect(row?.icon).toBe(preset.icon);
		expect(row?.sortOrder).toBe(0);

		const second = await categoriesRepo.addSuggested(db, {
			name: preset.name,
			icon: preset.icon,
			color: preset.color,
			income: false,
		});
		expect(second).toBe(null);
	});
});

describe("categoriesRepo.remove cascade", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("tombstones the category and its transactions", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await addTransaction(db, id);
		await addTransaction(db, id);

		await categoriesRepo.remove(db, id);

		expect(await getCategoryById(db, id)).toBe(null);
		const categoryRows = await db
			.select()
			.from(categories)
			.where(eq(categories.id, id));
		expect(categoryRows.length).toBe(1);
		expect(categoryRows[0].deletedAt).not.toBe(null);

		const readable = await db
			.select()
			.from(transactions)
			.where(
				and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)),
			);
		expect(readable.length).toBe(0);
		const replicable = await db
			.select()
			.from(transactions)
			.where(eq(transactions.categoryId, id));
		expect(replicable.length).toBe(2);
		for (const row of replicable) {
			expect(row.deletedAt).not.toBe(null);
		}
	});

	it("retires the schedule and releases the photo of each cascaded transaction", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await addTransaction(db, id, {
			imageUri: "file:///photos/tx.jpg",
			onceRecurring: true,
			recurringType: 2,
		});

		await categoriesRepo.remove(db, id);

		const [row] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.categoryId, id));
		expect(row.imageUri).toBe(null);
		expect(row.recurringType).toBe(0);
		expect(row.note).toBe("Flat white");
		expect(row.amount).toBe(10);
	});

	it("does not re-stamp what it already tombstoned", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		await addTransaction(db, id);

		await categoriesRepo.remove(db, id);
		const first = await db.select().from(transactions);
		const firstCategory = await db.select().from(categories);

		await categoriesRepo.remove(db, id);

		const second = await db.select().from(transactions);
		expect(second[0].deletedAt?.getTime()).toBe(first[0].deletedAt?.getTime());
		expect(second[0].updatedAt.getTime()).toBe(first[0].updatedAt.getTime());
		const secondCategory = await db.select().from(categories);
		expect(secondCategory[0].deletedAt?.getTime()).toBe(
			firstCategory[0].deletedAt?.getTime(),
		);
		expect(secondCategory[0].updatedAt.getTime()).toBe(
			firstCategory[0].updatedAt.getTime(),
		);
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
		expect(child).not.toBe(null);
		expect(child?.parentId).toBe(null);
	});

	it("tombstones a budget attached to the category", async () => {
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

		const readable = await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)));
		expect(readable.length).toBe(0);
		const replicable = await db
			.select()
			.from(budgets)
			.where(eq(budgets.id, "b1"));
		expect(replicable.length).toBe(1);
		expect(replicable[0].deletedAt).not.toBe(null);
	});

	it("lets the category hold a budget again after the cascade", async () => {
		const id = await categoriesRepo.create(db, {
			name: "Coffee",
			icon: "Coffee02",
			color: "#279AF4",
			income: false,
		});
		const now = new Date();
		await db.insert(budgets).values({
			id: "b1",
			amount: 100,
			type: 2,
			categoryId: id,
			updatedAt: now,
		});

		await categoriesRepo.remove(db, id);

		// What a pull does with a peer's budget for the same category: the
		// tombstone must not still be holding `budgets_categoryId_unique`, or the
		// insert throws and takes the whole apply transaction with it.
		await db.insert(budgets).values({
			id: "b2",
			amount: 250,
			type: 2,
			categoryId: id,
			updatedAt: now,
		});

		const live = await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)));
		expect(live.map((row) => row.id)).toStrictEqual(["b2"]);
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
		expect(rows.length > 0).toBeTruthy();
		expect(rows.length).toBe(
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
		expect(second.length).toBe(first.length);
		expect(second.map((row) => row.id).sort()).toStrictEqual(
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
		expect(rows.length).toBe(1);
		expect(rows[0]?.id).toBe(id);
	});

	it("mints the same ids on two independent installs", async () => {
		const other = makeDb();
		await seedCategories(db);
		await seedCategories(other);

		const identify = async (target: Database) => {
			const rows = await target.select().from(categories);
			return rows
				.map(
					(row) => `${row.income ? "income" : "expense"} ${row.name} ${row.id}`,
				)
				.sort();
		};

		expect(await identify(db)).toStrictEqual(await identify(other));
	});

	it("gives each seeded category a distinct id", async () => {
		await seedCategories(db);

		const rows = await db.select().from(categories);
		expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
	});

	it("derives a different id for the same name in each namespace", () => {
		expect(seededCategoryId("Gifts", true)).not.toBe(
			seededCategoryId("Gifts", false),
		);
	});
});

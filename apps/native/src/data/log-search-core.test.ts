import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { transactions } from "@/db/schema";
import { searchedTransactionsQuery } from "./log-search-core";
import { logWindowRowsQuery } from "./transactions-core";

type TestDb = ReturnType<typeof drizzle>;

const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
	new Date(y, m - 1, d, h, min, 0, 0);

const NOW = at(2025, 7, 15, 12).getTime();

function makeDb(): TestDb {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
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
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite);
}

interface RowSeed {
	id: string;
	note?: string;
	/** The form's longer free-text field. */
	details?: string;
	amount?: number;
	date: Date;
	categoryId?: string;
	deletedAt?: Date;
}

async function seed(db: TestDb, rows: RowSeed[]): Promise<void> {
	await db.insert(transactions).values(
		rows.map((row) => ({
			id: row.id,
			amount: row.amount ?? 10,
			income: false,
			note: row.note ?? "",
			details: row.details ?? null,
			date: row.date,
			day: at(
				row.date.getFullYear(),
				row.date.getMonth() + 1,
				row.date.getDate(),
			),
			month: at(row.date.getFullYear(), row.date.getMonth() + 1, 1),
			categoryId: row.categoryId ?? null,
			updatedAt: new Date(0),
			deletedAt: row.deletedAt ?? null,
		})),
	);
}

async function search(
	db: TestDb,
	query: string,
	categoryIds: string[] = [],
	nowMs = NOW,
): Promise<string[]> {
	const rows = await searchedTransactionsQuery(db, {
		query,
		categoryIds,
		nowMs,
	});
	return rows.map((row) => row.id);
}

describe("search query", () => {
	it("matches a note containing the query, in any case", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "hit", note: "Weekly GROCERIES run", date: at(2025, 7, 14) },
			{ id: "miss", note: "Petrol", date: at(2025, 7, 14) },
		]);

		expect(await search(db, "groceries")).toStrictEqual(["hit"]);
	});

	it("matches every row of a category whose name matched", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "in-cat",
				note: "nothing textual to match",
				date: at(2025, 7, 14),
				categoryId: "cat-food",
			},
			{ id: "other", note: "nothing textual to match", date: at(2025, 7, 14) },
		]);

		expect(await search(db, "food", ["cat-food"])).toStrictEqual(["in-cat"]);
	});

	it("matches an exact amount when the query reads as a number", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "exact", amount: 42, note: "rent", date: at(2025, 7, 14) },
			{ id: "near", amount: 4200, note: "rent", date: at(2025, 7, 13) },
		]);

		expect(await search(db, "42")).toStrictEqual(["exact"]);
	});

	it("excludes rows dated ahead of the clock, which have not been spent yet", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "landed", note: "Rent", amount: 1500, date: at(2025, 7, 1) },
			{ id: "scheduled", note: "Rent", amount: 1500, date: at(2025, 8, 1) },
		]);

		expect(await search(db, "rent")).toStrictEqual(["landed"]);
	});

	it("takes in a row the moment the clock reaches it", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "later-today", note: "Rent", date: at(2025, 7, 15, 18) },
		]);

		expect(await search(db, "rent")).toStrictEqual([]);
		expect(
			await search(db, "rent", [], at(2025, 7, 15, 19).getTime()),
		).toStrictEqual(["later-today"]);
	});

	it("excludes tombstones", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "gone",
				note: "Rent",
				date: at(2025, 7, 1),
				deletedAt: new Date(0),
			},
		]);

		expect(await search(db, "rent")).toStrictEqual([]);
	});

	it("matches nothing at all on an empty query", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "any", note: "Rent", details: "anything", date: at(2025, 7, 1) },
		]);

		expect(await search(db, "")).toStrictEqual([]);
	});

	it("returns newest first", async () => {
		const db = makeDb();
		await seed(db, [
			{ id: "middle", note: "Rent", date: at(2025, 7, 10) },
			{ id: "newest", note: "Rent", date: at(2025, 7, 14) },
			{ id: "oldest", note: "Rent", date: at(2025, 6, 30) },
		]);

		expect(await search(db, "rent")).toStrictEqual([
			"newest",
			"middle",
			"oldest",
		]);
	});
});

describe("search over the note's free text", () => {
	it("matches a row whose free text matched and whose note did not", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "in-details",
				note: "Card 4471",
				details: "Quarterly dentist deposit",
				date: at(2025, 7, 14),
			},
			{ id: "other", note: "Card 4471", date: at(2025, 7, 14) },
		]);

		expect(await search(db, "dentist")).toStrictEqual(["in-details"]);
	});

	it("returns a row matching both the note and the free text once", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "both",
				note: "Coffee",
				details: "coffee beans for the office",
				date: at(2025, 7, 14),
			},
		]);

		expect(await search(db, "coffee")).toStrictEqual(["both"]);
	});

	it("holds the clock and tombstone bounds the note match holds", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "scheduled",
				note: "Card 4471",
				details: "dentist",
				date: at(2025, 8, 1),
			},
			{
				id: "gone",
				note: "Card 4471",
				details: "dentist",
				date: at(2025, 7, 1),
				deletedAt: new Date(0),
			},
		]);

		expect(await search(db, "dentist")).toStrictEqual([]);
	});
});

describe("wildcards in the query", () => {
	it("matches a literal percent rather than standing for anything", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "literal",
				note: "50% off socks",
				amount: 12,
				date: at(2025, 7, 14),
			},
			{
				id: "wildcard-bait",
				note: "5000 off",
				amount: 13,
				date: at(2025, 7, 14),
			},
		]);

		expect(await search(db, "50%")).toStrictEqual(["literal"]);
	});

	it("matches a literal underscore in the free text", async () => {
		const db = makeDb();
		await seed(db, [
			{
				id: "literal",
				note: "Invoice",
				details: "ref a_b",
				date: at(2025, 7, 14),
			},
			{
				id: "wildcard-bait",
				note: "Invoice",
				details: "ref axb",
				date: at(2025, 7, 13),
			},
		]);

		expect(await search(db, "a_b")).toStrictEqual(["literal"]);
	});
});

describe("the search projection", () => {
	const row = {
		id: "row",
		note: "Card 4471",
		details: "Quarterly dentist deposit",
		date: at(2025, 7, 14),
	};

	it("carries the free text, so a matched row can show why it matched", async () => {
		const db = makeDb();
		await seed(db, [row]);

		const rows = await searchedTransactionsQuery(db, {
			query: "dentist",
			categoryIds: [],
			nowMs: NOW,
		});

		expect(rows.map((found) => found.details)).toStrictEqual([
			"Quarterly dentist deposit",
		]);
	});

	it("leaves the free text out of the Log's own read", async () => {
		const db = makeDb();
		await seed(db, [row]);

		const rows = await logWindowRowsQuery(db, NOW, null);

		expect(rows.length).toBe(1);
		expect(
			rows.flatMap((found) => Object.keys(found)).includes("details"),
		).toBe(false);
	});
});

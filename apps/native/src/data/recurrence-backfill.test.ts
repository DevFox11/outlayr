import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { asc, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { startOfDay } from "@/domain/dates";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { backfillAllRecurring, backfillRecurring } from "./recurrence-backfill";

const NOW = new Date(2025, 5, 15, 10, 30);
const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		-- The back-fill canonicalizes each occurrence to USD, which reads the
		-- ledger currency and the rate replica. Both are empty here, so every
		-- occurrence resolves to a null amountUsd — exactly the offline case.
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
		CREATE TABLE exchangeRates (
			quote text NOT NULL,
			rateType text NOT NULL,
			date text NOT NULL,
			rate real NOT NULL,
			source text NOT NULL,
			fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
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
	`);
	return drizzle(sqlite) as unknown as Database;
}

interface SourceOverrides {
	date: Date;
	id?: string;
	recurringType?: number;
	recurringCoefficient?: number;
	recurringEndDate?: Date | null;
	onceRecurring?: boolean;
	deletedAt?: Date | null;
}

async function seedSource(
	db: Database,
	overrides: SourceOverrides,
): Promise<string> {
	const id = overrides.id ?? "src";
	await db.insert(transactions).values({
		id,
		amount: 9.99,
		income: false,
		currency: "USD",
		note: "Netflix",
		details: "family plan",
		date: overrides.date,
		day: startOfDay(overrides.date),
		month: startOfDay(overrides.date),
		icon: "Tv01",
		emoji: null,
		customColor: "#FF0000",
		imageColor: null,
		imageUri: null,
		onceRecurring: overrides.onceRecurring ?? true,
		recurringType: overrides.recurringType ?? RECURRING_TYPE.monthly,
		recurringCoefficient: overrides.recurringCoefficient ?? 1,
		recurringEndDate: overrides.recurringEndDate ?? null,
		categoryId: "bills",
		updatedAt: NOW,
		deletedAt: overrides.deletedAt ?? null,
	});
	return id;
}

function allRows(db: Database) {
	return db
		.select()
		.from(transactions)
		.where(isNull(transactions.deletedAt))
		.orderBy(asc(transactions.date));
}

async function generatedRows(db: Database, sourceId: string) {
	const rows = await allRows(db);
	return rows.filter((row) => row.id !== sourceId);
}

describe("backfillRecurring", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("materializes every past occurrence and retires the source (Case A)", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 3);
		assert.deepEqual(
			generated.map((row) => row.date.getTime()),
			[at(2025, 4, 15), at(2025, 5, 15), at(2025, 6, 15)].map((d) =>
				startOfDay(d).getTime(),
			),
		);

		for (const row of generated) {
			assert.equal(row.onceRecurring, true);
			assert.equal(row.amount, 9.99);
			assert.equal(row.income, false);
			assert.equal(row.currency, "USD");
			assert.equal(row.note, "Netflix");
			assert.equal(row.details, "family plan");
			assert.equal(row.icon, "Tv01");
			assert.equal(row.customColor, "#FF0000");
			assert.equal(row.categoryId, "bills");
			assert.equal(row.day.getTime(), startOfDay(row.date).getTime());
		}

		const source = (await allRows(db)).find((row) => row.id === id);
		assert.equal(source?.recurringType, RECURRING_TYPE.none);
		assert.equal(source?.date.getTime(), startOfDay(at(2025, 3, 15)).getTime());
	});

	it("carries the schedule onto the newest occurrence, leaving the rest inert", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringCoefficient: 1,
			recurringEndDate: at(2026, 3, 15),
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		const newest = generated.at(-1);
		assert.equal(newest?.date.getTime(), startOfDay(at(2025, 6, 15)).getTime());
		assert.equal(newest?.recurringType, RECURRING_TYPE.monthly);
		assert.equal(newest?.recurringCoefficient, 1);
		assert.equal(
			newest?.recurringEndDate?.getTime(),
			at(2026, 3, 15).getTime(),
		);

		for (const row of generated.slice(0, -1)) {
			assert.equal(row.recurringType, RECURRING_TYPE.none);
			assert.equal(row.recurringCoefficient, 1);
			assert.equal(row.recurringEndDate, null);
		}
	});

	it("leaves the newest occurrence inert when the next charge is past the end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringEndDate: at(2025, 6, 20),
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 3);
		for (const row of generated) {
			assert.equal(row.recurringType, RECURRING_TYPE.none);
		}
	});

	it("materializes today's single occurrence (Case B)", async () => {
		const id = await seedSource(db, { date: at(2025, 5, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 1);
		assert.equal(
			generated[0]?.date.getTime(),
			startOfDay(at(2025, 6, 15)).getTime(),
		);
		assert.equal(generated[0]?.recurringType, RECURRING_TYPE.monthly);
		const source = (await allRows(db)).find((row) => row.id === id);
		assert.equal(source?.recurringType, RECURRING_TYPE.none);
	});

	it("stops generation at a past end date (Case B — end limit)", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringEndDate: at(2025, 5, 15),
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 2);
		assert.deepEqual(
			generated.map((row) => row.date.getTime()),
			[at(2025, 4, 15), at(2025, 5, 15)].map((d) => startOfDay(d).getTime()),
		);
		const past = generated.some(
			(row) => row.date.getTime() > startOfDay(at(2025, 5, 15)).getTime(),
		);
		assert.equal(past, false);
	});

	it("is a no-op for a future-dated subscription (Case C)", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 0);
		const source = (await allRows(db)).find((row) => row.id === id);
		assert.equal(source?.recurringType, RECURRING_TYPE.monthly);
	});

	it("makes forward progress under a malformed coefficient (guard)", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 12),
			recurringType: RECURRING_TYPE.daily,
			recurringCoefficient: 0,
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 3);
		const times = generated.map((row) => row.date.getTime());
		assert.deepEqual(
			times,
			[at(2025, 6, 13), at(2025, 6, 14), at(2025, 6, 15)].map((d) =>
				startOfDay(d).getTime(),
			),
		);
		for (let i = 1; i < times.length; i++) {
			assert.ok((times[i] ?? 0) > (times[i - 1] ?? 0));
		}
		const source = (await allRows(db)).find((row) => row.id === id);
		assert.equal(source?.recurringType, RECURRING_TYPE.none);
	});

	it("leaves a non-recurring source untouched", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		assert.equal(generated.length, 0);
	});
});

describe("backfillAllRecurring", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("charges again on a later sweep", async () => {
		await seedSource(db, { date: at(2025, 3, 15) });

		await backfillAllRecurring(db, NOW);
		await backfillAllRecurring(db, new Date(2025, 6, 20, 9, 0));

		const dates = (await allRows(db)).map((row) => row.date.getTime());
		assert.deepEqual(
			dates,
			[
				at(2025, 3, 15),
				at(2025, 4, 15),
				at(2025, 5, 15),
				at(2025, 6, 15),
				at(2025, 7, 15),
			].map((d) => d.getTime()),
		);
	});

	it("writes nothing when swept twice at the same instant", async () => {
		await seedSource(db, { date: at(2025, 3, 15) });

		await backfillAllRecurring(db, NOW);
		const first = (await allRows(db)).length;
		await backfillAllRecurring(db, NOW);

		assert.equal((await allRows(db)).length, first);
	});

	it("sweeps every live subscription", async () => {
		await seedSource(db, { id: "netflix", date: at(2025, 4, 15) });
		await seedSource(db, {
			id: "gym",
			date: at(2025, 6, 8),
			recurringType: RECURRING_TYPE.weekly,
		});

		await backfillAllRecurring(db, NOW);

		const rows = await allRows(db);
		const live = rows.filter(
			(row) => row.recurringType !== RECURRING_TYPE.none,
		);
		assert.equal(rows.length, 5);
		assert.deepEqual(
			live.map((row) => row.date.getTime()),
			[at(2025, 6, 15).getTime(), at(2025, 6, 15).getTime()],
		);
		assert.deepEqual(
			live.map((row) => row.recurringType).sort(),
			[RECURRING_TYPE.weekly, RECURRING_TYPE.monthly].sort(),
		);
	});

	it("skips a soft-deleted subscription", async () => {
		await seedSource(db, { date: at(2025, 3, 15), deletedAt: NOW });

		await backfillAllRecurring(db, NOW);

		assert.equal((await allRows(db)).length, 0);
	});
});

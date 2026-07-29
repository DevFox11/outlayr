import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { startOfDay } from "@/domain/dates";
import { RECURRING_TYPE } from "@/domain/recurrence";
import {
	backfillAllRecurring,
	backfillRecurring,
	repairOrphanedRecurrence,
} from "./recurrence-backfill";
import { transactionsRepo } from "./transactions-core";

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

function everyRow(db: Database) {
	return db.select().from(transactions).orderBy(asc(transactions.date));
}

async function liveCarrier(db: Database) {
	const rows = await allRows(db);
	return rows.find((row) => row.recurringType !== RECURRING_TYPE.none) ?? null;
}

/** A soft-delete as it landed before the handover existed: schedule left intact. */
async function orphanCarrier(db: Database, id: string): Promise<void> {
	await db
		.update(transactions)
		.set({ deletedAt: NOW })
		.where(eq(transactions.id, id));
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

describe("transactionsRepo.remove over a schedule carrier", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("re-anchors the schedule on a successor instead of ending the chain", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const successor = await liveCarrier(db);
		assert.notEqual(successor, null);
		assert.equal(successor?.date.getTime(), at(2025, 7, 15).getTime());
		assert.equal(successor?.recurringType, RECURRING_TYPE.monthly);
		assert.equal(successor?.note, "Netflix");
		assert.equal(successor?.amount, 9.99);
		assert.equal(successor?.categoryId, "bills");
	});

	it("leaves the deleted charge deleted", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const live = await allRows(db);
		assert.equal(
			live.some((row) => row.id === carrier?.id),
			false,
		);
		assert.equal(
			live.some((row) => row.date.getTime() === at(2025, 6, 15).getTime()),
			false,
		);
	});

	it("retires the schedule on the tombstone", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const tombstone = (await everyRow(db)).find(
			(row) => row.id === carrier?.id,
		);
		assert.notEqual(tombstone?.deletedAt, null);
		assert.equal(tombstone?.recurringType, RECURRING_TYPE.none);
	});

	it("carries the coefficient and end date onto the successor", async () => {
		const id = await seedSource(db, {
			date: at(2025, 1, 15),
			recurringCoefficient: 2,
			recurringEndDate: at(2026, 3, 15),
		});
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const successor = await liveCarrier(db);
		assert.equal(successor?.date.getTime(), at(2025, 7, 15).getTime());
		assert.equal(successor?.recurringCoefficient, 2);
		assert.equal(
			successor?.recurringEndDate?.getTime(),
			at(2026, 3, 15).getTime(),
		);
	});

	it("ends the chain when the next occurrence is past the end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 10),
			recurringType: RECURRING_TYPE.weekly,
			recurringEndDate: at(2025, 6, 16),
		});

		await transactionsRepo.remove(db, id, NOW);

		assert.equal((await allRows(db)).length, 0);
	});

	it("stops the chain when the pending charge itself is deleted", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.remove(db, id, NOW);

		assert.equal((await allRows(db)).length, 0);
		const [tombstone] = await everyRow(db);
		assert.equal(tombstone?.recurringType, RECURRING_TYPE.none);
	});

	it("does not fabricate the charges a stale carrier missed", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });

		await transactionsRepo.remove(db, id, NOW);

		const live = await allRows(db);
		assert.equal(live.length, 1);
		assert.equal(live[0]?.date.getTime(), at(2025, 7, 15).getTime());
	});

	it("leaves a settled occurrence's delete alone", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const inert = (await allRows(db)).find(
			(row) => row.id !== id && row.recurringType === RECURRING_TYPE.none,
		);
		const before = (await allRows(db)).length;

		await transactionsRepo.remove(db, inert?.id ?? "", NOW);

		assert.equal((await allRows(db)).length, before - 1);
		assert.notEqual(await liveCarrier(db), null);
	});

	it("keeps sweeping the chain after the handover", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		await backfillAllRecurring(db, new Date(2025, 8, 20, 9, 0));

		assert.deepEqual(
			(await allRows(db)).map((row) => row.date.getTime()),
			[
				at(2025, 3, 15),
				at(2025, 4, 15),
				at(2025, 5, 15),
				at(2025, 7, 15),
				at(2025, 8, 15),
				at(2025, 9, 15),
			].map((d) => d.getTime()),
		);
	});

	it("soft-deletes a plain transaction without touching the ledger", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		await transactionsRepo.remove(db, id, NOW);

		assert.equal((await allRows(db)).length, 0);
		assert.equal((await everyRow(db)).length, 1);
	});
});

describe("transactionsRepo.stopRecurring", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("retires the schedule and keeps the charge that carried it", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		const before = (await allRows(db)).length;

		await transactionsRepo.stopRecurring(db, carrier?.id ?? "", NOW);

		assert.equal((await allRows(db)).length, before);
		assert.equal(await liveCarrier(db), null);
	});

	it("anchors no successor, so later sweeps generate nothing", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.stopRecurring(db, carrier?.id ?? "", NOW);

		await backfillAllRecurring(db, new Date(2025, 8, 20, 9, 0));

		assert.deepEqual(
			(await allRows(db)).map((row) => row.date.getTime()),
			[at(2025, 3, 15), at(2025, 4, 15), at(2025, 5, 15), at(2025, 6, 15)].map(
				(d) => d.getTime(),
			),
		);
	});

	// The distinction the delete path cannot draw: removing the pending charge
	// stops the chain by losing the charge, and this stops it while keeping it.
	it("leaves the pending charge on the books", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.stopRecurring(db, id, NOW);

		const live = await allRows(db);
		assert.equal(live.length, 1);
		assert.equal(live[0]?.date.getTime(), at(2025, 7, 15).getTime());
		assert.equal(live[0]?.recurringType, RECURRING_TYPE.none);
	});

	it("keeps the row listed as a member of its chain", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.stopRecurring(db, id, NOW);

		const [row] = await allRows(db);
		assert.equal(row?.onceRecurring, true);
	});

	it("leaves a tombstone the one-shot repair still has to read", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await orphanCarrier(db, id);

		await transactionsRepo.stopRecurring(db, id, NOW);

		const [tombstone] = await everyRow(db);
		assert.equal(tombstone?.recurringType, RECURRING_TYPE.monthly);
	});
});

describe("repairOrphanedRecurrence", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("reinstates a chain whose carrier was deleted without a handover", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");
		assert.equal(await liveCarrier(db), null);

		assert.equal(await repairOrphanedRecurrence(db, NOW), 1);

		const revived = await liveCarrier(db);
		assert.equal(revived?.date.getTime(), at(2025, 7, 15).getTime());
		assert.equal(revived?.recurringType, RECURRING_TYPE.monthly);
		assert.equal(revived?.note, "Netflix");
	});

	it("clears the tombstone it repaired so a rerun cannot double-charge", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");

		await repairOrphanedRecurrence(db, NOW);

		const tombstone = (await everyRow(db)).find(
			(row) => row.id === carrier?.id,
		);
		assert.equal(tombstone?.recurringType, RECURRING_TYPE.none);
	});

	it("is a no-op on a healthy ledger", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const before = (await everyRow(db)).length;

		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		assert.equal((await everyRow(db)).length, before);
		assert.equal(
			(await liveCarrier(db))?.date.getTime(),
			at(2025, 6, 15).getTime(),
		);
	});

	it("only ever runs once, so a later tombstone is not swept up", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");
		const before = (await everyRow(db)).length;

		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		assert.equal((await everyRow(db)).length, before);
	});

	it("does not double-charge a chain the delete handover already re-anchored", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);
		const before = (await everyRow(db)).length;

		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		assert.equal((await everyRow(db)).length, before);
	});

	it("does not reinstate a deleted pending charge", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });
		await orphanCarrier(db, id);

		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		assert.equal((await allRows(db)).length, 0);
	});

	it("retires a tombstone whose chain has run past its end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 10),
			recurringType: RECURRING_TYPE.weekly,
			recurringEndDate: at(2025, 6, 16),
		});
		await orphanCarrier(db, id);

		assert.equal(await repairOrphanedRecurrence(db, NOW), 0);

		assert.equal((await allRows(db)).length, 0);
		const [tombstone] = await everyRow(db);
		assert.equal(tombstone?.recurringType, RECURRING_TYPE.none);
	});
});

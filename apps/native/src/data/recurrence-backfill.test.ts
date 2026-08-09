import BetterSqlite3 from "better-sqlite3";
import { asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { startOfDay } from "@/domain/dates";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { backfillAllRecurring, backfillRecurring, repairOrphanedRecurrence } from "./recurrence-backfill";
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
			imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			recurringAnchorDay integer,
			reminderLeadDays integer,
			categoryId text,
			accountId text,
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
	deletedAt?: Date | null;
	id?: string;
	onceRecurring?: boolean;
	recurringAnchorDay?: number | null;
	recurringCoefficient?: number;
	recurringEndDate?: Date | null;
	recurringType?: number;
	reminderLeadDays?: number | null;
}

async function seedSource(db: Database, overrides: SourceOverrides): Promise<string> {
	const id = overrides.id ?? "src";
	await db.insert(transactions).values({
		amount: 9.99,
		categoryId: "bills",
		currency: "USD",
		customColor: "#FF0000",
		date: overrides.date,
		day: startOfDay(overrides.date),
		deletedAt: overrides.deletedAt ?? null,
		details: "family plan",
		emoji: null,
		icon: "Tv01",
		id,
		imageColor: null,
		imageUri: null,
		income: false,
		month: startOfDay(overrides.date),
		note: "Netflix",
		onceRecurring: overrides.onceRecurring ?? true,
		recurringAnchorDay: overrides.recurringAnchorDay ?? null,
		recurringCoefficient: overrides.recurringCoefficient ?? 1,
		recurringEndDate: overrides.recurringEndDate ?? null,
		recurringType: overrides.recurringType ?? RECURRING_TYPE.monthly,
		reminderLeadDays: overrides.reminderLeadDays ?? null,
		updatedAt: NOW,
	});
	return id;
}

function allRows(db: Database) {
	return db.select().from(transactions).where(isNull(transactions.deletedAt)).orderBy(asc(transactions.date));
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
	await db.update(transactions).set({ deletedAt: NOW }).where(eq(transactions.id, id));
}

describe("backfillRecurring", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("keeps a month-end schedule on its own day across the whole walk", async () => {
		const id = await seedSource(db, { date: at(2025, 1, 31) });

		await backfillRecurring(db, id, NOW);

		const rows = await generatedRows(db, id);
		expect(rows.map((row) => row.date.getDate())).toStrictEqual([28, 31, 30, 31]);
	});

	it("walks from the stored anchor when the carrier's own day already clamped", async () => {
		const id = await seedSource(db, {
			date: at(2025, 2, 28),
			recurringAnchorDay: 31,
		});

		await backfillRecurring(db, id, NOW);

		const rows = await generatedRows(db, id);
		expect(rows.map((row) => row.date.getDate())).toStrictEqual([31, 30, 31]);
	});

	it("hands the anchor to the row that inherits the schedule", async () => {
		const id = await seedSource(db, { date: at(2025, 1, 31) });

		await backfillRecurring(db, id, NOW);

		const carrier = await liveCarrier(db);
		expect(carrier?.recurringAnchorDay).toBe(31);
	});

	it("materializes every past occurrence and retires the source (Case A)", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(3);
		expect(generated.map((row) => row.date.getTime())).toStrictEqual(
			[at(2025, 4, 15), at(2025, 5, 15), at(2025, 6, 15)].map((d) => startOfDay(d).getTime())
		);

		for (const row of generated) {
			expect(row.onceRecurring).toBe(true);
			expect(row.amount).toBe(9.99);
			expect(row.income).toBe(false);
			expect(row.currency).toBe("USD");
			expect(row.note).toBe("Netflix");
			expect(row.details).toBe("family plan");
			expect(row.icon).toBe("Tv01");
			expect(row.customColor).toBe("#FF0000");
			expect(row.categoryId).toBe("bills");
			expect(row.day.getTime()).toBe(startOfDay(row.date).getTime());
		}

		const source = (await allRows(db)).find((row) => row.id === id);
		expect(source?.recurringType).toBe(RECURRING_TYPE.none);
		expect(source?.date.getTime()).toBe(startOfDay(at(2025, 3, 15)).getTime());
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
		expect(newest?.date.getTime()).toBe(startOfDay(at(2025, 6, 15)).getTime());
		expect(newest?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(newest?.recurringCoefficient).toBe(1);
		expect(newest?.recurringEndDate?.getTime()).toBe(at(2026, 3, 15).getTime());

		for (const row of generated.slice(0, -1)) {
			expect(row.recurringType).toBe(RECURRING_TYPE.none);
			expect(row.recurringCoefficient).toBe(1);
			expect(row.recurringEndDate).toBe(null);
		}
	});

	it("hands the reminder notice to the new carrier and leaves it nowhere else", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			reminderLeadDays: 3,
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		const newest = generated.at(-1);
		expect(newest?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(newest?.reminderLeadDays).toBe(3);
		for (const row of generated.slice(0, -1)) {
			expect(row.reminderLeadDays).toBe(null);
		}
		const source = (await allRows(db)).find((row) => row.id === id);
		expect(source?.reminderLeadDays).toBe(null);
	});

	it("keeps a same-day notice, which is not the off state", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			reminderLeadDays: 0,
		});

		await backfillRecurring(db, id, NOW);

		const newest = (await generatedRows(db, id)).at(-1);
		expect(newest?.reminderLeadDays).toBe(0);
	});

	it("leaves the notice off a chain that has run out of schedule to carry", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringEndDate: at(2025, 6, 20),
			reminderLeadDays: 7,
		});

		await backfillRecurring(db, id, NOW);

		for (const row of await generatedRows(db, id)) {
			expect(row.reminderLeadDays).toBe(null);
		}
	});

	it("leaves the newest occurrence inert when the next charge is past the end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringEndDate: at(2025, 6, 20),
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(3);
		for (const row of generated) {
			expect(row.recurringType).toBe(RECURRING_TYPE.none);
		}
	});

	it("materializes today's single occurrence (Case B)", async () => {
		const id = await seedSource(db, { date: at(2025, 5, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(1);
		expect(generated[0]?.date.getTime()).toBe(startOfDay(at(2025, 6, 15)).getTime());
		expect(generated[0]?.recurringType).toBe(RECURRING_TYPE.monthly);
		const source = (await allRows(db)).find((row) => row.id === id);
		expect(source?.recurringType).toBe(RECURRING_TYPE.none);
	});

	it("stops generation at a past end date (Case B — end limit)", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			recurringEndDate: at(2025, 5, 15),
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(2);
		expect(generated.map((row) => row.date.getTime())).toStrictEqual(
			[at(2025, 4, 15), at(2025, 5, 15)].map((d) => startOfDay(d).getTime())
		);
		const past = generated.some((row) => row.date.getTime() > startOfDay(at(2025, 5, 15)).getTime());
		expect(past).toBe(false);
	});

	it("is a no-op for a future-dated subscription (Case C)", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(0);
		const source = (await allRows(db)).find((row) => row.id === id);
		expect(source?.recurringType).toBe(RECURRING_TYPE.monthly);
	});

	it("makes forward progress under a malformed coefficient (guard)", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 12),
			recurringCoefficient: 0,
			recurringType: RECURRING_TYPE.daily,
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(3);
		const times = generated.map((row) => row.date.getTime());
		expect(times).toStrictEqual(
			[at(2025, 6, 13), at(2025, 6, 14), at(2025, 6, 15)].map((d) => startOfDay(d).getTime())
		);
		for (let i = 1; i < times.length; i += 1) {
			expect((times[i] ?? 0) > (times[i - 1] ?? 0)).toBeTruthy();
		}
		const source = (await allRows(db)).find((row) => row.id === id);
		expect(source?.recurringType).toBe(RECURRING_TYPE.none);
	});

	it("leaves a non-recurring source untouched", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		await backfillRecurring(db, id, NOW);

		const generated = await generatedRows(db, id);
		expect(generated.length).toBe(0);
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
		expect(dates).toStrictEqual(
			[at(2025, 3, 15), at(2025, 4, 15), at(2025, 5, 15), at(2025, 6, 15), at(2025, 7, 15)].map((d) => d.getTime())
		);
	});

	it("writes nothing when swept twice at the same instant", async () => {
		await seedSource(db, { date: at(2025, 3, 15) });

		await backfillAllRecurring(db, NOW);
		const first = (await allRows(db)).length;
		await backfillAllRecurring(db, NOW);

		expect((await allRows(db)).length).toBe(first);
	});

	// The carrier is a different row after every sweep, so a notice that survives
	// two of them is the only proof the hand-off is not a one-time copy.
	it("keeps the notice on whichever row carries the schedule", async () => {
		await seedSource(db, { date: at(2025, 3, 15), reminderLeadDays: 2 });

		await backfillAllRecurring(db, NOW);
		await backfillAllRecurring(db, new Date(2025, 6, 20, 9, 0));

		const rows = await allRows(db);
		const carrying = rows.filter((row) => row.reminderLeadDays != null);
		expect(carrying.map((row) => row.date.getTime())).toStrictEqual([at(2025, 7, 15).getTime()]);
		expect(carrying[0]?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(carrying[0]?.reminderLeadDays).toBe(2);
	});

	it("sweeps every live subscription", async () => {
		await seedSource(db, { date: at(2025, 4, 15), id: "netflix" });
		await seedSource(db, {
			date: at(2025, 6, 8),
			id: "gym",
			recurringType: RECURRING_TYPE.weekly,
		});

		await backfillAllRecurring(db, NOW);

		const rows = await allRows(db);
		const live = rows.filter((row) => row.recurringType !== RECURRING_TYPE.none);
		expect(rows.length).toBe(5);
		expect(live.map((row) => row.date.getTime())).toStrictEqual([at(2025, 6, 15).getTime(), at(2025, 6, 15).getTime()]);
		expect(live.map((row) => row.recurringType).sort()).toStrictEqual(
			[RECURRING_TYPE.weekly, RECURRING_TYPE.monthly].sort()
		);
	});

	it("skips a soft-deleted subscription", async () => {
		await seedSource(db, { date: at(2025, 3, 15), deletedAt: NOW });

		await backfillAllRecurring(db, NOW);

		expect((await allRows(db)).length).toBe(0);
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
		expect(successor).not.toBe(null);
		expect(successor?.date.getTime()).toBe(at(2025, 7, 15).getTime());
		expect(successor?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(successor?.note).toBe("Netflix");
		expect(successor?.amount).toBe(9.99);
		expect(successor?.categoryId).toBe("bills");
	});

	it("leaves the deleted charge deleted", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const live = await allRows(db);
		expect(live.some((row) => row.id === carrier?.id)).toBe(false);
		expect(live.some((row) => row.date.getTime() === at(2025, 6, 15).getTime())).toBe(false);
	});

	it("retires the schedule on the tombstone", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);

		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		const tombstone = (await everyRow(db)).find((row) => row.id === carrier?.id);
		expect(tombstone?.deletedAt).not.toBe(null);
		expect(tombstone?.recurringType).toBe(RECURRING_TYPE.none);
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
		expect(successor?.date.getTime()).toBe(at(2025, 7, 15).getTime());
		expect(successor?.recurringCoefficient).toBe(2);
		expect(successor?.recurringEndDate?.getTime()).toBe(at(2026, 3, 15).getTime());
	});

	it("ends the chain when the next occurrence is past the end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 10),
			recurringEndDate: at(2025, 6, 16),
			recurringType: RECURRING_TYPE.weekly,
		});

		await transactionsRepo.remove(db, id, NOW);

		expect((await allRows(db)).length).toBe(0);
	});

	it("stops the chain when the pending charge itself is deleted", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.remove(db, id, NOW);

		expect((await allRows(db)).length).toBe(0);
		const [tombstone] = await everyRow(db);
		expect(tombstone?.recurringType).toBe(RECURRING_TYPE.none);
	});

	it("does not fabricate the charges a stale carrier missed", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });

		await transactionsRepo.remove(db, id, NOW);

		const live = await allRows(db);
		expect(live.length).toBe(1);
		expect(live[0]?.date.getTime()).toBe(at(2025, 7, 15).getTime());
	});

	it("leaves a settled occurrence's delete alone", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const inert = (await allRows(db)).find((row) => row.id !== id && row.recurringType === RECURRING_TYPE.none);
		const before = (await allRows(db)).length;

		await transactionsRepo.remove(db, inert?.id ?? "", NOW);

		expect((await allRows(db)).length).toBe(before - 1);
		expect(await liveCarrier(db)).not.toBe(null);
	});

	it("keeps sweeping the chain after the handover", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);

		await backfillAllRecurring(db, new Date(2025, 8, 20, 9, 0));

		expect((await allRows(db)).map((row) => row.date.getTime())).toStrictEqual(
			[at(2025, 3, 15), at(2025, 4, 15), at(2025, 5, 15), at(2025, 7, 15), at(2025, 8, 15), at(2025, 9, 15)].map((d) =>
				d.getTime()
			)
		);
	});

	it("soft-deletes a plain transaction without touching the ledger", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		await transactionsRepo.remove(db, id, NOW);

		expect((await allRows(db)).length).toBe(0);
		expect((await everyRow(db)).length).toBe(1);
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

		expect((await allRows(db)).length).toBe(before);
		expect(await liveCarrier(db)).toBe(null);
	});

	it("anchors no successor, so later sweeps generate nothing", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.stopRecurring(db, carrier?.id ?? "", NOW);

		await backfillAllRecurring(db, new Date(2025, 8, 20, 9, 0));

		expect((await allRows(db)).map((row) => row.date.getTime())).toStrictEqual(
			[at(2025, 3, 15), at(2025, 4, 15), at(2025, 5, 15), at(2025, 6, 15)].map((d) => d.getTime())
		);
	});

	// The distinction the delete path cannot draw: removing the pending charge
	// stops the chain by losing the charge, and this stops it while keeping it.
	it("leaves the pending charge on the books", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.stopRecurring(db, id, NOW);

		const live = await allRows(db);
		expect(live.length).toBe(1);
		expect(live[0]?.date.getTime()).toBe(at(2025, 7, 15).getTime());
		expect(live[0]?.recurringType).toBe(RECURRING_TYPE.none);
	});

	it("keeps the row listed as a member of its chain", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });

		await transactionsRepo.stopRecurring(db, id, NOW);

		const [row] = await allRows(db);
		expect(row?.onceRecurring).toBe(true);
	});

	it("leaves a tombstone the one-shot repair still has to read", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await orphanCarrier(db, id);

		await transactionsRepo.stopRecurring(db, id, NOW);

		const [tombstone] = await everyRow(db);
		expect(tombstone?.recurringType).toBe(RECURRING_TYPE.monthly);
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
		expect(await liveCarrier(db)).toBe(null);

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(1);

		const revived = await liveCarrier(db);
		expect(revived?.date.getTime()).toBe(at(2025, 7, 15).getTime());
		expect(revived?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(revived?.note).toBe("Netflix");
	});

	it("moves the notice onto the revived carrier and off the tombstone", async () => {
		const id = await seedSource(db, {
			date: at(2025, 3, 15),
			reminderLeadDays: 1,
		});
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");

		await repairOrphanedRecurrence(db, NOW);

		expect((await liveCarrier(db))?.reminderLeadDays).toBe(1);
		const tombstone = (await everyRow(db)).find((row) => row.id === carrier?.id);
		expect(tombstone?.reminderLeadDays).toBe(null);
	});

	it("clears the tombstone it repaired so a rerun cannot double-charge", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");

		await repairOrphanedRecurrence(db, NOW);

		const tombstone = (await everyRow(db)).find((row) => row.id === carrier?.id);
		expect(tombstone?.recurringType).toBe(RECURRING_TYPE.none);
	});

	it("is a no-op on a healthy ledger", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const before = (await everyRow(db)).length;

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		expect((await everyRow(db)).length).toBe(before);
		expect((await liveCarrier(db))?.date.getTime()).toBe(at(2025, 6, 15).getTime());
	});

	it("only ever runs once, so a later tombstone is not swept up", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		const carrier = await liveCarrier(db);
		await orphanCarrier(db, carrier?.id ?? "");
		const before = (await everyRow(db)).length;

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		expect((await everyRow(db)).length).toBe(before);
	});

	it("does not double-charge a chain the delete handover already re-anchored", async () => {
		const id = await seedSource(db, { date: at(2025, 3, 15) });
		await backfillRecurring(db, id, NOW);
		const carrier = await liveCarrier(db);
		await transactionsRepo.remove(db, carrier?.id ?? "", NOW);
		const before = (await everyRow(db)).length;

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		expect((await everyRow(db)).length).toBe(before);
	});

	it("does not reinstate a deleted pending charge", async () => {
		const id = await seedSource(db, { date: at(2025, 7, 15) });
		await orphanCarrier(db, id);

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		expect((await allRows(db)).length).toBe(0);
	});

	it("retires a tombstone whose chain has run past its end date", async () => {
		const id = await seedSource(db, {
			date: at(2025, 6, 10),
			recurringEndDate: at(2025, 6, 16),
			recurringType: RECURRING_TYPE.weekly,
		});
		await orphanCarrier(db, id);

		expect(await repairOrphanedRecurrence(db, NOW)).toBe(0);

		expect((await allRows(db)).length).toBe(0);
		const [tombstone] = await everyRow(db);
		expect(tombstone?.recurringType).toBe(RECURRING_TYPE.none);
	});
});

/**
 * The duplicate-charge case from §8.1 of `docs/convex-sync-design.md`: two synced
 * devices both sweep the same subscription, and with a freshly minted id each
 * would insert its own copy of every charge.
 */
describe("occurrence identity across devices", () => {
	it("derives the same ids on two devices sweeping the same schedule", async () => {
		const first = makeDb();
		const second = makeDb();
		await seedSource(first, { date: at(2025, 3, 15) });
		await seedSource(second, { date: at(2025, 3, 15) });

		await backfillRecurring(first, "src", NOW);
		await backfillRecurring(second, "src", NOW);

		const left = (await everyRow(first)).map((row) => row.id);
		const right = (await everyRow(second)).map((row) => row.id);
		expect(left.length > 1).toBeTruthy();
		expect(left).toStrictEqual(right);
	});

	it("upserts rather than doubling a charge already replicated in", async () => {
		const db = makeDb();
		await seedSource(db, { date: at(2025, 3, 15) });
		const solo = makeDb();
		await seedSource(solo, { date: at(2025, 3, 15) });
		await backfillRecurring(solo, "src", NOW);
		const [replicated] = await generatedRows(solo, "src");

		// The peer's copy of the first charge, pulled in before this device swept.
		await db.insert(transactions).values({ ...replicated, note: "from-peer" });
		await backfillRecurring(db, "src", NOW);

		const rows = await everyRow(db);
		expect(rows.filter((row) => row.id === replicated.id).length).toBe(1);
		expect(rows.find((row) => row.id === replicated.id)?.note).toBe("from-peer");
		expect(rows.length).toBe((await everyRow(solo)).length);
	});

	it("keeps a peer's deletion of one occurrence deleted", async () => {
		const db = makeDb();
		await seedSource(db, { date: at(2025, 3, 15) });
		const solo = makeDb();
		await seedSource(solo, { date: at(2025, 3, 15) });
		await backfillRecurring(solo, "src", NOW);
		const [replicated] = await generatedRows(solo, "src");

		await db.insert(transactions).values({ ...replicated, deletedAt: NOW, updatedAt: NOW });
		await backfillRecurring(db, "src", NOW);

		const raised = (await allRows(db)).find((row) => row.id === replicated.id);
		expect(raised).toBe(undefined);
	});

	it("gives each occurrence in a chain its own id", async () => {
		const db = makeDb();
		await seedSource(db, { date: at(2025, 1, 15) });

		await backfillRecurring(db, "src", NOW);

		const ids = (await everyRow(db)).map((row) => row.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("anchors the same successor on two devices deleting the same carrier", async () => {
		const first = makeDb();
		const second = makeDb();
		await seedSource(first, { date: at(2025, 6, 10) });
		await seedSource(second, { date: at(2025, 6, 10) });

		await transactionsRepo.remove(first, "src", NOW);
		await transactionsRepo.remove(second, "src", NOW);

		expect((await everyRow(first)).map((row) => row.id)).toStrictEqual((await everyRow(second)).map((row) => row.id));
	});
});

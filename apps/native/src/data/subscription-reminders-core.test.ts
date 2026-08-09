import BetterSqlite3 from "better-sqlite3";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { startOfDay } from "@/domain/dates";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { setMeta } from "./app-meta-core";
import { pendingReminderPlan, reminderCandidates } from "./subscription-reminders-core";

const NOW = new Date(2025, 5, 15, 10, 30);
const NINE_AM = { hour: 9, minute: 0 };
const at = (y: number, m: number, day: number, hour = 0, minute = 0): Date => new Date(y, m - 1, day, hour, minute);

type LandingRow = (string | number)[];

const byLocalId = (a: LandingRow, b: LandingRow): number => String(a[0]).localeCompare(String(b[0]));

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
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

interface CarrierOverrides {
	amount?: number;
	currency?: string | null;
	/** Its LAST charge, clock time included — the landing must not be read off it. */
	date: Date;
	deletedAt?: Date | null;
	id?: string;
	note?: string;
	recurringCoefficient?: number;
	recurringEndDate?: Date | null;
	recurringType?: number;
	reminderLeadDays?: number | null;
}

async function seedCarrier(db: Database, overrides: CarrierOverrides): Promise<string> {
	const id = overrides.id ?? "src";
	await db.insert(transactions).values({
		amount: overrides.amount ?? 9.99,
		categoryId: "bills",
		currency: overrides.currency === undefined ? "USD" : overrides.currency,
		date: overrides.date,
		day: startOfDay(overrides.date),
		deletedAt: overrides.deletedAt ?? null,
		details: null,
		id,
		income: false,
		month: startOfDay(overrides.date),
		note: overrides.note ?? "Netflix",
		onceRecurring: true,
		recurringCoefficient: overrides.recurringCoefficient ?? 1,
		recurringEndDate: overrides.recurringEndDate ?? null,
		recurringType: overrides.recurringType ?? RECURRING_TYPE.monthly,
		reminderLeadDays: overrides.reminderLeadDays ?? null,
		updatedAt: NOW,
	});
	return id;
}

function everyRow(db: Database) {
	return db.select().from(transactions).orderBy(asc(transactions.id));
}

describe("reminderCandidates", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("names the charge after today, never today's or one already taken", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15, 14, 30),
			reminderLeadDays: 2,
		});

		const candidates = await reminderCandidates(db, NOW);

		expect(candidates.length).toBe(1);
		expect(candidates[0]?.localId).toBe("src");
		expect(candidates[0]?.leadDays).toBe(2);
		expect(candidates[0]?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
		expect((candidates[0]?.landing.getTime() ?? 0) > NOW.getTime()).toBeTruthy();
	});

	// Reading the landing off `date` would carry the last charge's clock time onto
	// every future one, so the announced day would drift by hours per hop.
	it("dates the landing from the ledger day, not the last charge's clock time", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15, 23, 45),
			reminderLeadDays: 0,
		});

		const [candidate] = await reminderCandidates(db, NOW);

		expect(candidate?.landing.getHours()).toBe(0);
		expect(candidate?.landing.getMinutes()).toBe(0);
		expect(candidate?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
	});

	it("keeps a future-dated pending charge as its own landing", async () => {
		await seedCarrier(db, {
			date: at(2025, 7, 15, 8, 0),
			reminderLeadDays: 3,
		});

		const [candidate] = await reminderCandidates(db, NOW);

		expect(candidate?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
	});

	it("carries the copy a notice has to print", async () => {
		await seedCarrier(db, {
			amount: 11.99,
			currency: "EUR",
			date: at(2025, 3, 15),
			note: "Spotify",
			reminderLeadDays: 1,
		});

		const [candidate] = await reminderCandidates(db, NOW);

		expect(candidate?.note).toBe("Spotify");
		expect(candidate?.amount).toBe(11.99);
		expect(candidate?.currency).toBe("EUR");
	});

	it("stamps a row that stored no currency with the ledger's", async () => {
		await setMeta(db, "currency", "MXN");
		await seedCarrier(db, {
			currency: null,
			date: at(2025, 3, 15),
			reminderLeadDays: 1,
		});

		const [candidate] = await reminderCandidates(db, NOW);

		expect(candidate?.currency).toBe("MXN");
	});

	it("falls back to the app default when the ledger names no currency", async () => {
		await seedCarrier(db, {
			currency: null,
			date: at(2025, 3, 15),
			reminderLeadDays: 1,
		});

		const [candidate] = await reminderCandidates(db, NOW);

		expect(candidate?.currency).toBe("USD");
	});

	it("yields nothing for a carrier with no notice set", async () => {
		await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: null });

		expect(await reminderCandidates(db, NOW)).toStrictEqual([]);
	});

	it("keeps a same-day notice, which is not the off state", async () => {
		await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: 0 });

		const candidates = await reminderCandidates(db, NOW);

		expect(candidates.length).toBe(1);
		expect(candidates[0]?.leadDays).toBe(0);
	});

	it("yields nothing for a soft-deleted carrier", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15),
			deletedAt: NOW,
			reminderLeadDays: 2,
		});

		expect(await reminderCandidates(db, NOW)).toStrictEqual([]);
	});

	// Every retire path clears the column, but a peer's hand-off replicates in
	// whatever it wrote — so the notice alone can never be the predicate.
	it("yields nothing for a retired row still holding a notice", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15),
			recurringType: RECURRING_TYPE.none,
			reminderLeadDays: 2,
		});

		expect(await reminderCandidates(db, NOW)).toStrictEqual([]);
	});

	it("yields nothing once the chain has run past its end date", async () => {
		await seedCarrier(db, {
			date: at(2025, 6, 10),
			recurringEndDate: at(2025, 6, 16),
			recurringType: RECURRING_TYPE.weekly,
			reminderLeadDays: 1,
		});

		expect(await reminderCandidates(db, NOW)).toStrictEqual([]);
	});

	it("resolves every live carrier, each on its own cadence", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15),
			id: "netflix",
			reminderLeadDays: 2,
		});
		await seedCarrier(db, {
			date: at(2025, 6, 10),
			id: "gym",
			recurringType: RECURRING_TYPE.weekly,
			reminderLeadDays: 1,
		});

		const candidates = await reminderCandidates(db, NOW);

		expect(
			candidates.map((candidate) => [candidate.localId, candidate.landing.getTime()]).sort(byLocalId)
		).toStrictEqual(
			[
				["gym", at(2025, 6, 17).getTime()],
				["netflix", at(2025, 7, 15).getTime()],
			].sort(byLocalId)
		);
	});
});

describe("pendingReminderPlan", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("arms the notice the lead and the time ask for", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15, 14, 30),
			reminderLeadDays: 2,
		});

		const arm = await pendingReminderPlan(db, NOW, NINE_AM);

		expect(arm.length).toBe(1);
		expect(arm[0]?.id).toBe("outlayr.sub-due.src");
		expect(arm[0]?.localId).toBe("src");
		expect(arm[0]?.fireAt.getTime()).toBe(at(2025, 7, 13, 9, 0).getTime());
	});

	it("drops a notice whose fire time has already passed", async () => {
		await seedCarrier(db, {
			date: at(2025, 6, 10),
			recurringType: RECURRING_TYPE.weekly,
			reminderLeadDays: 7,
		});

		expect(await pendingReminderPlan(db, NOW, NINE_AM)).toStrictEqual([]);
	});

	it("keeps the soonest notices when the cap truncates", async () => {
		await seedCarrier(db, {
			date: at(2025, 3, 15),
			id: "netflix",
			reminderLeadDays: 2,
		});
		await seedCarrier(db, {
			date: at(2025, 6, 10),
			id: "gym",
			recurringType: RECURRING_TYPE.weekly,
			reminderLeadDays: 1,
		});

		const arm = await pendingReminderPlan(db, NOW, NINE_AM, 1);

		expect(arm.map((armed) => armed.localId)).toStrictEqual(["gym"]);
	});

	it("writes nothing", async () => {
		await seedCarrier(db, { date: at(2025, 3, 15), reminderLeadDays: 2 });
		const before = await everyRow(db);

		await pendingReminderPlan(db, NOW, NINE_AM);

		expect(await everyRow(db)).toStrictEqual(before);
	});

	// The plan is what the scheduler hands to iOS, so a request that reached it
	// without its copy would announce a bare identifier.
	it("carries the copy and the landing each notice has to print", async () => {
		await seedCarrier(db, {
			amount: 11.99,
			currency: "EUR",
			date: at(2025, 3, 15),
			note: "Spotify",
			reminderLeadDays: 2,
		});

		const [reminder] = await pendingReminderPlan(db, NOW, NINE_AM);

		expect(reminder?.note).toBe("Spotify");
		expect(reminder?.amount).toBe(11.99);
		expect(reminder?.currency).toBe("EUR");
		expect(reminder?.landing.getTime()).toBe(at(2025, 7, 15).getTime());
	});

	it("resolves a row with no currency of its own against the ledger's", async () => {
		await setMeta(db, "currency", "MXN");
		await seedCarrier(db, {
			currency: null,
			date: at(2025, 3, 15),
			reminderLeadDays: 2,
		});

		const [reminder] = await pendingReminderPlan(db, NOW, NINE_AM);

		expect(reminder?.currency).toBe("MXN");
	});

	// Two carriers, one truncated away: the surviving request has to keep ITS own
	// copy, not the row the plan dropped.
	it("keeps each notice's copy with its own request under the cap", async () => {
		await seedCarrier(db, {
			amount: 9.99,
			date: at(2025, 3, 15),
			id: "netflix",
			note: "Netflix",
			reminderLeadDays: 2,
		});
		await seedCarrier(db, {
			amount: 40,
			date: at(2025, 6, 10),
			id: "gym",
			note: "Gym",
			recurringType: RECURRING_TYPE.weekly,
			reminderLeadDays: 1,
		});

		const arm = await pendingReminderPlan(db, NOW, NINE_AM, 1);

		expect(arm.length).toBe(1);
		expect(arm[0]?.localId).toBe("gym");
		expect(arm[0]?.note).toBe("Gym");
		expect(arm[0]?.amount).toBe(40);
	});
});

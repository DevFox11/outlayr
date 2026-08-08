import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { accounts, exchangeRates, transactions } from "@/db/schema";
import { accountBalance } from "@/domain/account-balance";
import { buildRateTable } from "@/domain/valuation";
import {
	accountsRepo,
	getAccountById,
	getLastUsedAccount,
	rememberLastUsedAccount,
} from "./accounts-core";
import { accountCellQuery, toCurrencyCells } from "./cell-query";
import { transactionsRepo } from "./transactions-core";

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			currency text NOT NULL,
			initialBalance real NOT NULL DEFAULT 0,
			initialBalanceUsd real,
			initialBalanceDate integer NOT NULL,
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			imageKey text,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer NOT NULL,
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
		CREATE TABLE exchangeRates (
			quote text NOT NULL,
			rateType text NOT NULL,
			date text NOT NULL,
			rate real NOT NULL,
			source text NOT NULL,
			fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

async function addRate(
	db: Database,
	quote: string,
	date: string,
	rate: number,
): Promise<void> {
	await db.insert(exchangeRates).values({
		quote,
		rateType: "official",
		date,
		rate,
		source: "frankfurter",
		fetchedAt: 1,
	});
}

const JAN_5 = new Date("2026-01-05T12:00:00.000Z");

describe("accountsRepo.create", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("stamps identity, dates, and an appended sortOrder", async () => {
		const before = Date.now();
		const first = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});
		const second = await accountsRepo.create(db, {
			name: "Savings",
			currency: "USD",
		});

		const row = getAccountById(db, first);
		expect(row?.name).toBe("Checking");
		expect(row?.currency).toBe("USD");
		expect(row?.initialBalance).toBe(0);
		expect(row?.sortOrder).toBe(0);
		expect(row?.dateCreated.getTime()).toBeGreaterThanOrEqual(before);
		expect(row?.updatedAt.getTime()).toBe(row?.dateCreated.getTime());
		expect(row?.initialBalanceDate.getTime()).toBeGreaterThanOrEqual(before);
		expect(row?.deletedAt).toBe(null);
		expect(getAccountById(db, second)?.sortOrder).toBe(1);
	});

	it("freezes a USD opening balance at rate 1", async () => {
		const id = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
			initialBalance: 250,
		});

		expect(getAccountById(db, id)?.initialBalanceUsd).toBe(250);
	});

	it("freezes a foreign opening balance at the rate of its own day", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);

		const id = await accountsRepo.create(db, {
			name: "Girokonto",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});

		const row = getAccountById(db, id);
		expect(row?.initialBalanceDate.getTime()).toBe(JAN_5.getTime());
		expect(row?.initialBalanceUsd).toBe(125);
	});

	it("keeps the sign of a negative opening balance through the freeze", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);

		const id = await accountsRepo.create(db, {
			name: "Overdrawn",
			currency: "EUR",
			initialBalance: -40,
			initialBalanceDate: JAN_5,
		});

		const row = getAccountById(db, id);
		expect(row?.initialBalance).toBe(-40);
		expect(row?.initialBalanceUsd).toBe(-50);
	});

	it("leaves the freeze null when no rate reaches the day", async () => {
		const id = await accountsRepo.create(db, {
			name: "Cash",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});

		expect(getAccountById(db, id)?.initialBalanceUsd).toBe(null);
	});
});

describe("accountsRepo.update", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("keeps the frozen USD value when the money fields do not move", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);
		const id = await accountsRepo.create(db, {
			name: "Girokonto",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});
		await db.delete(exchangeRates);

		await accountsRepo.update(db, id, { name: "Konto", icon: "Bank" });

		const row = getAccountById(db, id);
		expect(row?.name).toBe("Konto");
		expect(row?.icon).toBe("Bank");
		expect(row?.initialBalanceUsd).toBe(125);
	});

	it("re-freezes when the opening balance moves", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);
		const id = await accountsRepo.create(db, {
			name: "Girokonto",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});

		await accountsRepo.update(db, id, { initialBalance: 200 });

		expect(getAccountById(db, id)?.initialBalanceUsd).toBe(250);
	});

	it("re-freezes when the currency moves", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);
		const id = await accountsRepo.create(db, {
			name: "Konto",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});

		await accountsRepo.update(db, id, { currency: "USD" });

		expect(getAccountById(db, id)?.initialBalanceUsd).toBe(100);
	});

	it("stamps updatedAt", async () => {
		const id = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});
		const created = getAccountById(db, id)?.updatedAt.getTime() ?? 0;
		await new Promise((resolve) => setTimeout(resolve, 2));

		await accountsRepo.update(db, id, { name: "Renamed" });

		expect(getAccountById(db, id)?.updatedAt.getTime()).toBeGreaterThan(
			created,
		);
	});
});

describe("accountsRepo lifecycle", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("softDelete tombstones and drops the row from listActive", async () => {
		const first = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});
		const second = await accountsRepo.create(db, {
			name: "Savings",
			currency: "USD",
		});

		await accountsRepo.softDelete(db, first);

		const rows = await accountsRepo.listActive(db);
		expect(rows.map((row) => row.id)).toStrictEqual([second]);
		const gone = (await db.select().from(accounts)).find(
			(row) => row.id === first,
		);
		expect(gone?.deletedAt).not.toBe(null);
		expect(gone?.updatedAt.getTime()).toBe(gone?.deletedAt?.getTime());
		expect(getAccountById(db, first)).toBe(null);
	});

	it("reorder assigns each id its array index and stamps updatedAt", async () => {
		const a = await accountsRepo.create(db, { name: "A", currency: "USD" });
		const b = await accountsRepo.create(db, { name: "B", currency: "USD" });
		const c = await accountsRepo.create(db, { name: "C", currency: "USD" });

		await accountsRepo.reorder(db, [c, a, b]);

		const rows = await accountsRepo.listActive(db);
		expect(rows.map((row) => row.id)).toStrictEqual([c, a, b]);
		expect(rows.map((row) => row.sortOrder)).toStrictEqual([0, 1, 2]);
	});
});

describe("accountCellQuery", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	async function addEntry(
		id: string,
		overrides: Partial<typeof transactions.$inferInsert>,
	): Promise<void> {
		await db.insert(transactions).values({
			id,
			amount: 10,
			income: false,
			currency: "USD",
			note: id,
			date: JAN_5,
			day: JAN_5,
			month: JAN_5,
			amountUsd: 10,
			updatedAt: JAN_5,
			...overrides,
		});
	}

	it("aggregates only the account's live rows into cells", async () => {
		await addEntry("t1", { accountId: "a1", amount: 30, amountUsd: 30 });
		await addEntry("t2", {
			accountId: "a1",
			amount: 12,
			amountUsd: 12,
			income: true,
		});
		await addEntry("other-account", { accountId: "a2" });
		await addEntry("no-account", { accountId: null });
		await addEntry("deleted", { accountId: "a1", deletedAt: JAN_5 });

		const cells = toCurrencyCells(await accountCellQuery(db, "a1"));

		expect(cells).toHaveLength(2);
		const expense = cells.find((cell) => !cell.income);
		expect(expense?.amount).toBe(30);
		expect(expense?.amountUsd).toBe(30);
		expect(expense?.count).toBe(1);
		expect(expense?.dateKey).toBe("2026-01-05");
		const income = cells.find((cell) => cell.income);
		expect(income?.amount).toBe(12);
	});

	it("feeds accountBalance the shape it expects", async () => {
		await addEntry("t1", { accountId: "a1", amount: 30, amountUsd: 30 });
		await addEntry("t2", {
			accountId: "a1",
			amount: 12,
			amountUsd: 12,
			income: true,
		});

		const cells = toCurrencyCells(await accountCellQuery(db, "a1"));
		const balance = accountBalance(
			{ currency: "USD", initialBalance: 100 },
			cells,
			buildRateTable([]),
		);

		expect(balance.total).toBe(82);
		expect(balance.exact).toBe(true);
	});
});

describe("the last-used account", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("answers null before any save has attached", () => {
		expect(getLastUsedAccount(db)).toBe(null);
	});

	it("hands back the remembered account", async () => {
		const id = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});

		await rememberLastUsedAccount(db, id);

		expect(getLastUsedAccount(db)?.id).toBe(id);
	});

	it("moves with the newest attachment", async () => {
		const first = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});
		const second = await accountsRepo.create(db, {
			name: "Savings",
			currency: "USD",
		});

		await rememberLastUsedAccount(db, first);
		await rememberLastUsedAccount(db, second);

		expect(getLastUsedAccount(db)?.id).toBe(second);
	});

	it("answers null once the remembered account is deleted", async () => {
		const id = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
		});
		await rememberLastUsedAccount(db, id);

		await accountsRepo.softDelete(db, id);

		expect(getLastUsedAccount(db)).toBe(null);
	});
});

describe("an attached entry moving the balance", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	async function balanceOf(accountId: string, rates = buildRateTable([])) {
		const account = getAccountById(db, accountId);
		if (account == null) {
			throw new Error("Account not found.");
		}
		return accountBalance(
			account,
			toCurrencyCells(await accountCellQuery(db, accountId)),
			rates,
		);
	}

	it("shifts the balance in the account's own currency", async () => {
		const accountId = await accountsRepo.create(db, {
			name: "Checking",
			currency: "USD",
			initialBalance: 100,
		});
		expect((await balanceOf(accountId)).total).toBe(100);

		await transactionsRepo.create(db, {
			amount: 25,
			income: false,
			categoryId: "cat-1",
			note: "Coffee",
			details: null,
			date: JAN_5,
			currency: "USD",
			accountId,
		});
		expect((await balanceOf(accountId)).total).toBe(75);

		await transactionsRepo.create(db, {
			amount: 40,
			income: true,
			categoryId: "cat-1",
			note: "Refund",
			details: null,
			date: JAN_5,
			currency: "USD",
			accountId,
		});
		expect((await balanceOf(accountId)).total).toBe(115);
	});

	it("values a foreign-currency entry through its frozen USD amount", async () => {
		await addRate(db, "EUR", "2026-01-01", 0.8);
		const accountId = await accountsRepo.create(db, {
			name: "Girokonto",
			currency: "EUR",
			initialBalance: 100,
			initialBalanceDate: JAN_5,
		});

		await transactionsRepo.create(db, {
			amount: 10,
			income: false,
			categoryId: "cat-1",
			note: "Snack",
			details: null,
			date: JAN_5,
			currency: "USD",
			accountId,
		});

		const rates = buildRateTable([
			{ quote: "EUR", date: "2026-01-01", rate: 0.8 },
		]);
		const balance = await balanceOf(accountId, rates);
		expect(balance.total).toBe(92);
		expect(balance.exact).toBe(true);
	});
});

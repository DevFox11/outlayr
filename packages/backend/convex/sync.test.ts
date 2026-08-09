/// <reference types="vite/client" />

import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { PUSH_BATCH_LIMIT } from "./sync";
import { authenticatedAs, type SeededIdentity, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;

type PushRows = FunctionArgs<typeof api.sync.push>["rows"];
type Arm<T extends PushRows[number]["table"]> = Extract<PushRows[number], { table: T }>;

const DEVICE_A = "device-aaaa";
const DEVICE_B = "device-bbbb";

const transactionFields = (overrides: Partial<Arm<"transactions">["fields"]> = {}): Arm<"transactions">["fields"] => ({
	accountId: null,
	amount: 12.5,
	amountUsd: 12.5,
	categoryId: null,
	currency: "USD",
	customColor: null,
	date: 1_700_000_000_000,
	day: 1_700_000_000_000,
	details: null,
	emoji: null,
	exchangeRate: 1,
	exchangeRateType: "official",
	icon: null,
	imageColor: null,
	imageKey: null,
	income: false,
	month: 1_700_000_000_000,
	note: "coffee",
	onceRecurring: false,
	recurringCoefficient: 1,
	recurringEndDate: null,
	recurringType: 0,
	...overrides,
});

const accountFields = (overrides: Partial<Arm<"accounts">["fields"]> = {}): Arm<"accounts">["fields"] => ({
	currency: "USD",
	customColor: null,
	dateCreated: 1_700_000_000_000,
	emoji: null,
	icon: null,
	imageColor: null,
	imageKey: null,
	initialBalance: 250,
	initialBalanceDate: 1_700_000_000_000,
	initialBalanceUsd: 250,
	name: "Checking",
	sortOrder: 0,
	...overrides,
});

const categoryFields = (overrides: Partial<Arm<"categories">["fields"]> = {}): Arm<"categories">["fields"] => ({
	color: "#FFFFFF",
	dateCreated: null,
	emoji: null,
	icon: null,
	income: false,
	name: "Groceries",
	parentId: null,
	sortOrder: 0,
	...overrides,
});

function transactionRow(
	localId: string,
	updatedAt: number,
	options: {
		deletedAt?: number | null;
		fields?: Partial<Arm<"transactions">["fields"]>;
	} = {}
): Arm<"transactions"> {
	return {
		deletedAt: options.deletedAt ?? null,
		fields: transactionFields(options.fields),
		localId,
		table: "transactions",
		updatedAt,
	};
}

function categoryRow(localId: string, updatedAt: number): Arm<"categories"> {
	return {
		deletedAt: null,
		fields: categoryFields(),
		localId,
		table: "categories",
		updatedAt,
	};
}

function pushAs(t: TestClient, who: SeededIdentity, deviceId: string, rows: PushRows) {
	return authenticatedAs(t, who).mutation(api.sync.push, { deviceId, rows });
}

function pullAs(t: TestClient, who: SeededIdentity, cursor: number, limit?: number) {
	return authenticatedAs(t, who).query(api.sync.pullSince, { cursor, limit });
}

describe("push authorization", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(
			t.mutation(api.sync.push, {
				deviceId: DEVICE_A,
				rows: [transactionRow("t1", 100)],
			})
		).rejects.toThrow(ConvexError);
	});

	test("stores the row under the caller's own id, never an argument", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);

		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored).toHaveLength(1);
		expect(stored[0].userId).toBe(owner.userId);
	});

	test("keeps two accounts' ledgers apart", async () => {
		const t = convexTest(schema, modules);
		const first = await seedAuthUser(t);
		const second = await seedAuthUser(t);

		await pushAs(t, first, DEVICE_A, [transactionRow("shared-id", 100)]);
		await pushAs(t, second, DEVICE_B, [transactionRow("shared-id", 200)]);

		const page = await pullAs(t, first, 0);
		expect(page.rows).toHaveLength(1);
		expect(page.rows[0].updatedAt).toBe(100);
	});

	test("refuses a batch larger than the per-transaction budget", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const rows = Array.from({ length: PUSH_BATCH_LIMIT + 1 }, (_, i) => transactionRow(`t${i}`, 100));

		await expect(pushAs(t, owner, DEVICE_A, rows)).rejects.toThrow(ConvexError);
	});
});

describe("push table coverage", () => {
	test("accepts and round-trips a row from every table the outbox drains", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const rows: PushRows = [
			{
				deletedAt: null,
				fields: { color: null, name: "festival", sortOrder: 0 },
				localId: "tag-1",
				table: "tags",
				updatedAt: 1,
			},
			{
				deletedAt: null,
				fields: { tagId: "tag-1", transactionId: "tx-1" },
				localId: "tt-1",
				table: "transactionTags",
				updatedAt: 2,
			},
			{
				deletedAt: null,
				fields: {
					imageColor: null,
					imageKey: null,
					sortOrder: 0,
					transactionId: "tx-1",
				},
				localId: "tp-1",
				table: "transactionPhotos",
				updatedAt: 3,
			},
			{
				deletedAt: null,
				fields: {
					amount: 5,
					categoryId: null,
					sortOrder: 0,
					transactionId: "tx-1",
				},
				localId: "ts-1",
				table: "transactionSplits",
				updatedAt: 4,
			},
		];

		await pushAs(t, owner, DEVICE_A, rows);

		const page = await pullAs(t, owner, 0);
		expect(page.rows.map((row) => row.table).sort()).toEqual([
			"tags",
			"transactionPhotos",
			"transactionSplits",
			"transactionTags",
		]);
		const tag = page.rows.find((row) => row.table === "tags");
		expect(tag?.fields).toMatchObject({ name: "festival", sortOrder: 0 });
	});

	test("round-trips an account and a transaction that names it", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			{
				deletedAt: null,
				fields: accountFields({ currency: "EUR", initialBalanceUsd: null }),
				localId: "acct-1",
				table: "accounts",
				updatedAt: 1,
			},
			transactionRow("t1", 2, { fields: { accountId: "acct-1" } }),
		]);

		const page = await pullAs(t, owner, 0);
		const account = page.rows.find((row) => row.table === "accounts");
		expect(account?.localId).toBe("acct-1");
		expect(account?.fields).toMatchObject({
			currency: "EUR",
			initialBalance: 250,
			initialBalanceUsd: null,
			name: "Checking",
			sortOrder: 0,
		});
		const transaction = page.rows.find((row) => row.table === "transactions");
		expect(transaction?.fields.accountId).toBe("acct-1");
	});

	test("serves a stored transaction that predates accountId as null", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		const { accountId: _absent, ...legacy } = transactionFields();
		await t.run(async (ctx) => {
			await ctx.db.insert("transactions", {
				deletedAt: null,
				deviceId: DEVICE_A,
				localId: "t-legacy",
				seq: 1,
				updatedAt: 100,
				userId: owner.userId,
				...legacy,
			});
			await ctx.db.insert("syncState", { nextSeq: 2, userId: owner.userId });
		});

		const page = await pullAs(t, owner, 0);
		expect(page.rows[0].fields.accountId).toBeNull();
	});

	test("an accounts tombstone beats a live edit like any other table", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			{
				deletedAt: null,
				fields: accountFields(),
				localId: "acct-1",
				table: "accounts",
				updatedAt: 100,
			},
		]);
		await pushAs(t, owner, DEVICE_B, [
			{
				deletedAt: 50,
				fields: accountFields(),
				localId: "acct-1",
				table: "accounts",
				updatedAt: 50,
			},
		]);

		const page = await pullAs(t, owner, 0);
		const account = page.rows.find((row) => row.table === "accounts");
		expect(account?.deletedAt).toBe(50);
	});

	test("a tags tombstone beats a live edit like any other table", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const live: PushRows = [
			{
				deletedAt: null,
				fields: { color: null, name: "festival", sortOrder: 0 },
				localId: "tag-1",
				table: "tags",
				updatedAt: 100,
			},
		];
		const tombstone: PushRows = [
			{
				deletedAt: 50,
				fields: { color: null, name: "festival", sortOrder: 0 },
				localId: "tag-1",
				table: "tags",
				updatedAt: 50,
			},
		];

		await pushAs(t, owner, DEVICE_A, live);
		await pushAs(t, owner, DEVICE_B, tombstone);

		const page = await pullAs(t, owner, 0);
		const tag = page.rows.find((row) => row.table === "tags");
		expect(tag?.deletedAt).toBe(50);
	});
});

describe("push sequencing", () => {
	test("stamps each accepted row with the next seq and bumps the counter once", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		const result = await pushAs(t, owner, DEVICE_A, [
			categoryRow("c1", 100),
			transactionRow("t1", 101),
			transactionRow("t2", 102),
		]);

		expect(result).toEqual({ accepted: 3, nextSeq: 4, skipped: 0 });
		const states = await t.run((ctx) => ctx.db.query("syncState").collect());
		expect(states).toHaveLength(1);
		expect(states[0].nextSeq).toBe(4);
	});

	test("continues the sequence across batches", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t2", 101)]);

		const page = await pullAs(t, owner, 0);
		expect(page.rows.map((row) => row.seq)).toEqual([1, 2]);
	});

	test("leaves the counter alone when a whole batch is a no-op", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);
		const replay = await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);

		expect(replay).toEqual({ accepted: 0, nextSeq: 2, skipped: 1 });
	});

	test("upserts by localId rather than inserting a second copy", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 200, { fields: { note: "tea" } })]);

		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored).toHaveLength(1);
		expect(stored[0].note).toBe("tea");
	});

	test("keys appMeta on the meta key, not on a row id", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			{
				deletedAt: null,
				fields: { value: "USD" },
				localId: "currency",
				table: "appMeta",
				updatedAt: 100,
			},
		]);
		await pushAs(t, owner, DEVICE_B, [
			{
				deletedAt: null,
				fields: { value: "EUR" },
				localId: "currency",
				table: "appMeta",
				updatedAt: 200,
			},
		]);

		const stored = await t.run((ctx) => ctx.db.query("appMeta").collect());
		expect(stored).toHaveLength(1);
		expect(stored[0].value).toBe("EUR");
	});
});

describe("push conflict resolution", () => {
	test("R1 — a tombstone beats a strictly newer edit", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100, { deletedAt: 100 })]);
		const result = await pushAs(t, owner, DEVICE_B, [transactionRow("t1", 500, { fields: { note: "resurrected" } })]);

		expect(result.accepted).toBe(0);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].deletedAt).toBe(100);
		expect(stored[0].note).not.toBe("resurrected");
	});

	test("R1 — a tombstone lands on top of a newer live row", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 500)]);
		await pushAs(t, owner, DEVICE_B, [transactionRow("t1", 100, { deletedAt: 100 })]);

		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].deletedAt).toBe(100);
	});

	test("R2 — the greater updatedAt takes the whole row", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 500, { fields: { note: "newer" } })]);
		const stale = await pushAs(t, owner, DEVICE_B, [transactionRow("t1", 100, { fields: { note: "older" } })]);

		expect(stale.skipped).toBe(1);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].note).toBe("newer");
	});

	test("R2 — an exact tie breaks on the greater deviceId, both ways round", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100, { fields: { note: "from-a" } })]);
		await pushAs(t, owner, DEVICE_B, [transactionRow("t1", 100, { fields: { note: "from-b" } })]);
		const reverse = await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100, { fields: { note: "from-a-again" } })]);

		expect(reverse.accepted).toBe(0);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].note).toBe("from-b");
	});
});

describe("pullSince", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(t.query(api.sync.pullSince, { cursor: 0 })).rejects.toThrow(ConvexError);
	});

	test("merge-sorts six streams into one seq-ordered log", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100),
			categoryRow("c1", 101),
			{
				deletedAt: null,
				fields: {
					amount: 100,
					amountUsd: 100,
					categoryId: "c1",
					currency: "USD",
					dateCreated: null,
					green: false,
					name: null,
					rollover: false,
					startDate: null,
					type: 0,
				},
				localId: "b1",
				table: "budgets",
				updatedAt: 102,
			},
			transactionRow("t2", 103),
		]);

		const page = await pullAs(t, owner, 0);

		expect(page.rows.map((row) => [row.table, row.localId])).toEqual([
			["transactions", "t1"],
			["categories", "c1"],
			["budgets", "b1"],
			["transactions", "t2"],
		]);
		expect(page.cursor).toBe(4);
		expect(page.hasMore).toBe(false);
	});

	test("serves only what is strictly after the cursor", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100), transactionRow("t2", 101), transactionRow("t3", 102)]);

		const page = await pullAs(t, owner, 2);

		expect(page.rows.map((row) => row.localId)).toEqual(["t3"]);
	});

	test("pages a log longer than the limit without dropping a row", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(
			t,
			owner,
			DEVICE_A,
			Array.from({ length: 7 }, (_, i) => transactionRow(`t${i}`, 100 + i))
		);

		const seen: string[] = [];
		let cursor = 0;
		for (let guard = 0; guard < 10; guard += 1) {
			const { cursor: nextCursor, hasMore, rows } = await pullAs(t, owner, cursor, 3);
			seen.push(...rows.map((row) => row.localId));
			cursor = nextCursor;
			if (!hasMore) {
				break;
			}
		}

		expect(seen).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6"]);
	});

	test("carries the full field payload, tombstone included", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100, {
				deletedAt: 150,
				fields: { amount: 9.99, note: "gone" },
			}),
		]);

		const page = await pullAs(t, owner, 0);

		expect(page.rows[0].deletedAt).toBe(150);
		expect(page.rows[0].deviceId).toBe(DEVICE_A);
		expect(page.rows[0].fields.note).toBe("gone");
		expect(page.rows[0].fields.amount).toBe(9.99);
	});

	test("serves appMeta under the key it was pushed with", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [
			{
				deletedAt: null,
				fields: { value: "1" },
				localId: "currencyChosen",
				table: "appMeta",
				updatedAt: 100,
			},
		]);

		const page = await pullAs(t, owner, 0);

		expect(page.rows[0].localId).toBe("currencyChosen");
		expect(page.rows[0].deletedAt).toBeNull();
		expect(page.rows[0].fields.value).toBe("1");
	});

	test("leaves the cursor where it was when nothing is new", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);

		const page = await pullAs(t, owner, 1);

		expect(page.rows).toEqual([]);
		expect(page.cursor).toBe(1);
		expect(page.hasMore).toBe(false);
	});
});

describe("currentSeq", () => {
	test("is zero for an account that has never pushed", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		expect(await authenticatedAs(t, owner).query(api.sync.currentSeq, {})).toBe(0);
	});

	test("moves when any device pushes", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);

		expect(await authenticatedAs(t, owner).query(api.sync.currentSeq, {})).toBe(2);
	});

	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(t.query(api.sync.currentSeq, {})).rejects.toThrow(ConvexError);
	});
});

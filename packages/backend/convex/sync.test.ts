/// <reference types="vite/client" />

import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { PUSH_BATCH_LIMIT } from "./sync";
import {
	authenticatedAs,
	type SeededIdentity,
	seedAuthUser,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;

type PushRows = FunctionArgs<typeof api.sync.push>["rows"];
type Arm<T extends PushRows[number]["table"]> = Extract<
	PushRows[number],
	{ table: T }
>;

const DEVICE_A = "device-aaaa";
const DEVICE_B = "device-bbbb";

const transactionFields = (
	overrides: Partial<Arm<"transactions">["fields"]> = {},
): Arm<"transactions">["fields"] => ({
	amount: 12.5,
	income: false,
	currency: "USD",
	note: "coffee",
	details: null,
	date: 1_700_000_000_000,
	day: 1_700_000_000_000,
	month: 1_700_000_000_000,
	icon: null,
	emoji: null,
	customColor: null,
	imageColor: null,
	imageUri: null,
	onceRecurring: false,
	recurringType: 0,
	recurringCoefficient: 1,
	recurringEndDate: null,
	categoryId: null,
	amountUsd: 12.5,
	exchangeRate: 1,
	exchangeRateType: "official",
	...overrides,
});

const categoryFields = (
	overrides: Partial<Arm<"categories">["fields"]> = {},
): Arm<"categories">["fields"] => ({
	name: "Groceries",
	color: "#FFFFFF",
	icon: null,
	emoji: null,
	income: false,
	sortOrder: 0,
	dateCreated: null,
	parentId: null,
	...overrides,
});

function transactionRow(
	localId: string,
	updatedAt: number,
	options: {
		deletedAt?: number | null;
		fields?: Partial<Arm<"transactions">["fields"]>;
	} = {},
): Arm<"transactions"> {
	return {
		table: "transactions",
		localId,
		updatedAt,
		deletedAt: options.deletedAt ?? null,
		fields: transactionFields(options.fields),
	};
}

function categoryRow(localId: string, updatedAt: number): Arm<"categories"> {
	return {
		table: "categories",
		localId,
		updatedAt,
		deletedAt: null,
		fields: categoryFields(),
	};
}

function pushAs(
	t: TestClient,
	who: SeededIdentity,
	deviceId: string,
	rows: PushRows,
) {
	return authenticatedAs(t, who).mutation(api.sync.push, { deviceId, rows });
}

function pullAs(
	t: TestClient,
	who: SeededIdentity,
	cursor: number,
	limit?: number,
) {
	return authenticatedAs(t, who).query(api.sync.pullSince, { cursor, limit });
}

describe("push authorization", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(
			t.mutation(api.sync.push, {
				deviceId: DEVICE_A,
				rows: [transactionRow("t1", 100)],
			}),
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
		const rows = Array.from({ length: PUSH_BATCH_LIMIT + 1 }, (_, i) =>
			transactionRow(`t${i}`, 100),
		);

		await expect(pushAs(t, owner, DEVICE_A, rows)).rejects.toThrow(ConvexError);
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

		expect(result).toEqual({ accepted: 3, skipped: 0, nextSeq: 4 });
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
		const replay = await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100),
		]);

		expect(replay).toEqual({ accepted: 0, skipped: 1, nextSeq: 2 });
	});

	test("upserts by localId rather than inserting a second copy", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);
		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 200, { fields: { note: "tea" } }),
		]);

		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored).toHaveLength(1);
		expect(stored[0].note).toBe("tea");
	});

	test("keys appMeta on the meta key, not on a row id", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			{
				table: "appMeta",
				localId: "currency",
				updatedAt: 100,
				deletedAt: null,
				fields: { value: "USD" },
			},
		]);
		await pushAs(t, owner, DEVICE_B, [
			{
				table: "appMeta",
				localId: "currency",
				updatedAt: 200,
				deletedAt: null,
				fields: { value: "EUR" },
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

		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100, { deletedAt: 100 }),
		]);
		const result = await pushAs(t, owner, DEVICE_B, [
			transactionRow("t1", 500, { fields: { note: "resurrected" } }),
		]);

		expect(result.accepted).toBe(0);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].deletedAt).toBe(100);
		expect(stored[0].note).not.toBe("resurrected");
	});

	test("R1 — a tombstone lands on top of a newer live row", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 500)]);
		await pushAs(t, owner, DEVICE_B, [
			transactionRow("t1", 100, { deletedAt: 100 }),
		]);

		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].deletedAt).toBe(100);
	});

	test("R2 — the greater updatedAt takes the whole row", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 500, { fields: { note: "newer" } }),
		]);
		const stale = await pushAs(t, owner, DEVICE_B, [
			transactionRow("t1", 100, { fields: { note: "older" } }),
		]);

		expect(stale.skipped).toBe(1);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].note).toBe("newer");
	});

	test("R2 — an exact tie breaks on the greater deviceId, both ways round", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100, { fields: { note: "from-a" } }),
		]);
		await pushAs(t, owner, DEVICE_B, [
			transactionRow("t1", 100, { fields: { note: "from-b" } }),
		]);
		const reverse = await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100, { fields: { note: "from-a-again" } }),
		]);

		expect(reverse.accepted).toBe(0);
		const stored = await t.run((ctx) => ctx.db.query("transactions").collect());
		expect(stored[0].note).toBe("from-b");
	});
});

describe("pullSince", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(t.query(api.sync.pullSince, { cursor: 0 })).rejects.toThrow(
			ConvexError,
		);
	});

	test("merge-sorts six streams into one seq-ordered log", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100),
			categoryRow("c1", 101),
			{
				table: "budgets",
				localId: "b1",
				updatedAt: 102,
				deletedAt: null,
				fields: {
					name: null,
					amount: 100,
					type: 0,
					startDate: null,
					dateCreated: null,
					currency: "USD",
					amountUsd: 100,
					green: false,
					categoryId: "c1",
				},
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
		await pushAs(t, owner, DEVICE_A, [
			transactionRow("t1", 100),
			transactionRow("t2", 101),
			transactionRow("t3", 102),
		]);

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
			Array.from({ length: 7 }, (_, i) => transactionRow(`t${i}`, 100 + i)),
		);

		const seen: string[] = [];
		let cursor = 0;
		for (let guard = 0; guard < 10; guard += 1) {
			const page = await pullAs(t, owner, cursor, 3);
			seen.push(...page.rows.map((row) => row.localId));
			cursor = page.cursor;
			if (!page.hasMore) {
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
				fields: { note: "gone", amount: 9.99 },
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
				table: "appMeta",
				localId: "currencyChosen",
				updatedAt: 100,
				deletedAt: null,
				fields: { value: "1" },
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

		expect(await authenticatedAs(t, owner).query(api.sync.currentSeq, {})).toBe(
			0,
		);
	});

	test("moves when any device pushes", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await pushAs(t, owner, DEVICE_A, [transactionRow("t1", 100)]);

		expect(await authenticatedAs(t, owner).query(api.sync.currentSeq, {})).toBe(
			2,
		);
	});

	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(t.query(api.sync.currentSeq, {})).rejects.toThrow(ConvexError);
	});
});

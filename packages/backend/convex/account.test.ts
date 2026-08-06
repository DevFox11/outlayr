/// <reference types="vite/client" />

import type { FunctionArgs } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import { photoKeyFor } from "./lib/photoKeys";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;
type PushRows = FunctionArgs<typeof api.sync.push>["rows"];

const DEVICE = "device-aaaa";

function transactionRow(localId: string): PushRows[number] {
	return {
		table: "transactions",
		localId,
		updatedAt: 100,
		deletedAt: null,
		fields: {
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
			imageKey: null,
			onceRecurring: false,
			recurringType: 0,
			recurringCoefficient: 1,
			recurringEndDate: null,
			categoryId: null,
			accountId: null,
			amountUsd: 12.5,
			exchangeRate: 1,
			exchangeRateType: "official",
		},
	};
}

/** Drains the purge the way `beforeDelete` does, and reports the passes taken. */
async function purgeAll(t: TestClient, userId: string): Promise<number> {
	let passes = 0;
	let done = false;
	while (!done) {
		const result = await t.mutation(internal.account.purgeBatch, { userId });
		done = result.done;
		passes += 1;
		if (passes > 50) {
			throw new Error("purgeBatch never reported done");
		}
	}
	return passes;
}

async function countRows(t: TestClient, userId: string): Promise<number> {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query("transactions")
			.withIndex("by_user_and_seq", (q) => q.eq("userId", userId))
			.collect();
		return rows.length;
	});
}

describe("purging an account", () => {
	test("removes the caller's ledger and reports done", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await authenticatedAs(t, owner).mutation(api.sync.push, {
			deviceId: DEVICE,
			rows: [transactionRow("a"), transactionRow("b")],
		});
		expect(await countRows(t, owner.userId)).toBe(2);

		await purgeAll(t, owner.userId);

		expect(await countRows(t, owner.userId)).toBe(0);
	});

	test("leaves another account's ledger untouched", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);
		await authenticatedAs(t, owner).mutation(api.sync.push, {
			deviceId: DEVICE,
			rows: [transactionRow("a")],
		});
		await authenticatedAs(t, stranger).mutation(api.sync.push, {
			deviceId: DEVICE,
			rows: [transactionRow("a")],
		});

		await purgeAll(t, owner.userId);

		expect(await countRows(t, owner.userId)).toBe(0);
		expect(await countRows(t, stranger.userId)).toBe(1);
	});

	test("drops the seq counter only once the rows are gone", async () => {
		// Removing it while rows remain would restart numbering under records that
		// already carry higher seqs, and a peer would then never see them again.
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await authenticatedAs(t, owner).mutation(api.sync.push, {
			deviceId: DEVICE,
			rows: [transactionRow("a")],
		});

		const first = await t.mutation(internal.account.purgeBatch, {
			userId: owner.userId,
		});
		expect(first.done).toBe(false);
		const stateAfterFirst = await t.run(async (ctx) =>
			ctx.db
				.query("syncState")
				.withIndex("by_user", (q) => q.eq("userId", owner.userId))
				.unique(),
		);
		expect(stateAfterFirst).not.toBeNull();

		await purgeAll(t, owner.userId);
		const stateAtEnd = await t.run(async (ctx) =>
			ctx.db
				.query("syncState")
				.withIndex("by_user", (q) => q.eq("userId", owner.userId))
				.unique(),
		);
		expect(stateAtEnd).toBeNull();
	});

	test("frees the account's photos and forgets what they weighed", async () => {
		// Driven through a real confirmed upload rather than a hand-written row, so
		// the mapping, the accounting and the stored bytes all exist the way they
		// would in production. The Convex-storage path is the testable one: the R2
		// branch needs a component convex-test cannot register.
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, "a.jpg");
		const storageId = await t.run(
			async (ctx) => await ctx.storage.store(new Blob(["bytes"])),
		);
		await authenticatedAs(t, owner).action(api.photos.confirmUpload, {
			key,
			storageId,
		});

		await purgeAll(t, owner.userId);

		const leftovers = await t.run(async (ctx) => ({
			sizes: await ctx.db.query("photoSizes").collect(),
			objects: await ctx.db.query("photoObjects").collect(),
		}));
		expect(leftovers.sizes).toEqual([]);
		expect(leftovers.objects).toEqual([]);
	});

	test("is safe to run again on an account already purged", async () => {
		// A pass that dies halfway is retried rather than resumed, so a second run
		// over nothing has to be a no-op instead of an error.
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		const passes = await purgeAll(t, owner.userId);
		expect(passes).toBe(1);
		await expect(purgeAll(t, owner.userId)).resolves.toBe(1);
	});
});

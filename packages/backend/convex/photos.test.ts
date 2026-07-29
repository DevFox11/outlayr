/// <reference types="vite/client" />

import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { photoKeyFor } from "./lib/photoKeys";
import { PHOTO_URL_BATCH_LIMIT } from "./photos";
import schema from "./schema";
import {
	authenticatedAs,
	type SeededIdentity,
	seedAuthUser,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;
type PushRows = FunctionArgs<typeof api.sync.push>["rows"];

const DEVICE = "device-aaaa";
const PHOTO = "k7q2x9f1.jpg";

function transactionRow(
	localId: string,
	options: { imageKey?: string | null; deletedAt?: number | null } = {},
): PushRows[number] {
	return {
		table: "transactions",
		localId,
		updatedAt: 100,
		deletedAt: options.deletedAt ?? null,
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
			imageKey: options.imageKey ?? null,
			onceRecurring: false,
			recurringType: 0,
			recurringCoefficient: 1,
			recurringEndDate: null,
			categoryId: null,
			amountUsd: 12.5,
			exchangeRate: 1,
			exchangeRateType: "official",
		},
	};
}

function push(t: TestClient, who: SeededIdentity, rows: PushRows) {
	return authenticatedAs(t, who).mutation(api.sync.push, {
		deviceId: DEVICE,
		rows,
	});
}

describe("requestUpload", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(
			t.mutation(api.photos.requestUpload, { name: PHOTO }),
		).rejects.toThrow(ConvexError);
	});

	test("refuses a name that would climb out of the account's prefix", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).mutation(api.photos.requestUpload, {
				name: "../other/a.jpg",
			}),
		).rejects.toThrow(ConvexError);
	});
});

describe("confirmUpload", () => {
	test("refuses a key belonging to another account", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).action(api.photos.confirmUpload, {
				key: photoKeyFor(stranger.userId, PHOTO),
			}),
		).rejects.toThrow(ConvexError);
	});
});

describe("readUrls", () => {
	test("refuses a caller with no session", async () => {
		const t = convexTest(schema, modules);

		await expect(t.query(api.photos.readUrls, { keys: [] })).rejects.toThrow(
			ConvexError,
		);
	});

	test("refuses a batch bigger than the limit", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const keys = Array.from({ length: PHOTO_URL_BATCH_LIMIT + 1 }, (_, i) =>
			photoKeyFor(owner.userId, `p${i}.jpg`),
		);

		await expect(
			authenticatedAs(t, owner).query(api.photos.readUrls, { keys }),
		).rejects.toThrow(ConvexError);
	});

	test("mints nothing for an empty batch without reaching R2", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).query(api.photos.readUrls, { keys: [] }),
		).resolves.toEqual([]);
	});

	test("drops a key belonging to another account rather than minting for it", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).query(api.photos.readUrls, {
				keys: [photoKeyFor(stranger.userId, PHOTO)],
			}),
		).resolves.toEqual([]);
	});
});

describe("releaseUnreferenced", () => {
	test("refuses a key belonging to another account", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).mutation(api.photos.releaseUnreferenced, {
				key: photoKeyFor(stranger.userId, PHOTO),
			}),
		).rejects.toThrow(ConvexError);
	});

	test("keeps an object a live row still names", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		await push(t, owner, [transactionRow("t1", { imageKey: key })]);

		await expect(
			authenticatedAs(t, owner).mutation(api.photos.releaseUnreferenced, {
				key,
			}),
		).resolves.toEqual({ released: false });
	});

	test("keeps an object only a tombstoned row names", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		await push(t, owner, [
			transactionRow("t1", { imageKey: key, deletedAt: 200 }),
		]);

		// The undo window restores from a tombstone, and a device that has not
		// pulled the delete is still rendering the photo.
		await expect(
			authenticatedAs(t, owner).mutation(api.photos.releaseUnreferenced, {
				key,
			}),
		).resolves.toEqual({ released: false });
	});

	test("does not see another account's row as a reference", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		await push(t, stranger, [transactionRow("t1", { imageKey: key })]);

		// Reaching R2 is the proof: the reference check answered "unreferenced",
		// which is the branch under test. The delete itself needs credentials this
		// deployment has not been given.
		await expect(
			authenticatedAs(t, owner).mutation(api.photos.releaseUnreferenced, {
				key,
			}),
		).rejects.toThrow();
	});
});

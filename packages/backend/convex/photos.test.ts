/// <reference types="vite/client" />

import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import { photoKeyFor, photoOwnerFromKey } from "./lib/photoKeys";
import { PHOTO_QUOTA_BYTES, PHOTO_URL_BATCH_LIMIT } from "./photos";
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
			accountId: null,
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

/** Records what an object weighs, the way a confirmed upload does. */
async function storeSize(t: TestClient, key: string, bytes: number) {
	await t.mutation(internal.photos.recordPhotoSize, { key, bytes });
}

async function totalStored(t: TestClient, userId: string): Promise<number> {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query("photoSizes")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return rows.reduce((total, row) => total + row.bytes, 0);
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

	test("refuses once the account is at its storage ceiling", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await storeSize(t, photoKeyFor(owner.userId, "big.jpg"), PHOTO_QUOTA_BYTES);

		await expect(
			authenticatedAs(t, owner).mutation(api.photos.requestUpload, {
				name: PHOTO,
			}),
		).rejects.toThrow(ConvexError);
	});

	test("mints a url while the account is still under the ceiling", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		await storeSize(
			t,
			photoKeyFor(owner.userId, "big.jpg"),
			PHOTO_QUOTA_BYTES - 1,
		);

		const { key } = await authenticatedAs(t, owner).mutation(
			api.photos.requestUpload,
			{ name: PHOTO },
		);
		expect(key).toBe(photoKeyFor(owner.userId, PHOTO));
	});

	test("weighs only the caller's own photos", async () => {
		// The sum is indexed by user, so a stranger at the ceiling must not spend
		// this account's allowance.
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const stranger = await seedAuthUser(t);
		await storeSize(
			t,
			photoKeyFor(stranger.userId, "big.jpg"),
			PHOTO_QUOTA_BYTES,
		);

		const { key } = await authenticatedAs(t, owner).mutation(
			api.photos.requestUpload,
			{ name: PHOTO },
		);
		expect(key).toBe(photoKeyFor(owner.userId, PHOTO));
	});
});

describe("accounting for what an account stores", () => {
	test("replaces a re-uploaded name's size instead of adding to it", async () => {
		// A counter per account would read 300 here, and the account would be
		// charged for bytes R2 overwrote.
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);

		await storeSize(t, key, 100);
		await storeSize(t, key, 200);

		expect(await totalStored(t, owner.userId)).toBe(200);
	});

	test("records nothing for a key that is not a photo key", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.photos.recordPhotoSize, {
			key: "not/a/photo/key",
			bytes: 999,
		});

		const rows = await t.run(async (ctx) =>
			ctx.db.query("photoSizes").collect(),
		);
		expect(rows).toEqual([]);
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

describe("merchant cache keys stay unowned (T8)", () => {
	test("photoOwnerFromKey returns null for a merchant key", () => {
		expect(photoOwnerFromKey("merchant/farmatodo")).toBeNull();
	});

	test("readUrls drops a merchant key even for an authenticated caller", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, owner).query(api.photos.readUrls, {
				keys: ["merchant/farmatodo"],
			}),
		).resolves.toEqual([]);
	});
});

/**
 * The R2 variables are absent under test, so every case above already exercises
 * the Convex-storage fallback. These pin the parts of it that differ from R2:
 * the key resolves only through the mapping, and re-uploading the same name
 * frees the object it displaced rather than leaking it.
 */
describe("the convex storage fallback", () => {
	test("mints a read url for a key confirmed with a storage id", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		const storageId = await t.run(
			async (ctx) => await ctx.storage.store(new Blob(["bytes"])),
		);

		await authenticatedAs(t, owner).action(api.photos.confirmUpload, {
			key,
			storageId,
		});
		const urls = await authenticatedAs(t, owner).query(api.photos.readUrls, {
			keys: [key],
		});

		expect(urls).toHaveLength(1);
		expect(urls[0]?.key).toBe(key);
	});

	test("re-uploading the same name frees the object it displaced", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		const first = await t.run(
			async (ctx) => await ctx.storage.store(new Blob(["one"])),
		);
		const second = await t.run(
			async (ctx) => await ctx.storage.store(new Blob(["two"])),
		);

		const confirm = (storageId: typeof first) =>
			authenticatedAs(t, owner).action(api.photos.confirmUpload, {
				key,
				storageId,
			});
		await confirm(first);
		await confirm(second);

		const mappings = await t.run(
			async (ctx) => await ctx.db.query("photoObjects").collect(),
		);
		expect(mappings).toHaveLength(1);
		expect(mappings[0]?.storageId).toBe(second);
		expect(await t.run(async (ctx) => await ctx.storage.getUrl(first))).toBe(
			null,
		);
	});

	test("releasing an unreferenced key drops the mapping and the bytes", async () => {
		const t = convexTest(schema, modules);
		const owner = await seedAuthUser(t);
		const key = photoKeyFor(owner.userId, PHOTO);
		const storageId = await t.run(
			async (ctx) => await ctx.storage.store(new Blob(["bytes"])),
		);
		await authenticatedAs(t, owner).action(api.photos.confirmUpload, {
			key,
			storageId,
		});

		const released = await authenticatedAs(t, owner).mutation(
			api.photos.releaseUnreferenced,
			{ key },
		);

		expect(released).toEqual({ released: true });
		expect(
			await t.run(async (ctx) => await ctx.db.query("photoObjects").collect()),
		).toHaveLength(0);
		expect(
			await t.run(async (ctx) => await ctx.storage.getUrl(storageId)),
		).toBe(null);
	});
});

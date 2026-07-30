import assert from "node:assert/strict";
import { describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { transactions } from "@/db/schema";
import type { SpendDb } from "./budget-spent";
import type { PhotoFiles } from "./photo-store-core";
import {
	downloadPhotos,
	PHOTO_SYNC_BATCH,
	type PhotoTransport,
	photoNameFromKey,
	runPhotoSync,
	uploadPhotos,
} from "./photo-sync-core";

const DIRECTORY = "file:///container-a/Documents/transaction-photos";
const PEER_DIRECTORY = "file:///container-b/Documents/transaction-photos";
const NOW = new Date(Date.UTC(2026, 6, 29, 12));
const USER = "user-aaaa";

function makeDb(): SpendDb {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
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
			reminderLeadDays integer,
			categoryId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as SpendDb;
}

const EARLIER = new Date(Date.UTC(2026, 6, 1));

async function insert(
	db: SpendDb,
	id: string,
	values: { imageUri?: string | null; imageKey?: string | null } = {},
) {
	await db.insert(transactions).values({
		id,
		amount: 10,
		income: false,
		note: id,
		date: NOW,
		day: NOW,
		month: NOW,
		imageUri: values.imageUri ?? null,
		imageKey: values.imageKey ?? null,
		updatedAt: EARLIER,
		deletedAt: null,
	});
}

async function readRow(db: SpendDb, id: string) {
	const rows = await db
		.select({
			imageUri: transactions.imageUri,
			imageKey: transactions.imageKey,
			updatedAt: transactions.updatedAt,
		})
		.from(transactions)
		.where(eq(transactions.id, id));
	return rows[0];
}

class FakeFiles implements PhotoFiles {
	readonly directoryUri: string;
	bytes = new Map<string, Uint8Array>();

	constructor(directoryUri = DIRECTORY, seeded: [string, string][] = []) {
		this.directoryUri = directoryUri;
		for (const [name, body] of seeded) {
			this.bytes.set(name, new TextEncoder().encode(body));
		}
	}

	list() {
		return [...this.bytes.keys()].map((name) => ({ name, modifiedAt: 0 }));
	}

	remove(name: string) {
		this.bytes.delete(name);
	}

	adopt() {
		return false;
	}

	read(name: string) {
		return this.bytes.get(name) ?? null;
	}

	write(name: string, bytes: Uint8Array) {
		this.bytes.set(name, bytes);
	}
}

interface FakeBucket {
	objects: Map<string, Uint8Array>;
	confirmed: string[];
	released: string[];
}

/**
 * Stands in for R2 plus `packages/backend/convex/photos.ts`. Mints the same
 * account-namespaced key shape and, like the real signed url, hands back a
 * string that is only meaningful to this bucket.
 */
function fakeTransport(
	bucket: FakeBucket = { objects: new Map(), confirmed: [], released: [] },
	overrides: Partial<PhotoTransport> = {},
): { bucket: FakeBucket; transport: PhotoTransport } {
	const transport: PhotoTransport = {
		async requestUpload(name) {
			const key = `transaction-photos/${USER}/${name}`;
			return { key, url: `https://r2.test/put/${key}` };
		},
		async confirmUpload(key) {
			bucket.confirmed.push(key);
		},
		async readUrls(keys) {
			return keys.map((key) => ({ key, url: `https://r2.test/get/${key}` }));
		},
		async release(key) {
			bucket.released.push(key);
			bucket.objects.delete(key);
		},
		async put(url, bytes) {
			bucket.objects.set(url.replace("https://r2.test/put/", ""), bytes);
			// R2 addresses by key, so its PUT allocates nothing to report back.
			return null;
		},
		async get(url) {
			return (
				bucket.objects.get(url.replace("https://r2.test/get/", "")) ?? null
			);
		},
		...overrides,
	};
	return { bucket, transport };
}

describe("photoNameFromKey", () => {
	it("takes the name half the key was minted from", () => {
		assert.equal(
			photoNameFromKey(`transaction-photos/${USER}/abc.jpg`),
			"abc.jpg",
		);
	});

	it("answers null for something that is not a key", () => {
		assert.equal(photoNameFromKey("abc.jpg"), null);
		assert.equal(photoNameFromKey("a/"), null);
	});
});

describe("uploadPhotos", () => {
	it("sends the bytes and records the key", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		const { bucket, transport } = fakeTransport();
		await insert(db, "t1", { imageUri: `${DIRECTORY}/a.jpg` });

		const result = await uploadPhotos(db, files, transport, NOW);

		assert.equal(result.uploaded, 1);
		const row = await readRow(db, "t1");
		assert.equal(row.imageKey, `transaction-photos/${USER}/a.jpg`);
		assert.deepEqual(
			bucket.objects.get(`transaction-photos/${USER}/a.jpg`),
			new TextEncoder().encode("PHOTO"),
		);
		assert.deepEqual(bucket.confirmed, [`transaction-photos/${USER}/a.jpg`]);
	});

	it("bumps updatedAt so the key is not outranked by an older peer edit", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		const { transport } = fakeTransport();
		await insert(db, "t1", { imageUri: `${DIRECTORY}/a.jpg` });

		await uploadPhotos(db, files, transport, NOW);

		assert.equal((await readRow(db, "t1")).updatedAt.getTime(), NOW.getTime());
	});

	it("is a no-op once the key already names the photo", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		const { bucket, transport } = fakeTransport();
		await insert(db, "t1", {
			imageUri: `${DIRECTORY}/a.jpg`,
			imageKey: `transaction-photos/${USER}/a.jpg`,
		});

		assert.equal((await uploadPhotos(db, files, transport, NOW)).uploaded, 0);
		assert.equal(bucket.confirmed.length, 0);
	});

	it("re-uses the same key when a previous attempt died mid-PUT", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		const bucket: FakeBucket = {
			objects: new Map(),
			confirmed: [],
			released: [],
		};
		const failing = fakeTransport(bucket, {
			put() {
				return Promise.reject(new Error("connection lost"));
			},
		});
		await insert(db, "t1", { imageUri: `${DIRECTORY}/a.jpg` });

		await assert.rejects(uploadPhotos(db, files, failing.transport, NOW));
		// Nothing recorded, so the row is still owed an upload.
		assert.equal((await readRow(db, "t1")).imageKey, null);

		const retry = fakeTransport(bucket);
		assert.equal(
			(await uploadPhotos(db, files, retry.transport, NOW)).uploaded,
			1,
		);
		// One key, one object: the retry overwrote rather than orphaning.
		assert.deepEqual(
			[...bucket.objects.keys()],
			[`transaction-photos/${USER}/a.jpg`],
		);
		assert.equal(
			(await readRow(db, "t1")).imageKey,
			`transaction-photos/${USER}/a.jpg`,
		);
	});

	it("releases the superseded object when the photo is replaced", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [
			["old.jpg", "OLD"],
			["new.jpg", "NEW"],
		]);
		const { bucket, transport } = fakeTransport();
		bucket.objects.set(
			`transaction-photos/${USER}/old.jpg`,
			new TextEncoder().encode("OLD"),
		);
		await insert(db, "t1", {
			imageUri: `${DIRECTORY}/new.jpg`,
			imageKey: `transaction-photos/${USER}/old.jpg`,
		});

		const result = await uploadPhotos(db, files, transport, NOW);

		assert.equal(result.released, 1);
		assert.deepEqual(bucket.released, [`transaction-photos/${USER}/old.jpg`]);
		assert.equal(
			(await readRow(db, "t1")).imageKey,
			`transaction-photos/${USER}/new.jpg`,
		);
	});

	it("keeps the new key when releasing the old object fails", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["new.jpg", "NEW"]]);
		const { transport } = fakeTransport(undefined, {
			release() {
				return Promise.reject(new Error("offline"));
			},
		});
		await insert(db, "t1", {
			imageUri: `${DIRECTORY}/new.jpg`,
			imageKey: `transaction-photos/${USER}/old.jpg`,
		});

		const result = await uploadPhotos(db, files, transport, NOW);

		assert.equal(result.uploaded, 1);
		assert.equal(result.released, 0);
		assert.equal(
			(await readRow(db, "t1")).imageKey,
			`transaction-photos/${USER}/new.jpg`,
		);
	});

	it("skips a row whose file the reconciliation has yet to repair", async () => {
		const db = makeDb();
		const files = new FakeFiles();
		const { bucket, transport } = fakeTransport();
		await insert(db, "t1", { imageUri: `${DIRECTORY}/gone.jpg` });

		assert.equal((await uploadPhotos(db, files, transport, NOW)).uploaded, 0);
		assert.equal(bucket.confirmed.length, 0);
		assert.equal((await readRow(db, "t1")).imageKey, null);
	});

	it("stops at the batch size", async () => {
		const db = makeDb();
		const seeded: [string, string][] = [];
		for (let i = 0; i < PHOTO_SYNC_BATCH + 3; i += 1) {
			seeded.push([`p${i}.jpg`, `BODY${i}`]);
		}
		const files = new FakeFiles(DIRECTORY, seeded);
		const { transport } = fakeTransport();
		for (let i = 0; i < PHOTO_SYNC_BATCH + 3; i += 1) {
			await insert(db, `t${i}`, { imageUri: `${DIRECTORY}/p${i}.jpg` });
		}

		assert.equal(
			(await uploadPhotos(db, files, transport, NOW)).uploaded,
			PHOTO_SYNC_BATCH,
		);
	});
});

describe("downloadPhotos", () => {
	it("fetches a photo whose row arrived first", async () => {
		const db = makeDb();
		const peer = new FakeFiles(PEER_DIRECTORY);
		const { bucket, transport } = fakeTransport();
		bucket.objects.set(
			`transaction-photos/${USER}/a.jpg`,
			new TextEncoder().encode("PHOTO"),
		);
		await insert(db, "t1", { imageKey: `transaction-photos/${USER}/a.jpg` });

		assert.equal(await downloadPhotos(db, peer, transport), 1);
		assert.deepEqual(peer.read("a.jpg"), new TextEncoder().encode("PHOTO"));
		assert.equal((await readRow(db, "t1")).imageUri, `${PEER_DIRECTORY}/a.jpg`);
	});

	it("leaves the row renderable through the existing fallback until the bytes land", async () => {
		const db = makeDb();
		const peer = new FakeFiles(PEER_DIRECTORY);
		const { transport } = fakeTransport();
		await insert(db, "t1", { imageKey: `transaction-photos/${USER}/a.jpg` });

		// The object is not in the bucket yet — the row got here first.
		assert.equal(await downloadPhotos(db, peer, transport), 0);
		const row = await readRow(db, "t1");
		assert.equal(row.imageUri, null);
		// The key survives, so the next pass retries rather than giving up.
		assert.equal(row.imageKey, `transaction-photos/${USER}/a.jpg`);
	});

	it("keeps the key when the object was deleted out from under the fetch", async () => {
		const db = makeDb();
		const peer = new FakeFiles(PEER_DIRECTORY);
		const { transport } = fakeTransport(undefined, {
			// The url was minted, then the delete landed.
			get: async () => null,
		});
		await insert(db, "t1", { imageKey: `transaction-photos/${USER}/a.jpg` });

		assert.equal(await downloadPhotos(db, peer, transport), 0);
		assert.equal(
			(await readRow(db, "t1")).imageKey,
			`transaction-photos/${USER}/a.jpg`,
		);
	});

	it("re-points to a file already on disk without fetching", async () => {
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		let fetched = 0;
		const { transport } = fakeTransport(undefined, {
			async readUrls(keys) {
				fetched += keys.length;
				return keys.map((key) => ({ key, url: `https://r2.test/get/${key}` }));
			},
		});
		await insert(db, "t1", { imageKey: `transaction-photos/${USER}/a.jpg` });

		await downloadPhotos(db, files, transport);

		assert.equal(fetched, 0);
		assert.equal((await readRow(db, "t1")).imageUri, `${DIRECTORY}/a.jpg`);
	});

	it("does not touch a row the user cleared the photo from", async () => {
		const db = makeDb();
		const peer = new FakeFiles(PEER_DIRECTORY);
		const { bucket, transport } = fakeTransport();
		bucket.objects.set(
			`transaction-photos/${USER}/a.jpg`,
			new TextEncoder().encode("PHOTO"),
		);
		// Removing a photo clears both halves, so there is nothing to resurrect.
		await insert(db, "t1", { imageUri: null, imageKey: null });

		assert.equal(await downloadPhotos(db, peer, transport), 0);
		assert.equal((await readRow(db, "t1")).imageUri, null);
	});

	it("serves two rows sharing one photo from a single fetch", async () => {
		const db = makeDb();
		const peer = new FakeFiles(PEER_DIRECTORY);
		const { bucket, transport } = fakeTransport();
		const key = `transaction-photos/${USER}/a.jpg`;
		bucket.objects.set(key, new TextEncoder().encode("PHOTO"));
		await insert(db, "t1", { imageKey: key });
		await insert(db, "t2", { imageKey: key });

		assert.equal(await downloadPhotos(db, peer, transport), 2);
		assert.equal((await readRow(db, "t1")).imageUri, `${PEER_DIRECTORY}/a.jpg`);
		assert.equal((await readRow(db, "t2")).imageUri, `${PEER_DIRECTORY}/a.jpg`);
	});
});

describe("runPhotoSync", () => {
	it("carries a photo from one device to another through the bucket", async () => {
		const bucket: FakeBucket = {
			objects: new Map(),
			confirmed: [],
			released: [],
		};

		const deviceA = makeDb();
		const filesA = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		await insert(deviceA, "t1", { imageUri: `${DIRECTORY}/a.jpg` });
		await runPhotoSync(deviceA, filesA, fakeTransport(bucket).transport, NOW);

		const key = (await readRow(deviceA, "t1")).imageKey;
		assert.equal(key, `transaction-photos/${USER}/a.jpg`);

		// The replicated row reaches B carrying the key and nothing else about the
		// photo — the path is A's and would not resolve here.
		const deviceB = makeDb();
		const filesB = new FakeFiles(PEER_DIRECTORY);
		await insert(deviceB, "t1", { imageKey: key });

		const result = await runPhotoSync(
			deviceB,
			filesB,
			fakeTransport(bucket).transport,
			NOW,
		);

		assert.equal(result.downloaded, 1);
		assert.deepEqual(filesB.read("a.jpg"), new TextEncoder().encode("PHOTO"));
		assert.equal(
			(await readRow(deviceB, "t1")).imageUri,
			`${PEER_DIRECTORY}/a.jpg`,
		);
	});

	it("is idempotent", async () => {
		const bucket: FakeBucket = {
			objects: new Map(),
			confirmed: [],
			released: [],
		};
		const db = makeDb();
		const files = new FakeFiles(DIRECTORY, [["a.jpg", "PHOTO"]]);
		await insert(db, "t1", { imageUri: `${DIRECTORY}/a.jpg` });

		await runPhotoSync(db, files, fakeTransport(bucket).transport, NOW);
		const second = await runPhotoSync(
			db,
			files,
			fakeTransport(bucket).transport,
			NOW,
		);

		assert.deepEqual(second, { uploaded: 0, downloaded: 0, released: 0 });
		assert.equal(bucket.confirmed.length, 1);
	});
});

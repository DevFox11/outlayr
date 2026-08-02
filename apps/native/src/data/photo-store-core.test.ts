import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { transactions } from "@/db/schema";
import type { SpendDb } from "./budget-spent";
import {
	PHOTO_PURGE_GRACE_MS,
	type PhotoFiles,
	photoExtension,
	photoFileName,
	photoUriFor,
	reconcilePhotos,
} from "./photo-store-core";

const DIRECTORY = "file:///container/Documents/transaction-photos";
const NOW = Date.UTC(2026, 6, 29, 12);
/** Older than the grace window, so nothing in the fixtures is spared by age. */
const SETTLED = NOW - PHOTO_PURGE_GRACE_MS - 1;

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

async function insert(
	db: SpendDb,
	id: string,
	imageUri: string | null,
	deletedAt: Date | null = null,
) {
	const date = new Date(NOW);
	await db.insert(transactions).values({
		id,
		amount: 10,
		income: false,
		note: id,
		date,
		day: date,
		month: date,
		imageUri,
		updatedAt: date,
		deletedAt,
	});
}

async function storedUri(db: SpendDb, id: string): Promise<string | null> {
	const rows = await db
		.select({ id: transactions.id, imageUri: transactions.imageUri })
		.from(transactions);
	return rows.find((row) => row.id === id)?.imageUri ?? null;
}

class FakeFiles implements PhotoFiles {
	readonly directoryUri = DIRECTORY;
	files: Map<string, number>;
	/** Outside files that are still readable — a picker cache not yet reclaimed. */
	sources: Set<string>;
	removed: string[] = [];

	constructor(files: [string, number][] = [], sources: string[] = []) {
		this.files = new Map(files);
		this.sources = new Set(sources);
	}

	list() {
		return [...this.files].map(([name, modifiedAt]) => ({ name, modifiedAt }));
	}

	remove(name: string) {
		this.files.delete(name);
		this.removed.push(name);
	}

	adopt(sourceUri: string, name: string) {
		if (!this.sources.has(sourceUri)) {
			return false;
		}
		this.files.set(name, NOW);
		return true;
	}

	read() {
		return null;
	}

	write(name: string) {
		this.files.set(name, NOW);
	}
}

describe("photoFileName", () => {
	it("takes the last path segment", () => {
		expect(photoFileName(`${DIRECTORY}/abc.jpg`)).toBe("abc.jpg");
	});

	it("drops a query string", () => {
		expect(photoFileName("file:///tmp/abc.jpg?width=100")).toBe("abc.jpg");
	});

	it("is empty for a uri with no final segment", () => {
		expect(photoFileName("file:///tmp/")).toBe("");
	});
});

describe("photoUriFor", () => {
	it("joins without doubling the separator", () => {
		expect(photoUriFor(`${DIRECTORY}/`, "a.jpg")).toBe(`${DIRECTORY}/a.jpg`);
	});
});

describe("photoExtension", () => {
	it("lowercases what it finds", () => {
		expect(photoExtension("PHOTO.JPEG")).toBe(".jpeg");
	});

	it("falls back when there is no extension", () => {
		expect(photoExtension("photo")).toBe(".jpg");
	});

	it("falls back when a dotted name has no plausible extension", () => {
		expect(photoExtension("2026.07.29-groceries")).toBe(".jpg");
	});

	it("ignores a leading dot", () => {
		expect(photoExtension(".hidden")).toBe(".jpg");
	});
});

describe("reconcilePhotos", () => {
	let db: SpendDb;

	beforeEach(() => {
		db = makeDb();
	});

	it("leaves a row whose file is already in place untouched", async () => {
		const uri = `${DIRECTORY}/keep.jpg`;
		await insert(db, "t1", uri);
		const files = new FakeFiles([["keep.jpg", SETTLED]]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(await storedUri(db, "t1")).toBe(uri);
		expect(result).toStrictEqual({
			repointed: 0,
			rescued: 0,
			cleared: 0,
			purged: 0,
		});
	});

	it("re-points a row at the current container path", async () => {
		await insert(db, "t1", "file:///old-container/Documents/photos/keep.jpg");
		const files = new FakeFiles([["keep.jpg", SETTLED]]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(await storedUri(db, "t1")).toBe(`${DIRECTORY}/keep.jpg`);
		expect(result.repointed).toBe(1);
		expect(result.purged).toBe(0);
	});

	it("adopts a cache-directory photo that is still readable", async () => {
		const cached = "file:///tmp/ImagePicker/AB-CD.jpeg";
		await insert(db, "t1", cached);
		const files = new FakeFiles([], [cached]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(await storedUri(db, "t1")).toBe(`${DIRECTORY}/t1.jpeg`);
		expect(result.rescued).toBe(1);
		expect(result.purged).toBe(0);
	});

	it("clears a row whose photo is gone", async () => {
		await insert(db, "t1", "file:///tmp/ImagePicker/reclaimed.jpg");
		const files = new FakeFiles();

		const result = await reconcilePhotos(db, files, NOW);

		expect(await storedUri(db, "t1")).toBe(null);
		expect(result.cleared).toBe(1);
	});

	it("purges a file no row references", async () => {
		await insert(db, "t1", `${DIRECTORY}/keep.jpg`);
		const files = new FakeFiles([
			["keep.jpg", SETTLED],
			["orphan.jpg", SETTLED],
		]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(files.removed).toStrictEqual(["orphan.jpg"]);
		expect(result.purged).toBe(1);
	});

	it("spares a file written inside the grace window", async () => {
		const files = new FakeFiles([["just-picked.jpg", NOW - 1_000]]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(files.removed).toStrictEqual([]);
		expect(result.purged).toBe(0);
	});

	it("keeps the photo of a soft-deleted row", async () => {
		await insert(db, "t1", `${DIRECTORY}/keep.jpg`, new Date(NOW));
		const files = new FakeFiles([["keep.jpg", SETTLED]]);

		const result = await reconcilePhotos(db, files, NOW);

		expect(files.removed).toStrictEqual([]);
		expect(await storedUri(db, "t1")).toBe(`${DIRECTORY}/keep.jpg`);
		expect(result.purged).toBe(0);
	});

	it("is idempotent", async () => {
		const cached = "file:///tmp/ImagePicker/AB-CD.jpeg";
		await insert(db, "t1", cached);
		await insert(db, "t2", "file:///tmp/ImagePicker/reclaimed.jpg");
		const files = new FakeFiles([["orphan.jpg", SETTLED]], [cached]);

		await reconcilePhotos(db, files, NOW);
		const second = await reconcilePhotos(db, files, NOW);

		expect(second).toStrictEqual({
			repointed: 0,
			rescued: 0,
			cleared: 0,
			purged: 0,
		});
		expect(await storedUri(db, "t1")).toBe(`${DIRECTORY}/t1.jpeg`);
		expect(await storedUri(db, "t2")).toBe(null);
	});
});

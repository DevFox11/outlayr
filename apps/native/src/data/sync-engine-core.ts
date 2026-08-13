import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "@/db/client";
import {
	accounts,
	appMeta,
	budgets,
	categories,
	mainBudget,
	outbox,
	tags,
	transactionPhotos,
	transactionSplits,
	transactions,
	transactionTags,
	transfers,
} from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import {
	getOrCreateDeviceId,
	getSyncCursor,
	isSyncEnabled,
	type SYNCED_TABLES,
	setSyncCursor,
} from "./sync-outbox-core";

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Mirrors `PUSH_BATCH_LIMIT` in `packages/backend/convex/sync.ts`. */
export const PUSH_BATCH_LIMIT = 500;

/** Mirrors `PULL_PAGE_LIMIT` in `packages/backend/convex/sync.ts`. */
export const PULL_PAGE_LIMIT = 1000;

/** SQLite binds a bounded number of variables per statement. */
const ID_CHUNK = 300;

export interface WireRow {
	deletedAt: number | null;
	fields: Record<string, unknown>;
	localId: string;
	table: SyncedTable;
	updatedAt: number;
}

export interface PulledRow extends WireRow {
	deviceId: string;
	seq: number;
}

export type PushFn = (args: {
	deviceId: string;
	rows: WireRow[];
}) => Promise<{ accepted: number; skipped: number; nextSeq: number }>;

export type PullFn = (args: {
	cursor: number;
	limit: number;
}) => Promise<{ rows: PulledRow[]; cursor: number; hasMore: boolean }>;

interface TableSpec {
	/** Stored as `Date` locally and as epoch milliseconds on the wire. */
	dates: readonly string[];
	/**
	 * The replicated payload, which must name exactly the columns the Convex
	 * table declares in `packages/backend/convex/lib/syncTables.ts`. A column
	 * missing here replicates as permanently absent rather than as an error, so
	 * `sync-engine-core.test.ts` checks this list against the local schema.
	 */
	fields: readonly string[];
	id: SQLiteColumn;
	table: SQLiteTable;
}

const SPECS: Record<SyncedTable, TableSpec> = {
	accounts: {
		dates: ["initialBalanceDate", "dateCreated"],
		// `imageUri` is absent for the same reason it is on `transactions`.
		fields: [
			"name",
			"currency",
			"initialBalance",
			"initialBalanceUsd",
			"initialBalanceDate",
			"icon",
			"emoji",
			"customColor",
			"imageColor",
			"imageKey",
			"sortOrder",
			"dateCreated",
		],
		id: accounts.id,
		table: accounts,
	},
	appMeta: {
		dates: [],
		fields: ["value"],
		id: appMeta.key,
		table: appMeta,
	},
	budgets: {
		dates: ["startDate", "dateCreated"],
		fields: [
			"name",
			"amount",
			"type",
			"startDate",
			"dateCreated",
			"currency",
			"amountUsd",
			"green",
			"rollover",
			"categoryId",
		],
		id: budgets.id,
		table: budgets,
	},
	categories: {
		dates: ["dateCreated"],
		fields: ["name", "color", "icon", "emoji", "income", "sortOrder", "dateCreated", "parentId"],
		id: categories.id,
		table: categories,
	},
	mainBudget: {
		dates: ["startDate", "dateCreated"],
		fields: ["name", "amount", "type", "startDate", "dateCreated", "currency", "amountUsd", "green", "rollover"],
		id: mainBudget.id,
		table: mainBudget,
	},
	tags: {
		dates: [],
		fields: ["name", "color", "sortOrder"],
		id: tags.id,
		table: tags,
	},
	transactionPhotos: {
		dates: [],
		// `imageUri` is absent on purpose: it is a path into THIS device's
		// container, meaningless on another and stale here after an update.
		fields: ["transactionId", "imageKey", "imageColor", "sortOrder"],
		id: transactionPhotos.id,
		table: transactionPhotos,
	},
	transactionSplits: {
		dates: [],
		fields: ["transactionId", "categoryId", "amount", "sortOrder"],
		id: transactionSplits.id,
		table: transactionSplits,
	},
	transactions: {
		dates: ["date", "day", "month", "recurringEndDate"],
		fields: [
			"amount",
			"income",
			"currency",
			"note",
			"details",
			"date",
			"day",
			"month",
			"icon",
			"emoji",
			"customColor",
			"imageColor",
			// `imageUri` is deliberately absent: a device-local container path is
			// worthless on the receiving handset, and replicating it lost photos.
			// The receiver could not resolve the path, its launch reconciliation
			// nulled the column, and the resulting push tie-broke on `deviceId` — so
			// the ORIGINATING device pulled back a null for a photo it still held.
			// `imageKey` is the replicated half; the bytes travel via `photos.ts`.
			"imageKey",
			"onceRecurring",
			"recurringType",
			"recurringCoefficient",
			"recurringEndDate",
			"recurringAnchorDay",
			"categoryId",
			"accountId",
			"amountUsd",
			"exchangeRate",
			"exchangeRateType",
			"transferId",
		],
		id: transactions.id,
		table: transactions,
	},
	transactionTags: {
		dates: [],
		fields: ["transactionId", "tagId"],
		id: transactionTags.id,
		table: transactionTags,
	},
	transfers: {
		dates: ["date", "day", "month", "dateCreated"],
		fields: [
			"fromAccountId",
			"toAccountId",
			"fromAmount",
			"fromCurrency",
			"fromAmountUsd",
			"toAmount",
			"toCurrency",
			"toAmountUsd",
			"exchangeRate",
			"exchangeRateType",
			"date",
			"day",
			"month",
			"note",
			"dateCreated",
		],
		id: transfers.id,
		table: transfers,
	},
};

export function specFor(table: SyncedTable): TableSpec {
	return SPECS[table];
}

// A runtime table name erases the generated row type, and every read below is
// keyed by a name checked against `SPECS`. The alternative is six copies of each
// helper.
type Row = Record<string, unknown>;
interface AnyWriter {
	select: (columns?: unknown) => {
		from: (table: SQLiteTable) => {
			where: (clause: unknown) => Promise<Row[]>;
		};
	};
}

function toEpoch(value: unknown): number | null {
	return value instanceof Date ? value.getTime() : null;
}

function toWireFields(spec: TableSpec, row: Row): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	for (const name of spec.fields) {
		const value = row[name];
		fields[name] = spec.dates.includes(name) ? toEpoch(value) : (value ?? null);
	}
	return fields;
}

function toLocalDate(value: unknown): Date | null {
	return typeof value === "number" ? new Date(value) : null;
}

function toLocalFields(spec: TableSpec, fields: Record<string, unknown>): Row {
	const local: Row = {};
	for (const name of spec.fields) {
		const value = fields[name] ?? null;
		local[name] = spec.dates.includes(name) ? toLocalDate(value) : value;
	}
	return local;
}

function chunked<T>(values: readonly T[]): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < values.length; start += ID_CHUNK) {
		chunks.push(values.slice(start, start + ID_CHUNK));
	}
	return chunks;
}

async function rowsById(db: Database, table: SyncedTable, ids: readonly string[]): Promise<Map<string, Row>> {
	const spec = SPECS[table];
	const batches = await Promise.all(
		chunked(ids).map(
			(chunk) =>
				(db as unknown as AnyWriter)
					.select()
					.from(spec.table)
					.where(inArray(spec.id, [...chunk])) as Promise<Row[]>
		)
	);
	const found = new Map<string, Row>();
	for (const rows of batches) {
		for (const row of rows) {
			found.set(String(row[spec.id.name]), row);
		}
	}
	return found;
}

function groupByTable<T extends { tableName: string; localId: string }>(entries: readonly T[]): Map<SyncedTable, T[]> {
	const grouped = new Map<SyncedTable, T[]>();
	for (const entry of entries) {
		const table = entry.tableName as SyncedTable;
		if (!(table in SPECS)) {
			continue;
		}
		const bucket = grouped.get(table) ?? [];
		bucket.push(entry);
		grouped.set(table, bucket);
	}
	return grouped;
}

/**
 * S6 — the durable push. Reads the outbox oldest-first, joins out the current
 * state of each queued row, and clears exactly the queue entries it pushed.
 *
 * Entries are cleared by their autoincrement `seq`, never by `(table, localId)`:
 * an edit that lands while a batch is in flight re-queues the same row under a
 * NEW seq, and deleting by identity would silently drop it.
 *
 * A queue entry whose row no longer exists is dropped rather than pushed. The
 * delete trigger normally removes those, so this only covers a store that was
 * modified outside them.
 */
export async function drainOutbox(db: Database, push: PushFn): Promise<number> {
	if (!(await isSyncEnabled(db))) {
		return 0;
	}
	const deviceId = await getOrCreateDeviceId(db);
	let pushed = 0;

	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: each pass reads the outbox left behind by the previous pass's push and delete, so the batches cannot overlap
		const queued = await db.select().from(outbox).orderBy(asc(outbox.seq)).limit(PUSH_BATCH_LIMIT);
		if (queued.length === 0) {
			return pushed;
		}

		const grouped = groupByTable(queued);
		const loaded = new Map<SyncedTable, Map<string, Row>>(
			await Promise.all(
				[...grouped].map(
					async ([table, entries]) =>
						[
							table,
							await rowsById(
								db,
								table,
								entries.map((entry) => entry.localId)
							),
						] as const
				)
			)
		);

		const rows: WireRow[] = [];
		for (const entry of queued) {
			const table = entry.tableName as SyncedTable;
			const row = loaded.get(table)?.get(entry.localId);
			if (!row) {
				continue;
			}
			const spec = SPECS[table];
			rows.push({
				deletedAt: table === "appMeta" ? null : toEpoch(row.deletedAt),
				fields: toWireFields(spec, row),
				localId: entry.localId,
				table,
				// `appMeta` has no clock of its own, so the enqueue time is the only
				// honest "when did this device last say so" it can carry.
				updatedAt: table === "appMeta" ? (toEpoch(entry.enqueuedAt) ?? 0) : (toEpoch(row.updatedAt) ?? 0),
			});
		}

		if (rows.length > 0) {
			await push({ deviceId, rows });
			pushed += rows.length;
		}

		for (const chunk of chunked(queued.map((entry) => entry.seq))) {
			// biome-ignore lint/performance/noAwaitInLoops: chunking only exists to stay under SQLite's bound-parameter limit, and one connection serialises writers anyway, so overlapping these deletes buys contention rather than parallelism
			await db.delete(outbox).where(inArray(outbox.seq, chunk));
		}

		if (queued.length < PUSH_BATCH_LIMIT) {
			return pushed;
		}
	}
}

interface LocalVersion {
	deletedAt: number | null;
	/** Null for a table with no clock of its own — `appMeta` is the only one. */
	updatedAt: number | null;
}

/**
 * R1 then R2 from `docs/convex-sync-design.md` §4, from the device's side.
 *
 * A local row carries no `deviceId`, so an exact `updatedAt` tie cannot break
 * the way the server's does. It breaks on whether this device still owes the
 * row a push: an unsent edit is work the server has never arbitrated, and
 * overwriting it here would push the peer's value back up under the local row's
 * identity. Everything else defers to the incoming row, which the server has
 * already declared the account's winner.
 */
export function incomingWinsLocally(
	incoming: { updatedAt: number; deletedAt: number | null },
	local: LocalVersion | null,
	localIsPending: boolean
): boolean {
	if (local === null) {
		return true;
	}
	// `appMeta` has no `updatedAt` column, so there is no clock to compare and
	// every incoming value would otherwise outrank the local one. Whether the key
	// is still owed a push is the only signal there is.
	if (local.updatedAt === null) {
		return !localIsPending;
	}
	const incomingDeleted = incoming.deletedAt !== null;
	const localDeleted = local.deletedAt !== null;
	if (incomingDeleted !== localDeleted) {
		return incomingDeleted;
	}
	if (incoming.updatedAt !== local.updatedAt) {
		return incoming.updatedAt > local.updatedAt;
	}
	return !localIsPending;
}

/**
 * R3's tie-break, and the reason it is not the server's.
 *
 * The design names `(updatedAt, deviceId)`, but the local schema has no
 * `deviceId` column — the id does the same job here and better: both devices
 * hold the same pair of rows and so compute the same survivor, which is the
 * only property the rule needs.
 */
function keepsCategory(
	incoming: { updatedAt: number; localId: string },
	rival: { updatedAt: number; id: string }
): boolean {
	if (incoming.updatedAt !== rival.updatedAt) {
		return incoming.updatedAt > rival.updatedAt;
	}
	return incoming.localId > rival.id;
}

export interface ApplyResult {
	applied: number;
	tables: SyncedTable[];
}

/**
 * S7 — applies one pulled page in a single local transaction and advances the
 * cursor with it, so a crash mid-apply replays the page rather than skipping it.
 *
 * Foreign keys are switched off around the batch by {@link applyPulledRows}:
 * `seq` is last-modified order, so a category edited today sorts AFTER a
 * transaction created against it last year, and no ordering of the page can
 * make the references resolve.
 *
 * The outbox entries the applier's own writes create are deleted inside the
 * same transaction. Atomically, so there is no window in which a pulled row is
 * queued to be pushed straight back — a pull→push echo that would never settle.
 * Only rows actually written are cleared: a local edit that WON its merge is
 * still owed to the server.
 */
async function applyInTransaction(
	db: Database,
	page: { rows: readonly PulledRow[]; cursor: number },
	now: Date
): Promise<ApplyResult> {
	const pending = new Set(
		(await db.select({ localId: outbox.localId, tableName: outbox.tableName }).from(outbox)).map(
			(entry) => `${entry.tableName} ${entry.localId}`
		)
	);

	const byTable = new Map<SyncedTable, PulledRow[]>();
	for (const row of page.rows) {
		if (!(row.table in SPECS)) {
			continue;
		}
		const bucket = byTable.get(row.table) ?? [];
		bucket.push(row);
		byTable.set(row.table, bucket);
	}

	const existing = new Map<SyncedTable, Map<string, Row>>(
		await Promise.all(
			[...byTable].map(
				async ([table, rows]) =>
					[
						table,
						await rowsById(
							db,
							table,
							rows.map((row) => row.localId)
						),
					] as const
			)
		)
	);

	const winners: PulledRow[] = [];
	for (const row of page.rows) {
		if (!(row.table in SPECS)) {
			continue;
		}
		const local = existing.get(row.table)?.get(row.localId);
		const localVersion =
			local === undefined
				? null
				: {
						deletedAt: row.table === "appMeta" ? null : toEpoch(local.deletedAt),
						updatedAt: row.table === "appMeta" ? null : (toEpoch(local.updatedAt) ?? 0),
					};
		const isPending = pending.has(`${row.table} ${row.localId}`);
		if (incomingWinsLocally(row, localVersion, isPending)) {
			winners.push(row);
		}
	}

	const touched = new Set<SyncedTable>();

	await withTransaction(db, async () => {
		const replicatedVerbatim: PulledRow[] = [];
		for (const row of winners) {
			// A row R3 rewrote is NOT what the server holds, so it stays queued and
			// this device pushes its correction rather than silently diverging.
			// biome-ignore lint/performance/noAwaitInLoops: R3 resolution inside writeRow reads the budgets an earlier winner left live, so the winners must be written one at a time
			if (await writeRow(db, row, now)) {
				replicatedVerbatim.push(row);
			}
			touched.add(row.table);
		}

		const cleared = groupByTable(
			replicatedVerbatim.map((row) => ({
				localId: row.localId,
				tableName: row.table,
			}))
		);
		for (const [table, entries] of cleared) {
			for (const chunk of chunked(entries.map((entry) => entry.localId))) {
				// biome-ignore lint/performance/noAwaitInLoops: these deletes run inside one SQLite transaction, which admits a single writer, so they cannot overlap
				await db.delete(outbox).where(and(eq(outbox.tableName, table), inArray(outbox.localId, chunk)));
			}
		}

		// After the outbox is cleared, so the tombstones this writes stay queued:
		// converging the other device depends on them being pushed back.
		if (await reconcileMainBudget(db, now)) {
			touched.add("mainBudget");
		}

		await setSyncCursor(db, page.cursor);
	});

	return { applied: winners.length, tables: [...touched] };
}

/**
 * `budgets.categoryId` is UNIQUE locally and unconstrained on the server, so
 * two offline devices can each create a budget for the same category and the
 * second row cannot even be inserted here. R3 is therefore resolved at the
 * write, not in a pass afterwards.
 *
 * Both devices see the same pair and pick the same survivor, so device A
 * tombstones its local rival and device B writes the incoming loser already
 * tombstoned. Both push their tombstone, and R1 makes it absorbing, so the
 * account converges on one live budget per category.
 */
async function resolveBudgetCategory(db: Database, row: PulledRow, now: Date): Promise<boolean> {
	const { categoryId } = row.fields;
	if (row.deletedAt !== null || typeof categoryId !== "string") {
		return false;
	}

	const rivals = await db
		.select({ id: budgets.id, updatedAt: budgets.updatedAt })
		.from(budgets)
		.where(and(eq(budgets.categoryId, categoryId), isNull(budgets.deletedAt)));

	let incomingLoses = false;
	for (const rival of rivals) {
		if (rival.id === row.localId) {
			continue;
		}
		if (keepsCategory(row, { id: rival.id, updatedAt: rival.updatedAt.getTime() })) {
			// biome-ignore lint/performance/noAwaitInLoops: this runs inside the apply transaction, which admits a single writer, so the rival tombstones cannot overlap
			await db
				.update(budgets)
				.set({ categoryId: null, deletedAt: now, updatedAt: now })
				.where(eq(budgets.id, rival.id));
		} else {
			incomingLoses = true;
		}
	}
	return incomingLoses;
}

/**
 * Whether the incoming transaction arrives with no live schedule — either
 * tombstoned, or retired to `none` because the peer's sweep moved the chain on to
 * a successor.
 */
function retiresSchedule(values: Row): boolean {
	return values.deletedAt != null || values.recurringType === 0;
}

/** Answers whether the row landed verbatim, or was rewritten by R3. */
async function writeRow(db: Database, row: PulledRow, now: Date): Promise<boolean> {
	const spec = SPECS[row.table];

	if (row.table === "appMeta") {
		// Written directly rather than through `setMeta`, which cannot express a
		// null value — and a key whose value is genuinely null must not arrive here
		// as an empty string.
		const value = (row.fields.value ?? null) as string | null;
		await db
			.insert(appMeta)
			.values({ key: row.localId, value })
			.onConflictDoUpdate({ set: { value }, target: appMeta.key });
		return true;
	}

	const lostCategory = row.table === "budgets" && (await resolveBudgetCategory(db, row, now));

	const values: Row = {
		...toLocalFields(spec, row.fields),
		[spec.id.name]: row.localId,
		deletedAt: lostCategory ? now : toLocalDate(row.deletedAt),
		updatedAt: lostCategory ? now : new Date(row.updatedAt),
	};
	if (lostCategory) {
		values.categoryId = null;
	}
	if (row.table === "transactions" && retiresSchedule(values)) {
		// `reminderLeadDays` is device-local, so it is absent from the incoming
		// fields and an `onConflictDoUpdate` would leave this handset's value on a
		// row a peer has just settled — a live notice on a charge that is already
		// taken. The preference does not survive a peer-driven hand-off either way;
		// what matters is that it cannot outlive its schedule.
		values.reminderLeadDays = null;
	}

	const writer = db as unknown as {
		insert: (table: SQLiteTable) => {
			values: (row: Row) => {
				onConflictDoUpdate: (config: { target: SQLiteColumn; set: Row }) => Promise<unknown>;
			};
		};
	};
	await writer.insert(spec.table).values(values).onConflictDoUpdate({ set: values, target: spec.id });
	return !lostCategory;
}

/**
 * The overall budget is a singleton by convention rather than by constraint, so
 * unlike `budgets` it can hold two live rows and is reconciled after the write.
 */
async function reconcileMainBudget(db: Database, now: Date): Promise<boolean> {
	const live = await db
		.select({ id: mainBudget.id, updatedAt: mainBudget.updatedAt })
		.from(mainBudget)
		.where(isNull(mainBudget.deletedAt));
	if (live.length < 2) {
		return false;
	}

	const survivor = live.reduce((best, row) =>
		keepsCategory(
			{ localId: row.id, updatedAt: row.updatedAt.getTime() },
			{ id: best.id, updatedAt: best.updatedAt.getTime() }
		)
			? row
			: best
	);

	for (const row of live) {
		if (row.id === survivor.id) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: this runs inside the apply transaction, which admits a single writer, so the tombstones cannot overlap
		await db.update(mainBudget).set({ deletedAt: now, updatedAt: now }).where(eq(mainBudget.id, row.id));
	}
	return true;
}

/**
 * Runs the batch with foreign keys off and restores enforcement only if it was
 * on to begin with — `db/client.ts` deliberately leaves it off for a store that
 * already holds orphans, and turning it on here would break that.
 */
export async function applyPulledRows(
	db: Database,
	page: { rows: readonly PulledRow[]; cursor: number },
	now: Date = new Date()
): Promise<ApplyResult> {
	if (page.rows.length === 0) {
		return { applied: 0, tables: [] };
	}

	const before = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
	const wasOn = before[0]?.foreign_keys === 1;

	// A no-op inside a transaction, which is why it is issued out here.
	if (wasOn) {
		await db.run(sql`PRAGMA foreign_keys = OFF`);
	}
	try {
		return await applyInTransaction(db, page, now);
	} finally {
		if (wasOn) {
			await db.run(sql`PRAGMA foreign_keys = ON`);
		}
	}
}

/**
 * Walks the account's change log from this device's cursor to its end.
 *
 * The `cursor` guard is not paranoia: a page that returns rows but does not
 * advance the watermark would otherwise be replayed forever.
 */
export async function pullAndApply(db: Database, pull: PullFn, now: Date = new Date()): Promise<ApplyResult> {
	if (!(await isSyncEnabled(db))) {
		return { applied: 0, tables: [] };
	}

	let cursor = await getSyncCursor(db);
	let applied = 0;
	const tables = new Set<SyncedTable>();

	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: each page is fetched from the cursor the previous page returned, so the walk is inherently sequential
		const page = await pull({ cursor, limit: PULL_PAGE_LIMIT });
		if (page.rows.length === 0) {
			return { applied, tables: [...tables] };
		}
		const result = await applyPulledRows(db, page, now);
		applied += result.applied;
		for (const table of result.tables) {
			tables.add(table);
		}
		if (page.cursor <= cursor) {
			return { applied, tables: [...tables] };
		}
		({ cursor } = page);
		if (!page.hasMore) {
			return { applied, tables: [...tables] };
		}
	}
}

/**
 * One replication cycle. Push first: an edit made here reaches the server
 * before the pull can hand this device a peer's version of the same row, which
 * is what keeps the common case out of conflict resolution entirely.
 */
export async function runSync(
	db: Database,
	transport: { push: PushFn; pull: PullFn },
	now: Date = new Date()
): Promise<{ pushed: number; applied: number; tables: SyncedTable[] }> {
	const pushed = await drainOutbox(db, transport.push);
	const { applied, tables } = await pullAndApply(db, transport.pull, now);
	return { applied, pushed, tables };
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Alert } from "react-native";
import type { ImportPlan } from "@/data/transfer-core";
import * as transferCore from "@/data/transfer-core";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { INITIAL_IMPORT_FLOW_STATE } from "@/domain/import-flow";
import { importDraftStore } from "@/lib/import-draft-store";
import { buildReviewRows, useImportReview } from "./use-import-review";

const mockBack = jest.fn();

jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));

const dbHolder: { current: Database | null } = { current: null };
jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => dbHolder.current,
	useLocalData: () => ({ db: dbHolder.current }),
}));

const MIGRATIONS = join(__dirname, "../../drizzle");

function migratedDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
			"--> statement-breakpoint",
		)) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

const NOW = new Date(2026, 6, 29, 12);

async function seedCategories(db: Database) {
	await db.insert(categories).values([
		{ id: "cat-food", name: "Groceries", income: false, updatedAt: NOW },
		{ id: "cat-pay", name: "Paycheck", income: true, updatedAt: NOW },
	]);
}

const ROWS = [
	["Food", "Bakery", "2026-07-28", "12.50"],
	["Pay", "Salary", "2026-07-27", "2400"],
];
const MAPPING = {
	category: 0,
	note: 1,
	date: 2,
	amount: 3,
	currency: null,
	type: null,
};
const LINKS = new Map([
	["food", "cat-food"],
	["pay", "cat-pay"],
]);

function withReview() {
	importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
	importDraftStore.dispatch({
		type: "fileParsed",
		file: { name: "bank.csv", chars: 80 },
		parsed: { header: null, rows: ROWS, width: 4 },
		draft: MAPPING,
		resolved: { mapping: MAPPING, labelSource: "categoryColumn" },
		gaps: [],
	});
	importDraftStore.dispatch({
		type: "resolutionSettled",
		outcome: "applied",
		reason: null,
		links: LINKS,
		fromModel: new Set(),
	});
	importDraftStore.setStep("review");
}

beforeEach(() => {
	dbHolder.current = migratedDb();
	importDraftStore.clear();
	mockBack.mockClear();
});

describe("buildReviewRows", () => {
	const plan: ImportPlan = {
		entries: [
			{
				note: "Bakery",
				categoryId: "cat-food",
				income: false,
				amount: 12.5,
				currency: null,
				date: new Date(2026, 6, 28),
			},
			{
				note: "Salary",
				categoryId: "cat-pay",
				income: true,
				amount: 2400,
				currency: null,
				date: new Date(2026, 6, 27),
			},
		],
		skipped: [{ row: 3, reason: "amount" }],
		earliest: new Date(2026, 6, 27),
		latest: new Date(2026, 6, 28),
	};

	it("maps every entry in order, flagging duplicates from the given set", () => {
		const rows = buildReviewRows(plan, new Set([1]));
		expect(rows[0]).toMatchObject({
			kind: "entry",
			index: 0,
			duplicate: false,
		});
		expect(rows[1]).toMatchObject({ kind: "entry", index: 1, duplicate: true });
	});

	it("appends a trailing header and skipped rows when any exist", () => {
		const rows = buildReviewRows(plan, new Set());
		expect(rows[2]).toStrictEqual({
			kind: "header",
			key: "skipped-header",
			count: 1,
		});
		expect(rows[3]).toStrictEqual({
			kind: "skipped",
			key: "skipped-3",
			row: 3,
			reason: "amount",
		});
	});

	it("omits the header entirely when nothing was skipped", () => {
		const rows = buildReviewRows({ ...plan, skipped: [] }, new Set());
		expect(rows.some((row) => row.kind === "header")).toBe(false);
	});
});

describe("useImportReview", () => {
	it("builds the plan from the settled flow, including each entry's resolved income", async () => {
		await seedCategories(dbHolder.current as Database);
		withReview();

		const { result } = await renderHook(() => useImportReview());

		await waitFor(() => expect(result.current.plan.entries.length).toBe(2));
		expect(result.current.plan.entries[0]?.income).toBe(false);
		expect(result.current.plan.entries[1]?.income).toBe(true);
		expect(result.current.selectedCount).toBe(2);
	});

	it("flags a row matching an existing transaction as a duplicate, unchecked by default", async () => {
		const db = dbHolder.current as Database;
		await seedCategories(db);
		await db.insert(transactions).values({
			id: "t-existing",
			amount: 12.5,
			income: false,
			note: "Bakery",
			categoryId: "cat-food",
			date: new Date(2026, 6, 28),
			day: new Date(2026, 6, 28),
			month: new Date(2026, 6, 1),
			updatedAt: NOW,
		});
		withReview();

		const { result } = await renderHook(() => useImportReview());

		await waitFor(() => expect(result.current.selectedCount).toBe(1));
		expect(result.current.excluded.has(0)).toBe(true);
		expect(result.current.rows[0]).toMatchObject({ duplicate: true });
	});

	it("preserves a manual re-check across a remount with the same resolution", async () => {
		const db = dbHolder.current as Database;
		await seedCategories(db);
		await db.insert(transactions).values({
			id: "t-existing",
			amount: 12.5,
			income: false,
			note: "Bakery",
			categoryId: "cat-food",
			date: new Date(2026, 6, 28),
			day: new Date(2026, 6, 28),
			month: new Date(2026, 6, 1),
			updatedAt: NOW,
		});
		withReview();

		const first = await renderHook(() => useImportReview());
		await waitFor(() =>
			expect(first.result.current.excluded.has(0)).toBe(true),
		);
		await act(async () => {
			first.result.current.onToggle(0);
		});
		expect(importDraftStore.getSnapshot().flow.excluded.has(0)).toBe(false);

		const second = await renderHook(() => useImportReview());
		await waitFor(() =>
			expect(second.result.current.plan.entries.length).toBe(2),
		);
		expect(second.result.current.excluded.has(0)).toBe(false);
	});

	it("onToggle keeps a stable identity across renders", async () => {
		await seedCategories(dbHolder.current as Database);
		withReview();

		const { result, rerender } = await renderHook(() => useImportReview());
		const first = result.current.onToggle;
		await act(async () => {
			rerender(undefined);
		});
		expect(result.current.onToggle).toBe(first);
	});

	it("onCommit writes every non-excluded entry, clears the draft, navigates back and reports success", async () => {
		const db = dbHolder.current as Database;
		await seedCategories(db);
		withReview();
		const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

		const { result } = await renderHook(() => useImportReview());
		await waitFor(() => expect(result.current.plan.entries.length).toBe(2));

		await act(async () => {
			result.current.onCommit();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect((await db.select().from(transactions)).length).toBe(2);
		expect(importDraftStore.getSnapshot().flow).toStrictEqual(
			INITIAL_IMPORT_FLOW_STATE,
		);
		expect(mockBack).toHaveBeenCalledTimes(1);
		expect(alertSpy).toHaveBeenCalledWith(
			"import.reviewCommitSuccessTitle",
			'import.reviewCommitSuccessBody:{"count":2}',
		);
		alertSpy.mockRestore();
	});

	it("onCommit failure keeps the sheet's selections intact and reports the failure, without navigating", async () => {
		await seedCategories(dbHolder.current as Database);
		withReview();
		const applySpy = jest
			.spyOn(transferCore, "applyImport")
			.mockRejectedValueOnce(new Error("disk full"));

		const { result } = await renderHook(() => useImportReview());
		await waitFor(() => expect(result.current.plan.entries.length).toBe(2));
		const excludedBefore = result.current.excluded;

		await act(async () => {
			result.current.onCommit();
			await Promise.resolve();
			await Promise.resolve();
		});

		await waitFor(() =>
			expect(importDraftStore.getSnapshot().flow.commit).toStrictEqual({
				phase: "failed",
				detail: "disk full",
			}),
		);
		expect(importDraftStore.getSnapshot().flow.excluded).toBe(excludedBefore);
		expect(mockBack).not.toHaveBeenCalled();
		applySpy.mockRestore();
	});
});

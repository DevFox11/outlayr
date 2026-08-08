import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRef } from "react";
import { seedCategories, seededCategoryId } from "@/data/categories-core";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import {
	CategoryPickerSheet,
	type CategoryPickerSheetRef,
} from "./category-picker-sheet";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		background: "#ffffff",
		foreground: "#010101",
		muted: "#6d6d6d",
		subtle: "#6c6c78",
		surface: "#f6f6f6",
		surfaceSecondary: "#f0f0f0",
		groupedBackground: "#f2f2f7",
		border: "#d2d6db",
		separator: "#d2d6db",
		accent: "#010101",
		accentForeground: "#ffffff",
		tint: "#0069de",
		income: "#027d51",
		expense: "#010101",
		future: "#6d6d6d",
		danger: "#da0f01",
		overBudget: "#da0f01",
		warning: "#d8a13a",
		railTrack: "rgba(0,0,0,.06)",
	}),
}));
jest.mock("@/i18n", () => ({
	useTranslation:
		() =>
		(key: string, params?: Record<string, string>): string =>
			params == null ? key : `${key}:${Object.values(params).join(",")}`,
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

const GROCERIES = seededCategoryId("Groceries", false);

async function seededDb(): Promise<Database> {
	const db = migratedDb();
	await seedCategories(db);
	return db;
}

function addChild(
	db: Database,
	id: string,
	name: string,
	parentId: string,
): void {
	db.insert(categories)
		.values({
			id,
			name,
			icon: "ShoppingCart01",
			color: "#34C759",
			income: false,
			sortOrder: 0,
			parentId,
			updatedAt: new Date(0),
		})
		.run();
}

function addTransaction(db: Database, categoryId: string, at: number): void {
	const date = new Date(at);
	db.insert(transactions)
		.values({
			id: `tx-${at}`,
			amount: 5,
			income: false,
			note: "",
			date,
			day: date,
			month: date,
			categoryId,
			updatedAt: date,
		})
		.run();
}

interface SheetOptions {
	db: Database;
	selectedId?: string | null;
	onSelect?: (category: { id: string; name: string | null }) => void;
	onCreate?: (name: string) => void;
	pendingCategory?: {
		name: string;
		icon: string;
		color: string;
		emoji: string | null;
		parentName: string | null;
	} | null;
}

async function mount(options: SheetOptions) {
	const ref = createRef<CategoryPickerSheetRef>();
	const view = await render(
		<CategoryPickerSheet
			db={options.db}
			income={false}
			onCreate={options.onCreate}
			onSelect={options.onSelect ?? (() => {})}
			pendingCategory={options.pendingCategory ?? null}
			ref={ref}
			selectedId={options.selectedId ?? null}
		/>,
	);
	await act(async () => {
		ref.current?.present();
	});
	return { ...view, ref };
}

async function type(query: string): Promise<void> {
	await act(async () => {
		fireEvent.changeText(screen.getByTestId("category-search"), query);
	});
}

/**
 * Not `fireEvent.press`: RN renders `Pressable`'s host view with `onClick` and
 * responder handlers but no `onPress`, so RNTL 14.0.1 finds no handler and the
 * press silently does nothing instead of failing.
 */
function press(testID: string): void {
	fireEvent(screen.getByTestId(testID), "click");
}

describe("CategoryPickerSheet", () => {
	it("renders a pending category as the top pick, with its willBeCreated caption", async () => {
		const { toJSON } = await mount({
			db: migratedDb(),
			pendingCategory: {
				name: "Entertainment",
				icon: "FilmRoll01",
				color: "#AF52DE",
				emoji: null,
				parentName: null,
			},
		});
		const json = JSON.stringify(toJSON());
		expect(json).toContain("Entertainment");
		expect(json).toContain("transaction.category.willBeCreated");
	});

	it("renders no pending row when there is no pending category", async () => {
		const { toJSON } = await mount({ db: migratedDb() });
		expect(JSON.stringify(toJSON())).not.toContain(
			"transaction.category.willBeCreated",
		);
	});

	it("expands the parent of a selected subcategory so its checkmark is reachable", async () => {
		const db = await seededDb();
		addChild(db, "organic", "Organic", GROCERIES);
		await mount({ db, selectedId: "organic" });

		expect(screen.getByText("Organic")).toBeTruthy();
	});

	it("leaves parents collapsed when the selection is top-level", async () => {
		const db = await seededDb();
		addChild(db, "organic", "Organic", GROCERIES);
		await mount({ db, selectedId: GROCERIES });

		expect(screen.queryByText("Organic")).toBeNull();
	});

	it("filters the list down to the categories that match", async () => {
		await mount({ db: await seededDb() });
		await type("rent");

		expect(screen.getByText("Rent")).toBeTruthy();
		expect(screen.queryByText("Groceries")).toBeNull();
	});

	it("surfaces a matching subcategory with its parent as a breadcrumb", async () => {
		const db = await seededDb();
		addChild(db, "organic", "Organic", GROCERIES);
		await mount({ db });
		await type("organic");

		expect(screen.getByText("Organic")).toBeTruthy();
		expect(screen.getByTestId("category-crumb-organic")).toBeTruthy();
	});

	it("selects a subcategory straight from the results, without expanding its parent", async () => {
		const db = await seededDb();
		addChild(db, "organic", "Organic", GROCERIES);
		const picked: string[] = [];
		await mount({ db, onSelect: (category) => picked.push(category.id) });
		await type("organic");

		press("category-row-organic");
		expect(picked).toEqual(["organic"]);
	});

	it("offers to create the typed name when nothing matches", async () => {
		const created: string[] = [];
		await mount({
			db: await seededDb(),
			onCreate: (name) => created.push(name),
		});
		await type("veterinary");

		expect(
			screen.getByText("transaction.category.noMatches:veterinary"),
		).toBeTruthy();
		press("category-create");
		expect(created).toEqual(["veterinary"]);
	});

	it("omits the create action when the host cannot create categories", async () => {
		await mount({ db: await seededDb() });
		await type("veterinary");

		expect(screen.queryByTestId("category-create")).toBeNull();
	});

	it("shows recently used categories ahead of the full list", async () => {
		const db = await seededDb();
		addTransaction(db, seededCategoryId("Rent", false), 2_000);
		await mount({ db });

		expect(screen.getByTestId("category-recents")).toBeTruthy();
	});

	it("hides the recents rail on a ledger with no history", async () => {
		await mount({ db: await seededDb() });
		expect(screen.queryByTestId("category-recents")).toBeNull();
	});

	it("hides the recents rail while searching", async () => {
		const db = await seededDb();
		addTransaction(db, seededCategoryId("Rent", false), 2_000);
		await mount({ db });
		await type("rent");

		expect(screen.queryByTestId("category-recents")).toBeNull();
	});
});

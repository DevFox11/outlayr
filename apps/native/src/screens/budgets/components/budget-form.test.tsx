import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Alert } from "react-native";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { budgetsRepo } from "@/data/budgets";
import { type Category, getCategoryById } from "@/data/categories-core";
import type { Database } from "@/db/client";
import { budgets, categories } from "@/db/schema";
import { BudgetForm } from "./budget-form";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
jest.mock("@/i18n/context", () => ({
	useLanguage: () => ({ language: "en" }),
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	SYSTEM_COLORS: {
		card: "#FFFFFF",
		groupedBackground: "#EFEDE6",
		separator: "#DAD6C9",
	},
	useColors: () => ({
		accent: "#3D7A5C",
		accentForeground: "#FFFFFF",
		background: "#F2F0EA",
		border: "#DAD6C9",
		danger: "#B5482F",
		expense: "#B5482F",
		foreground: "#17150F",
		future: "#8A8578",
		groupedBackground: "#EFEDE6",
		income: "#3D7A5C",
		muted: "#8A8578",
		overBudget: "#B5482F",
		railTrack: "rgba(0,0,0,0.08)",
		separator: "#DAD6C9",
		subtle: "#B4AFA0",
		surface: "#FFFFFF",
		surfaceSecondary: "#F7F5EF",
		tint: "#3D7A5C",
		warning: "#C08A2E",
	}),
}));

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => dbHolder.current,
	useLocalData: () => ({ db: dbHolder.current }),
}));

jest.mock("@/components/segmented-control", () => ({
	SegmentedControl: ({
		options,
		onChange,
	}: {
		options: readonly { label: string; value: string }[];
		onChange: (value: string) => void;
	}) => {
		const { Pressable, Text } = require("react-native");
		return options.map((option: { label: string; value: string }) => (
			<Pressable accessibilityRole="button" key={option.value} onPress={() => onChange(option.value)}>
				<Text>{option.label}</Text>
			</Pressable>
		));
	},
}));

const selectedCategoryHolder: { current: Category | null } = { current: null };

jest.mock("@/components/amount-entry-sheet", () => ({
	AmountEntrySheet: ({
		value,
		onChange,
		ref,
	}: {
		value: string;
		onChange: (next: string) => void;
		ref?: { current: unknown };
	}) => {
		const { useImperativeHandle } = require("react");
		const { TextInput } = require("react-native");
		useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
		return <TextInput onChangeText={onChange} testID="amount-sheet-input" value={value} />;
	},
}));

jest.mock("@/components/category-picker-sheet", () => ({
	CategoryPickerSheet: ({ onSelect, ref }: { onSelect: (picked: Category) => void; ref?: { current: unknown } }) => {
		const { useImperativeHandle } = require("react");
		const { Pressable, Text } = require("react-native");
		useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
		return (
			<Pressable
				accessibilityRole="button"
				onPress={() => {
					if (selectedCategoryHolder.current) {
						onSelect(selectedCategoryHolder.current);
					}
				}}
				testID="category-picker-select"
			>
				<Text>pick</Text>
			</Pressable>
		);
	},
}));

const MIGRATIONS = join(import.meta.dirname, "../../../../drizzle");

function migratedDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

async function seedCategory(db: Database, id = "c1", name = "Groceries") {
	await db.insert(categories).values({
		color: "#3D7A5C",
		emoji: "🛒",
		id,
		income: false,
		name,
		sortOrder: 0,
		updatedAt: new Date(),
	});
	return id;
}

function Providers({ children }: { children: React.ReactNode }) {
	return <AppSettingsProvider>{children}</AppSettingsProvider>;
}

beforeEach(() => {
	dbHolder.current = migratedDb();
	selectedCategoryHolder.current = null;
});

describe("BudgetForm", () => {
	it("gates the CTA through kind, amount, and category before creating a category budget", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		selectedCategoryHolder.current = getCategoryById(db, categoryId);
		const onDone = jest.fn();

		const { getByText, getByRole, getByTestId } = await render(
			<Providers>
				<BudgetForm db={db} onDone={onDone} />
			</Providers>
		);

		expect(getByText("budgets.form.kindOverall")).toBeTruthy();
		expect(getByText("budgets.form.kindCategory")).toBeTruthy();

		const cta = () => getByRole("button", { name: "budgets.form.create" });
		expect(cta().props.accessibilityState?.disabled).toBe(true);

		await fireEvent.changeText(getByTestId("amount-sheet-input"), "25");
		expect(cta().props.accessibilityState?.disabled).toBe(false);

		await fireEvent.press(getByRole("button", { name: "budgets.form.kindCategory" }));
		expect(cta().props.accessibilityState?.disabled).toBe(true);

		await fireEvent.press(getByTestId("category-picker-select"));
		expect(cta().props.accessibilityState?.disabled).toBe(false);

		await fireEvent.press(cta());

		await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
		const created = await db.select().from(budgets);
		expect(created).toHaveLength(1);
		expect(created[0].amount).toBe(25);
		expect(created[0].categoryId).toBe(categoryId);
	});

	it("alerts and re-enables the CTA when createBudget rejects", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		selectedCategoryHolder.current = getCategoryById(db, categoryId);
		const onDone = jest.fn();
		const createSpy = jest.spyOn(budgetsRepo, "createBudget").mockRejectedValueOnce(new Error("boom"));
		const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

		const { getByRole, getByTestId } = await render(
			<Providers>
				<BudgetForm db={db} onDone={onDone} />
			</Providers>
		);

		await fireEvent.changeText(getByTestId("amount-sheet-input"), "25");
		await fireEvent.press(getByRole("button", { name: "budgets.form.kindCategory" }));
		await fireEvent.press(getByTestId("category-picker-select"));
		await fireEvent.press(getByRole("button", { name: "budgets.form.create" }));

		await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
		expect(onDone).not.toHaveBeenCalled();
		expect(getByRole("button", { name: "budgets.form.create" }).props.accessibilityState?.disabled).toBe(false);

		createSpy.mockRestore();
		alertSpy.mockRestore();
	});

	it("keeps the CTA disabled after a successful create instead of re-enabling it", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		selectedCategoryHolder.current = getCategoryById(db, categoryId);
		const onDone = jest.fn();

		const { getByRole, getByTestId } = await render(
			<Providers>
				<BudgetForm db={db} onDone={onDone} />
			</Providers>
		);

		await fireEvent.changeText(getByTestId("amount-sheet-input"), "25");
		await fireEvent.press(getByRole("button", { name: "budgets.form.kindCategory" }));
		await fireEvent.press(getByTestId("category-picker-select"));
		await fireEvent.press(getByRole("button", { name: "budgets.form.create" }));

		await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

		// Flushes the microtask/macrotask queue past `onDone`, giving a
		// dropped `holdSubmitting()` call room to let `isSubmitting` settle
		// back to false before this assertion runs.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(getByRole("button", { name: "budgets.form.create" }).props.accessibilityState?.disabled).toBe(true);
	});
});

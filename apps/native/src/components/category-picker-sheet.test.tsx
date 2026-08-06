import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRef } from "react";
import type { Database } from "@/db/client";
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
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
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

describe("CategoryPickerSheet", () => {
	it("renders a pending category as the top row, with its willBeCreated caption", async () => {
		const db = migratedDb();
		const ref = createRef<CategoryPickerSheetRef>();
		const { toJSON } = await render(
			<CategoryPickerSheet
				db={db}
				income={false}
				onSelect={() => {}}
				pendingCategory={{
					name: "Entertainment",
					icon: "FilmRoll01",
					color: "#AF52DE",
					emoji: null,
					parentName: null,
				}}
				ref={ref}
				selectedId={null}
			/>,
		);
		await act(async () => {
			ref.current?.present();
		});

		const json = JSON.stringify(toJSON());
		expect(json).toContain("Entertainment");
		expect(json).toContain("transaction.category.willBeCreated");
	});

	it("renders no pending row when there is no pending category", async () => {
		const db = migratedDb();
		const ref = createRef<CategoryPickerSheetRef>();
		const { toJSON } = await render(
			<CategoryPickerSheet
				db={db}
				income={false}
				onSelect={() => {}}
				ref={ref}
				selectedId={null}
			/>,
		);
		await act(async () => {
			ref.current?.present();
		});

		expect(JSON.stringify(toJSON())).not.toContain(
			"transaction.category.willBeCreated",
		);
	});
});

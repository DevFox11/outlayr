import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, waitFor } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Component, type ReactNode } from "react";
import { Text } from "react-native";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import type { Database } from "@/db/client";
import { importDraftStore } from "@/lib/import-draft-store";
import { CsvImportProvider, useCsvImportContext } from "./csv-import-context";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");

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

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => dbHolder.current,
	useLocalData: () => ({ db: dbHolder.current }),
}));

beforeEach(() => {
	dbHolder.current = migratedDb();
	importDraftStore.clear();
});

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<AppSettingsProvider>
			<CsvImportProvider>{children}</CsvImportProvider>
		</AppSettingsProvider>
	);
}

let captured: {
	a: ReturnType<typeof useCsvImportContext> | null;
	b: ReturnType<typeof useCsvImportContext> | null;
};

function ProbeA() {
	captured.a = useCsvImportContext();
	return <Text testID="probe-a">{String(captured.a.running)}</Text>;
}

function ProbeB() {
	captured.b = useCsvImportContext();
	return <Text testID="probe-b">{String(captured.b.running)}</Text>;
}

function OutsideProbe() {
	useCsvImportContext();
	return null;
}

class CatchBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { hasError: boolean }> {
	state = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error: Error) {
		this.props.onError(error);
	}

	render() {
		return this.state.hasError ? null : this.props.children;
	}
}

describe("CsvImportProvider", () => {
	beforeEach(() => {
		captured = { a: null, b: null };
	});

	it("gives every consumer inside the provider the exact same hook instance", async () => {
		await render(
			<Providers>
				<ProbeA />
				<ProbeB />
			</Providers>
		);

		expect(captured.a).not.toBeNull();
		expect(captured.a).toBe(captured.b);
	});

	it("does not clobber a resolved draft on remount, and never re-dispatches resolutionSettled from a fresh hook (design §2.3.1 regression guard)", async () => {
		importDraftStore.dispatch({ sourceId: "csv", type: "sourceSelected" });
		importDraftStore.dispatch({
			draft: {
				amount: 2,
				category: 1,
				currency: null,
				date: 0,
				exchangeRate: null,
				exchangeRateType: null,
				note: 1,
				type: null,
			},
			file: { chars: 42, name: "bank.csv" },
			gaps: [],
			parsed: {
				header: ["date", "description", "amount"],
				rows: [["01/08/2026", "Coffee", "3,50"]],
				width: 3,
			},
			resolved: {
				labelSource: "descriptionColumn",
				mapping: {
					amount: 2,
					category: 1,
					currency: null,
					date: 0,
					exchangeRate: null,
					exchangeRateType: null,
					note: 1,
					type: null,
				},
			},
			type: "fileParsed",
		});
		importDraftStore.dispatch({
			fromModel: new Set(),
			links: new Map([["coffee", "cat-1"]]),
			outcome: "applied",
			reason: null,
			type: "resolutionSettled",
		});
		const resolutionBefore = importDraftStore.getSnapshot().flow.resolution;

		await render(
			<Providers>
				<ProbeA />
			</Providers>
		);
		await waitFor(() => expect(captured.a).not.toBeNull());

		expect(importDraftStore.getSnapshot().flow.resolution).toBe(resolutionBefore);
		expect(captured.a?.outcome).toBeNull();
	});

	it("throws when consumed outside CsvImportProvider instead of silently returning undefined", async () => {
		const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
		const caught: Error[] = [];

		render(
			<CatchBoundary onError={(error) => caught.push(error)}>
				<OutsideProbe />
			</CatchBoundary>
		);

		await waitFor(() => expect(caught).toHaveLength(1));
		expect(caught[0].message).toBe("useCsvImportContext must be used within CsvImportProvider");

		consoleError.mockRestore();
	});
});

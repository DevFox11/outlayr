import { act, render, waitFor } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Text } from "react-native";
import { setBoolSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import {
	AppSettingsProvider,
	useAppSettings,
	useDisplaySettings,
} from "./display-settings-context";

type ChangeListener = (event: { tableName: string }) => void;

const mockChangeListeners = new Set<ChangeListener>();

jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: (listener: ChangeListener) => {
		mockChangeListeners.add(listener);
		return {
			remove: () => {
				mockChangeListeners.delete(listener);
			},
		};
	},
}));

async function fireAppMetaChange() {
	await act(async () => {
		for (const listener of mockChangeListeners) {
			listener({ tableName: "appMeta" });
		}
	});
}

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const mockDbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => mockDbHolder.current,
}));

let displayRenders: number;
let appRenders: number;

function DisplayProbe() {
	const { state } = useDisplaySettings();
	displayRenders += 1;
	return <Text testID="display-probe">{String(state.showCents)}</Text>;
}

function AppProbe() {
	const { state } = useAppSettings();
	appRenders += 1;
	return <Text testID="app-probe">{String(state.bool("confetti"))}</Text>;
}

describe("AppSettingsProvider", () => {
	beforeEach(() => {
		mockDbHolder.current = makeDb();
		mockChangeListeners.clear();
		displayRenders = 0;
		appRenders = 0;
	});

	it("re-renders DisplaySettingsContext consumers on a display-boolean flip but not on an unrelated appMeta write", async () => {
		const db = mockDbHolder.current as Database;
		const { getByTestId } = await render(
			<AppSettingsProvider>
				<DisplayProbe />
				<AppProbe />
			</AppSettingsProvider>,
		);

		await waitFor(() =>
			expect(getByTestId("display-probe").props.children).toBe("true"),
		);
		const rendersBeforeUnrelatedWrite = displayRenders;
		const appRendersBeforeUnrelatedWrite = appRenders;

		await setBoolSetting(db, "confetti", true);
		await fireAppMetaChange();
		await waitFor(() =>
			expect(getByTestId("app-probe").props.children).toBe("true"),
		);
		expect(appRenders).toBeGreaterThan(appRendersBeforeUnrelatedWrite);
		expect(displayRenders).toBe(rendersBeforeUnrelatedWrite);

		await setBoolSetting(db, "showCents", false);
		await fireAppMetaChange();
		await waitFor(() =>
			expect(getByTestId("display-probe").props.children).toBe("false"),
		);
		expect(displayRenders).toBeGreaterThan(rendersBeforeUnrelatedWrite);
	});
});

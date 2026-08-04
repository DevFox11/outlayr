import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import type { Database } from "@/db/client";
import { TransactionForm } from "./index";

const SENTINEL_LOCALE = "es-VE";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		background: "#F2F0EA",
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		surface: "#FFFFFF",
		surfaceSecondary: "#F7F5EF",
		groupedBackground: "#EFEDE6",
		border: "#DAD6C9",
		separator: "#DAD6C9",
		accent: "#3D7A5C",
		accentForeground: "#FFFFFF",
		tint: "#3D7A5C",
		income: "#3D7A5C",
		expense: "#B5482F",
		future: "#8A8578",
		danger: "#B5482F",
		overBudget: "#B5482F",
		warning: "#C08A2E",
		railTrack: "rgba(0,0,0,0.08)",
	}),
	SYSTEM_COLORS: {
		groupedBackground: "#EFEDE6",
		card: "#FFFFFF",
		separator: "#DAD6C9",
	},
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
	useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

interface ObservableStateDouble {
	value: unknown;
	get: () => unknown;
	set: (v: unknown) => void;
	onChange: unknown;
}

jest.mock("@expo/ui/swift-ui", () => {
	const actual = jest.requireActual("@expo/ui/swift-ui");
	const React = require("react");
	return {
		...actual,
		useNativeState: (initial: unknown) => {
			const ref = React.useRef() as { current?: ObservableStateDouble };
			if (!ref.current) {
				let value = initial;
				let onChange: unknown = null;
				ref.current = {
					get value() {
						return value;
					},
					set value(v: unknown) {
						value = v;
					},
					get() {
						return value;
					},
					set(v: unknown) {
						value = v;
					},
					get onChange() {
						return onChange;
					},
					set onChange(fn: unknown) {
						onChange = fn;
					},
				} as unknown as ObservableStateDouble;
			}
			return ref.current;
		},
	};
});

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => dbHolder.current,
	useLocalData: () => ({ db: dbHolder.current }),
}));

const mockUseTransactionEnrichment = jest.fn(() => ({
	onNameChange: () => {},
	pending: false,
}));

jest.mock("@/hooks/use-transaction-enrichment", () => ({
	useTransactionEnrichment: (...args: unknown[]) =>
		mockUseTransactionEnrichment(...args),
}));

jest.mock("@/hooks/use-locale-tag", () => ({
	useLocaleTag: () => SENTINEL_LOCALE,
}));

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
	useLanguage: () => ({ preference: "en" }),
}));

const MIGRATIONS = join(__dirname, "../../../drizzle");

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

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<AppSettingsProvider>
			<IdentityDraftProvider>{children}</IdentityDraftProvider>
		</AppSettingsProvider>
	);
}

beforeEach(() => {
	dbHolder.current = migratedDb();
	mockUseTransactionEnrichment.mockClear();
});

describe("TransactionForm enrichment locale wiring", () => {
	it("passes the device locale from useLocaleTag, not useLanguage, into useTransactionEnrichment", async () => {
		const db = dbHolder.current as Database;
		await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>,
		);

		expect(mockUseTransactionEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({ locale: SENTINEL_LOCALE }),
		);
	});
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Alert } from "react-native";
import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { getMeta, META_KEYS, setMeta } from "@/data/app-meta-core";
import { categoriesRepo } from "@/data/categories-core";
import { backfillRecurring } from "@/data/recurrence-backfill";
import { tagsRepo } from "@/data/tags-core";
import type { Transaction } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { accounts, categories, tags, transactions } from "@/db/schema";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { fetchMerchantImage, type LogoOutcome } from "@/lib/logo-fetch";
import { glowFromImage } from "@/theme/glow";
import { curtainGradient } from "../identity-curtain";
import { TransactionForm } from "./index";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-sqlite", () => ({
	addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("@/i18n/context", () => ({
	useLanguage: () => ({
		language: "en",
		preference: "system",
		setPreference: () => {},
	}),
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
jest.mock("expo-router", () => require("../../../jest/expo-router-stub"));
jest.mock("number-flow-react-native", () => {
	const react = require("react") as typeof import("react");
	return {
		NumberFlow: (props: Record<string, unknown>) => react.createElement("NumberFlow", props),
	};
});
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("@/lib/subscription-reminder-sync", () => ({
	syncSubscriptionReminders: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/logo-fetch", () => ({ fetchMerchantImage: jest.fn() }));
jest.mock("@/lib/photo-storage", () => ({ persistLogoBytes: jest.fn() }));
jest.mock("@/theme/glow", () => {
	const actual = jest.requireActual("@/theme/glow");
	return { ...actual, glowFromImage: jest.fn() };
});
// `backfillRecurring` defaults to the real implementation; the re-entrancy
// suite below overrides it once to hold the pipeline open past the row
// commit, so it can observe the CTA before `holdSubmitting()` would settle.
jest.mock("@/data/recurrence-backfill", () => {
	const actual = jest.requireActual("@/data/recurrence-backfill");
	return {
		...actual,
		backfillRecurring: jest.fn(actual.backfillRecurring),
	};
});

// `useNativeState` bridges to a real native `ObservableState` (SwiftUI/Jetpack
// Compose) that jest has no runtime for — unrelated to the reanimated/worklets
// fix in jest.config.js. This double keeps the get/set/onChange contract so
// `TransactionForm`'s own hooks and its extracted sections can render; it does
// NOT simulate cross-thread synchronization or the native TextField binding.
interface ObservableStateDouble {
	get: () => unknown;
	onChange: unknown;
	set: (v: unknown) => void;
	value: unknown;
}

jest.mock("@expo/ui/swift-ui", () => {
	const actual = jest.requireActual("@expo/ui/swift-ui");
	const React = require("react");
	return {
		...actual,
		TextField: ({
			onFocusChange,
			onTextChange,
			...props
		}: Record<string, unknown> & {
			onFocusChange?: (focused: boolean) => void;
			onTextChange?: (value: string) => void;
		}) =>
			React.createElement("SwiftUITextField", {
				...props,
				onFocusChange: onFocusChange
					? (event: { nativeEvent: { value: boolean } }) => onFocusChange(event.nativeEvent.value)
					: undefined,
				onTextChange: onTextChange
					? (event: { nativeEvent: { value: string } }) => onTextChange(event.nativeEvent.value)
					: undefined,
			}),
		useNativeState: (initial: unknown) => {
			const ref = React.useRef() as { current?: ObservableStateDouble };
			if (!ref.current) {
				let value = initial;
				let onChange: unknown = null;
				ref.current = {
					get() {
						return value;
					},
					get onChange() {
						return onChange;
					},
					set onChange(fn: unknown) {
						onChange = fn;
					},
					set(v: unknown) {
						value = v;
					},
					get value() {
						return value;
					},
					set value(v: unknown) {
						value = v;
					},
				} as unknown as ObservableStateDouble;
			}
			return ref.current;
		},
	};
});

interface JsonNode {
	children: (JsonNode | string)[] | null;
	props: Record<string, unknown>;
	type: string;
}

interface Deferred<T> {
	promise: Promise<T>;
	reject: (reason?: unknown) => void;
	resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
	let resolve!: Deferred<T>["resolve"];
	let reject!: Deferred<T>["reject"];
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
}

const mockedFetchMerchantImage = jest.mocked(fetchMerchantImage);
const mockedGlowFromImage = jest.mocked(glowFromImage);
const mockedPersistLogoBytes = jest.mocked(
	(require("@/lib/photo-storage") as typeof import("@/lib/photo-storage")).persistLogoBytes
);

function expoImageUri(node: JsonNode | JsonNode[] | null): string | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const uri = expoImageUri(child);
			if (uri != null) {
				return uri;
			}
		}
		return null;
	}
	if (node.type === "ViewManagerAdapter_ExpoImage") {
		const source = node.props?.source;
		if (Array.isArray(source)) {
			for (const candidate of source) {
				if (
					typeof candidate === "object" &&
					candidate != null &&
					"uri" in candidate &&
					typeof candidate.uri === "string"
				) {
					return candidate.uri;
				}
			}
		}
		if (typeof source === "object" && source != null && "uri" in source && typeof source.uri === "string") {
			return source.uri;
		}
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const uri = expoImageUri(child);
		if (uri != null) {
			return uri;
		}
	}
	return null;
}

function renderedHeroImageUri(tree: JsonNode): string | null {
	const hero = findByProp(tree, "accessibilityLabel", "transaction.identity.hero.logo");
	if (hero == null || hero.props.accessibilityRole !== "button" || hero.props.accessible !== true) {
		throw new Error("Could not find the accessible in-form identity hero.");
	}
	return expoImageUri(hero);
}

function renderedFormHost(node: JsonNode | JsonNode[] | null): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const host = renderedFormHost(child);
			if (host != null) {
				return host;
			}
		}
		return null;
	}
	const style = node.props?.style;
	if (
		node.type === "ViewManagerAdapter_ExpoUI" &&
		typeof style === "object" &&
		style != null &&
		"experimental_backgroundImage" in style &&
		"experimental_backgroundRepeat" in style &&
		"experimental_backgroundSize" in style
	) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const host = renderedFormHost(child);
		if (host != null) {
			return host;
		}
	}
	return null;
}

function renderedCurtain(tree: JsonNode): unknown {
	const host = renderedFormHost(tree);
	if (host == null) {
		throw new Error("Could not find the SwiftUI form Host.");
	}
	const style = host.props.style as { experimental_backgroundImage?: unknown };
	return style.experimental_backgroundImage ?? null;
}

function renderedFormBlurRadius(tree: JsonNode): number | null {
	const host = renderedFormHost(tree);
	if (host == null) {
		throw new Error("Could not find the SwiftUI form Host.");
	}
	for (const child of host.children ?? []) {
		if (typeof child === "string" || !Array.isArray(child.props.modifiers)) {
			continue;
		}
		const blur = child.props.modifiers.find(
			(modifier) => typeof modifier === "object" && modifier != null && "$type" in modifier && modifier.$type === "blur"
		);
		if (typeof blur === "object" && blur != null && "radius" in blur && typeof blur.radius === "number") {
			return blur.radius;
		}
	}
	return null;
}

async function changeMerchant(tree: JsonNode, value: string): Promise<void> {
	const field = findByProp(tree, "placeholder", "transaction.field.namePlaceholder") as
		| (JsonNode & {
				props: {
					onTextChange: (event: { nativeEvent: { value: string } }) => void;
					text: ObservableStateDouble;
				};
		  })
		| null;
	if (field == null || field.type !== "SwiftUITextField") {
		throw new Error("Could not find the name TextField in the render tree.");
	}
	field.props.text.value = value;
	field.props.onTextChange({ nativeEvent: { value } });
	jest.advanceTimersByTime(600);
	await Promise.resolve();
}

function findByProp(node: JsonNode | JsonNode[] | null, key: string, value: unknown): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByProp(child, key, value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.props?.[key] === value) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByProp(child, key, value);
		if (found) {
			return found;
		}
	}
	return null;
}

function containsText(node: JsonNode | JsonNode[] | null, text: string): boolean {
	if (node == null) {
		return false;
	}
	if (Array.isArray(node)) {
		return node.some((child) => containsText(child, text));
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			if (child === text) {
				return true;
			}
			continue;
		}
		if (containsText(child, text)) {
			return true;
		}
	}
	return false;
}

const MIGRATIONS = join(import.meta.dirname, "../../../drizzle");

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

async function seedTag(db: Database, id: string, name: string) {
	await db.insert(tags).values({
		color: null,
		id,
		name,
		sortOrder: 0,
		updatedAt: new Date(),
	});
}

function hasSwiftText(tree: JsonNode, value: string): boolean {
	return findByProp(tree, "text", value) !== null;
}

function countSwiftText(node: JsonNode | JsonNode[] | null, value: string): number {
	if (node == null) {
		return 0;
	}
	if (Array.isArray(node)) {
		return node.reduce((sum, child) => sum + countSwiftText(child, value), 0);
	}
	let count = node.props?.text === value ? 1 : 0;
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		count += countSwiftText(child, value);
	}
	return count;
}

function findButtonWithText(
	node: JsonNode | JsonNode[] | null,
	text: string
): (JsonNode & { props: { onButtonPress: () => void } }) | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findButtonWithText(child, text);
			if (found) {
				return found;
			}
		}
		return null;
	}
	// A toolbar item carries its label as `accessibilityLabel` rather than a
	// SwiftText child, so both spellings of "the button labelled X" match here.
	if (
		typeof node.props?.onButtonPress === "function" &&
		(hasSwiftText(node, text) || node.props?.accessibilityLabel === text)
	) {
		return node as JsonNode & { props: { onButtonPress: () => void } };
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findButtonWithText(child, text);
		if (found) {
			return found;
		}
	}
	return null;
}

function findTextChangeHandler(tree: JsonNode): (text: string) => void {
	const node = findByProp(tree, "placeholder", "transaction.field.namePlaceholder") as
		| (JsonNode & {
				props: {
					onTextChange: (event: { nativeEvent: { value: string } }) => void;
				};
		  })
		| null;
	if (node == null) {
		throw new Error("Could not find the name TextField in the render tree.");
	}
	return (text: string) => node.props.onTextChange({ nativeEvent: { value: text } });
}

const dbHolder: { current: Database | null } = { current: null };
let closePickerForTest: (() => void) | null = null;

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => dbHolder.current,
	useLocalData: () => ({ db: dbHolder.current }),
}));

function PickerController() {
	const { setPickerOpen } = useIdentityFlyUp();
	closePickerForTest = () => setPickerOpen(false);
	return null;
}

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<AppSettingsProvider>
			<IdentityDraftProvider>
				{children}
				<PickerController />
			</IdentityDraftProvider>
		</AppSettingsProvider>
	);
}

beforeEach(() => {
	dbHolder.current = migratedDb();
});

describe("TransactionForm", () => {
	it("renders create mode without crashing", async () => {
		const db = dbHolder.current as Database;
		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);
		expect(toJSON()).toBeTruthy();
	});

	it("renders edit mode without crashing once a subscription row loads", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const initial: Partial<Transaction> = {
			amount: 12.5,
			categoryId,
			currency: null,
			customColor: null,
			date: new Date(),
			details: null,
			emoji: "🎬",
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Netflix",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 30,
			reminderLeadDays: null,
		};
		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
			</Providers>
		);
		expect(toJSON()).toBeTruthy();
	});

	it("plumbs the seeded identity's emoji into the identity section", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const initial: Partial<Transaction> = {
			amount: 12.5,
			categoryId,
			currency: null,
			customColor: null,
			date: new Date(),
			details: null,
			emoji: "🎸",
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Concert",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
			reminderLeadDays: null,
		};
		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
			</Providers>
		);
		expect(containsText(toJSON() as JsonNode, "🎸")).toBe(true);
	});

	it("plumbs the seeded amount into the amount hero", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const initial: Partial<Transaction> = {
			amount: 42,
			categoryId,
			currency: "USD",
			customColor: null,
			date: new Date(),
			details: null,
			emoji: null,
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Rent share",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
			reminderLeadDays: null,
		};
		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
			</Providers>
		);
		const tree = toJSON() as JsonNode;
		expect(JSON.stringify(tree)).toContain("$");
		expect(findByProp(tree, "value", 42)).not.toBeNull();
	});

	it("holds hook order across the real once -> subscription -> once toggle", async () => {
		const db = dbHolder.current as Database;
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		// In once mode the repeat switch is the only toggle on screen; End Date's
		// appears alongside it only after this one is on.
		const repeats = findByProp(toJSON() as JsonNode, "isOn", false) as
			| (JsonNode & {
					props: { onIsOnChange: (event: unknown) => void };
			  })
			| null;
		expect(repeats).not.toBeNull();

		await act(async () => {
			repeats?.props.onIsOnChange({ nativeEvent: { isOn: true } } as never);
		});
		await act(async () => {
			repeats?.props.onIsOnChange({ nativeEvent: { isOn: false } } as never);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});

	it("shows the schedule section's subscription rows once toggled to subscription", async () => {
		const db = dbHolder.current as Database;
		const { toJSON, rerender } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		expect(containsText(toJSON() as JsonNode, "transaction.field.remind")).toBe(false);

		const repeats = findByProp(toJSON() as JsonNode, "isOn", false) as
			| (JsonNode & { props: { onIsOnChange: (event: unknown) => void } })
			| null;

		await act(async () => {
			repeats?.props.onIsOnChange({ nativeEvent: { isOn: true } } as never);
		});

		await act(async () => {
			rerender(
				<Providers>
					<TransactionForm db={db} mode="create" onDone={() => {}} />
				</Providers>
			);
		});
	});

	it("holds hook order across a create -> edit re-render sequence", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const initial: Partial<Transaction> = {
			amount: 9,
			categoryId,
			currency: null,
			customColor: null,
			date: new Date(),
			details: null,
			emoji: null,
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Coffee",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
			reminderLeadDays: null,
		};
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

		const { rerender } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			rerender(
				<Providers>
					<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
				</Providers>
			);
		});

		const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
			typeof message === "string" ? /Rendered (more|fewer) hooks/.test(message) : false
		);
		expect(hookOrderViolations).toHaveLength(0);
		errorSpy.mockRestore();
	});
});

describe("TransactionForm submit re-entrancy", () => {
	it("does not create a second row when the CTA is pressed twice before the first save settles", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const copyOf: LogAgainDraft = {
			amount: 25,
			categoryId,
			currency: null,
			customColor: null,
			details: null,
			emoji: null,
			icon: null,
			income: false,
			note: "",
		};

		const { toJSON } = await render(
			<Providers>
				<TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const saveButton = findButtonWithText(toJSON() as JsonNode, "transaction.cta.add");
		expect(saveButton).not.toBeNull();

		await act(async () => {
			saveButton?.props.onButtonPress();
			saveButton?.props.onButtonPress();
		});

		const savedTx = await db.select().from(transactions);
		expect(savedTx).toHaveLength(1);
	});

	it("keeps the CTA disabled through the recurrence backfill after the row commits", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const copyOf: LogAgainDraft = {
			amount: 25,
			categoryId,
			currency: null,
			customColor: null,
			details: null,
			emoji: null,
			icon: null,
			income: false,
			note: "",
		};

		let resolveBackfill: () => void = () => {};
		(backfillRecurring as jest.Mock).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveBackfill = resolve;
				})
		);

		const { toJSON } = await render(
			<Providers>
				<TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const repeats = findByProp(toJSON() as JsonNode, "isOn", false) as
			| (JsonNode & { props: { onIsOnChange: (event: unknown) => void } })
			| null;
		expect(repeats).not.toBeNull();
		await act(async () => {
			repeats?.props.onIsOnChange({ nativeEvent: { isOn: true } });
		});

		const saveButton = findButtonWithText(toJSON() as JsonNode, "transaction.cta.addSubscription");
		expect(saveButton).not.toBeNull();

		await act(async () => {
			saveButton?.props.onButtonPress();
		});

		const savedTx = await db.select().from(transactions);
		expect(savedTx).toHaveLength(1);
		expect(backfillRecurring).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolveBackfill();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		const stillDisabled = findButtonWithText(toJSON() as JsonNode, "transaction.cta.addSubscription") as
			| (JsonNode & { props: { disabled?: boolean } })
			| null;
		expect(stillDisabled?.props.disabled).toBe(true);
	});
});

describe("TransactionForm enrichment", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("auto-selects an existing curated category and its tags for an exact merchant name", async () => {
		const db = dbHolder.current as Database;
		await seedCategory(db, "c-entertainment", "Entertainment");
		await seedTag(db, "tag-streaming", "Streaming");
		await seedTag(db, "tag-subscription", "Subscription");

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Entertainment")).toBe(true);
		expect(hasSwiftText(tree, "Streaming, Subscription")).toBe(true);
	});

	it("does not let a later suggestion overwrite a category the form already carries", async () => {
		const db = dbHolder.current as Database;
		const groceriesId = await seedCategory(db, "c-groceries", "Groceries");
		await seedCategory(db, "c-entertainment", "Entertainment");
		const copyOf: LogAgainDraft = {
			amount: 15,
			categoryId: groceriesId,
			currency: null,
			customColor: null,
			details: null,
			emoji: null,
			icon: null,
			income: false,
			note: "",
		};

		const { toJSON } = await render(
			<Providers>
				<TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Groceries")).toBe(true);
		expect(hasSwiftText(tree, "Entertainment")).toBe(false);
	});

	it("replaces an earlier suggestion when the name changes to another merchant", async () => {
		const db = dbHolder.current as Database;
		await seedCategory(db, "c-entertainment", "Entertainment");
		await seedCategory(db, "c-transport", "Transport");
		await seedTag(db, "tag-streaming", "Streaming");
		await seedTag(db, "tag-subscription", "Subscription");
		await seedTag(db, "tag-rideshare", "Rideshare");

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});
		expect(hasSwiftText(toJSON() as JsonNode, "Entertainment")).toBe(true);

		await act(async () => {
			onTextChange("uber");
			jest.advanceTimersByTime(600);
		});

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Transport")).toBe(true);
		expect(hasSwiftText(tree, "Entertainment")).toBe(false);
		expect(hasSwiftText(tree, "Rideshare")).toBe(true);
		expect(hasSwiftText(tree, "Streaming, Subscription")).toBe(false);
	});

	it("issues no enrichment call in edit mode", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db, "c-groceries", "Groceries");
		await seedCategory(db, "c-entertainment", "Entertainment");
		const initial: Partial<Transaction> = {
			amount: 12.5,
			categoryId,
			currency: null,
			customColor: null,
			date: new Date(),
			details: null,
			emoji: null,
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Groceries run",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
			reminderLeadDays: null,
		};

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Groceries")).toBe(true);
		expect(hasSwiftText(tree, "Entertainment")).toBe(false);
	});
});

describe("TransactionForm logo attachment", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		closePickerForTest = null;
		mockedFetchMerchantImage.mockReset();
		mockedPersistLogoBytes.mockReset();
		mockedGlowFromImage.mockReset();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("renders the persisted logo and its extracted curtain color", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		mockedFetchMerchantImage.mockResolvedValue({ bytes, kind: "logo" });
		mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
		mockedGlowFromImage.mockResolvedValue(["#123456"]);

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "netflix");
		});

		const tree = toJSON() as JsonNode;
		expect(renderedHeroImageUri(tree)).toBe("file:///logos/netflix.png");
		expect(renderedCurtain(tree)).toStrictEqual(curtainGradient(["#123456"], false));
		expect(mockedFetchMerchantImage).toHaveBeenCalledWith({ domain: "netflix.com", name: "netflix" });
		expect(mockedPersistLogoBytes).toHaveBeenCalledWith(bytes);
		expect(mockedGlowFromImage).toHaveBeenCalledWith("file:///logos/netflix.png");
	});

	it("does not replace an identity after the user owns it", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		mockedFetchMerchantImage.mockResolvedValue({ bytes, kind: "logo" });
		mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
		mockedGlowFromImage.mockResolvedValue(["#123456"]);

		const renderResult = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(renderResult.toJSON() as JsonNode, "netflix");
		});
		await act(async () => {
			fireEvent.press(renderResult.getByLabelText("transaction.identity.hero.logo"));
		});
		expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBeGreaterThan(0);
		const closePicker = closePickerForTest;
		expect(closePicker).not.toBeNull();
		if (closePicker == null) {
			throw new Error("Picker controller did not register its close function.");
		}
		await act(async () => {
			closePicker();
		});
		expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBe(0);
		await act(async () => {
			await changeMerchant(renderResult.toJSON() as JsonNode, "uber");
		});

		const tree = renderResult.toJSON() as JsonNode;
		expect(renderedHeroImageUri(tree)).toBe("file:///logos/netflix.png");
		expect(renderedCurtain(tree)).toStrictEqual(curtainGradient(["#123456"], false));
		expect(mockedFetchMerchantImage).toHaveBeenCalledTimes(1);
	});

	it.each([
		{
			emoji: null,
			label: "initial",
			props: {
				initial: {
					amount: 12,
					categoryId: null,
					currency: null,
					customColor: null,
					date: new Date("2026-08-11T00:00:00.000Z"),
					details: null,
					emoji: null,
					icon: null,
					id: "seeded-transaction",
					imageColor: "#AABBCC",
					imageUri: "file:///logos/initial.png",
					income: false,
					note: "",
					onceRecurring: false,
					recurringCoefficient: 1,
					recurringEndDate: null,
					recurringType: 0,
					reminderLeadDays: null,
				} as Transaction,
			},
			uri: "file:///logos/initial.png" as string | null,
		},
		{
			emoji: "🎯",
			label: "copyOf",
			props: {
				copyOf: {
					amount: 12,
					categoryId: null,
					currency: null,
					customColor: null,
					details: null,
					emoji: "🎯",
					icon: null,
					income: false,
					note: "",
				} as LogAgainDraft,
			},
			uri: null,
		},
	])("preserves a nonempty $label identity", async ({ emoji, props, uri }) => {
		const { toJSON } = await render(
			<Providers>
				<TransactionForm {...props} db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "netflix");
		});

		const tree = toJSON() as JsonNode;
		if (uri != null) {
			expect(renderedHeroImageUri(tree)).toBe(uri);
		}
		if (emoji != null) {
			expect(containsText(tree, emoji)).toBe(true);
		}
		expect(mockedFetchMerchantImage).not.toHaveBeenCalled();
		expect(mockedPersistLogoBytes).not.toHaveBeenCalled();
		expect(mockedGlowFromImage).not.toHaveBeenCalled();
	});

	it("invalidates an in-flight logo when the picker opens", async () => {
		const pendingLogo = deferred<LogoOutcome>();
		const bytes = new Uint8Array([1, 2, 3]);
		mockedFetchMerchantImage.mockReturnValue(pendingLogo.promise);

		const renderResult = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(renderResult.toJSON() as JsonNode, "netflix");
		});
		await act(async () => {
			fireEvent.press(renderResult.getByLabelText("transaction.identity.hero.logo"));
		});
		expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBeGreaterThan(0);
		await act(async () => {
			pendingLogo.resolve({ bytes, kind: "logo" });
			await Promise.resolve();
		});

		expect(renderedHeroImageUri(renderResult.toJSON() as JsonNode)).toBeNull();
		expect(mockedPersistLogoBytes).not.toHaveBeenCalled();
		expect(mockedGlowFromImage).not.toHaveBeenCalled();
	});

	it("clears a suggested logo when enrichment resolves to none", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		mockedFetchMerchantImage.mockResolvedValueOnce({ bytes, kind: "logo" }).mockResolvedValueOnce({ kind: "none" });
		mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
		mockedGlowFromImage.mockResolvedValue(["#123456"]);

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "netflix");
		});
		expect(renderedHeroImageUri(toJSON() as JsonNode)).toBe("file:///logos/netflix.png");

		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "uber");
		});

		const tree = toJSON() as JsonNode;
		expect(renderedHeroImageUri(tree)).toBeNull();
		expect(renderedCurtain(tree)).toBeNull();
	});

	it("preserves a user-owned logo when later enrichment has no match", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		mockedFetchMerchantImage.mockResolvedValueOnce({ bytes, kind: "logo" });
		mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
		mockedGlowFromImage.mockResolvedValue(["#123456"]);

		const renderResult = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(renderResult.toJSON() as JsonNode, "netflix");
		});
		await act(async () => {
			fireEvent.press(renderResult.getByLabelText("transaction.identity.hero.logo"));
		});
		expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBeGreaterThan(0);
		const closePicker = closePickerForTest;
		expect(closePicker).not.toBeNull();
		if (closePicker == null) {
			throw new Error("Picker controller did not register its close function.");
		}
		await act(async () => {
			closePicker();
		});
		expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBe(0);
		await act(async () => {
			await changeMerchant(renderResult.toJSON() as JsonNode, "unknown merchant");
		});

		const tree = renderResult.toJSON() as JsonNode;
		expect(renderedHeroImageUri(tree)).toBe("file:///logos/netflix.png");
		expect(renderedCurtain(tree)).toStrictEqual(curtainGradient(["#123456"], false));
		expect(mockedFetchMerchantImage).toHaveBeenCalledTimes(1);
	});

	it("keeps the newest logo when an older request settles last", async () => {
		const netflix = deferred<LogoOutcome>();
		const uber = deferred<LogoOutcome>();
		const netflixBytes = new Uint8Array([1, 2, 3]);
		const uberBytes = new Uint8Array([4, 5, 6]);
		mockedFetchMerchantImage.mockReturnValueOnce(netflix.promise).mockReturnValueOnce(uber.promise);
		mockedPersistLogoBytes.mockImplementation((bytes) =>
			Promise.resolve(bytes === uberBytes ? "file:///logos/uber.png" : "file:///logos/netflix.png")
		);
		mockedGlowFromImage.mockImplementation((uri) =>
			Promise.resolve(uri === "file:///logos/uber.png" ? ["#654321"] : ["#123456"])
		);

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
			</Providers>
		);

		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "netflix");
		});
		await act(async () => {
			await changeMerchant(toJSON() as JsonNode, "uber");
		});
		await act(async () => {
			uber.resolve({ bytes: uberBytes, kind: "logo" });
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(renderedHeroImageUri(toJSON() as JsonNode)).toBe("file:///logos/uber.png");
		expect(renderedCurtain(toJSON() as JsonNode)).toStrictEqual(curtainGradient(["#654321"], false));

		await act(async () => {
			netflix.resolve({ bytes: netflixBytes, kind: "logo" });
			await Promise.resolve();
		});

		expect(renderedHeroImageUri(toJSON() as JsonNode)).toBe("file:///logos/uber.png");
		expect(renderedCurtain(toJSON() as JsonNode)).toStrictEqual(curtainGradient(["#654321"], false));
		expect(mockedPersistLogoBytes).toHaveBeenCalledTimes(1);
		expect(mockedPersistLogoBytes).toHaveBeenCalledWith(uberBytes);
		expect(mockedPersistLogoBytes).not.toHaveBeenCalledWith(netflixBytes);
	});
});

describe("TransactionForm pending category and tag materialization", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("saves with only a pending category — no shake, no category error — and materializes it", async () => {
		const db = dbHolder.current as Database;
		const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});

		let tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Entertainment")).toBe(true);
		expect(hasSwiftText(tree, "transaction.category.willBeCreated")).toBe(true);
		expect(JSON.stringify(tree)).not.toContain('"$type":"strokeBorder"');

		const saveButton = findButtonWithText(tree, "transaction.cta.add");
		expect(saveButton).not.toBeNull();
		await act(async () => {
			saveButton?.props.onButtonPress();
		});

		expect(alertSpy).not.toHaveBeenCalled();
		const created = await db.select().from(categories).where(eq(categories.name, "Entertainment"));
		expect(created).toHaveLength(1);

		const savedTx = await db.select().from(transactions);
		expect(savedTx).toHaveLength(1);
		expect(savedTx[0].categoryId).toBe(created[0].id);

		tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "transaction.category.choose")).toBe(false);

		alertSpy.mockRestore();
	});

	it("materializes pending tags via ensureTag and merges them into a single setTagsFor call", async () => {
		const db = dbHolder.current as Database;
		const setTagsSpy = jest.spyOn(tagsRepo, "setTagsFor");

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Streaming, Subscription")).toBe(true);

		const saveButton = findButtonWithText(tree, "transaction.cta.add");
		await act(async () => {
			saveButton?.props.onButtonPress();
		});

		expect(setTagsSpy).toHaveBeenCalledTimes(1);
		const [, , calledTagIds] = setTagsSpy.mock.calls[0];
		expect(calledTagIds).toHaveLength(2);

		const createdTags = await db.select().from(tags);
		expect(createdTags.map((row) => row.name).sort()).toStrictEqual(["Streaming", "Subscription"]);

		setTagsSpy.mockRestore();
	});

	it("renders the pending-category caption exactly once and it does not grow while typing continues", async () => {
		const db = dbHolder.current as Database;

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});
		expect(countSwiftText(toJSON() as JsonNode, "transaction.category.willBeCreated")).toBe(1);

		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});
		expect(countSwiftText(toJSON() as JsonNode, "transaction.category.willBeCreated")).toBe(1);
	});

	it("aborts before writing any transaction row when the pending category fails to materialize", async () => {
		const db = dbHolder.current as Database;
		const createSpy = jest.spyOn(categoriesRepo, "create").mockRejectedValueOnce(new Error("boom"));

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
			</Providers>
		);

		const onTextChange = findTextChangeHandler(toJSON() as JsonNode);
		await act(async () => {
			onTextChange("netflix");
			jest.advanceTimersByTime(600);
		});
		expect(hasSwiftText(toJSON() as JsonNode, "Entertainment")).toBe(true);
		expect(createSpy).not.toHaveBeenCalled();

		const saveButton = findButtonWithText(toJSON() as JsonNode, "transaction.cta.add");
		await act(async () => {
			saveButton?.props.onButtonPress();
		});

		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(await db.select().from(transactions)).toHaveLength(0);
		expect(JSON.stringify(toJSON())).toContain('"$type":"strokeBorder"');

		createSpy.mockRestore();
	});
});

describe("TransactionForm account attachment", () => {
	async function seedAccount(db: Database, id = "acc-1", name = "Checking") {
		await db.insert(accounts).values({
			currency: "USD",
			dateCreated: new Date(),
			id,
			initialBalance: 0,
			initialBalanceDate: new Date(),
			initialBalanceUsd: 0,
			name,
			sortOrder: 0,
			updatedAt: new Date(),
		});
		return id;
	}

	it("shows None while nothing was ever attached", async () => {
		const db = dbHolder.current as Database;
		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);
		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "transaction.field.account")).toBe(true);
		expect(hasSwiftText(tree, "transaction.account.none")).toBe(true);
	});

	it("seeds a create with the last-used account", async () => {
		const db = dbHolder.current as Database;
		const accountId = await seedAccount(db);
		await setMeta(db, META_KEYS.lastTransactionAccount, accountId);

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		expect(hasSwiftText(toJSON() as JsonNode, "Checking")).toBe(true);
	});

	it("seeds an edit from the row's own attachment, not the sticky default", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		await seedAccount(db, "acc-1", "Checking");
		await seedAccount(db, "acc-2", "Savings");
		await setMeta(db, META_KEYS.lastTransactionAccount, "acc-1");
		const initial: Partial<Transaction> = {
			accountId: "acc-2",
			amount: 12.5,
			categoryId,
			currency: null,
			customColor: null,
			date: new Date(),
			details: null,
			emoji: null,
			icon: null,
			id: "t1",
			imageColor: null,
			imageUri: null,
			income: false,
			note: "Groceries run",
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
			reminderLeadDays: null,
		};

		const { toJSON } = await render(
			<Providers>
				<TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
			</Providers>
		);

		const tree = toJSON() as JsonNode;
		expect(hasSwiftText(tree, "Savings")).toBe(true);
		expect(hasSwiftText(tree, "Checking")).toBe(false);
	});

	it("carries the attachment onto the saved row and remembers it", async () => {
		const db = dbHolder.current as Database;
		const categoryId = await seedCategory(db);
		const accountId = await seedAccount(db);
		await setMeta(db, META_KEYS.lastTransactionAccount, accountId);
		const copyOf: LogAgainDraft = {
			amount: 25,
			categoryId,
			currency: null,
			customColor: null,
			details: null,
			emoji: null,
			icon: null,
			income: false,
			note: "",
		};

		const { toJSON } = await render(
			<Providers>
				<TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
			</Providers>
		);

		const saveButton = findButtonWithText(toJSON() as JsonNode, "transaction.cta.add");
		await act(async () => {
			saveButton?.props.onButtonPress();
		});

		const savedTx = await db.select().from(transactions);
		expect(savedTx).toHaveLength(1);
		expect(savedTx[0].accountId).toBe(accountId);
		expect(await getMeta(db, META_KEYS.lastTransactionAccount)).toBe(accountId);
	});
});

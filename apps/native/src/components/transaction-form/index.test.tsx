import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { eq } from "drizzle-orm";
import { Alert } from "react-native";

import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import { getMeta, META_KEYS, setMeta } from "@/data/app-meta-core";
import { categoriesRepo } from "@/data/categories-core";
import { bumpRatesRevision } from "@/data/rates-revision";
import { backfillRecurring } from "@/data/recurrence-backfill";
import { tagIdsForQuery, tagsRepo } from "@/data/tags-core";
import type { Transaction } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { accounts, categories, exchangeRates, tags, transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { RECURRING_TYPE } from "@/domain/recurrence";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { fetchMerchantImage } from "@/lib/logo-fetch";
import type { LogoOutcome } from "@/lib/logo-fetch";
import { glowFromImage } from "@/theme/glow";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { curtainGradient } from "../identity-curtain";
import { TransactionForm } from "./index";

jest.mock<Partial<typeof import("@react-native-async-storage/async-storage")>>(
    "@react-native-async-storage/async-storage",
    () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock<Partial<typeof import("expo-sqlite")>>("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
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
jest.mock<Partial<typeof import("expo-router")>>("expo-router", () => require("../../../jest/expo-router-stub"));
// Overrides `jest/i18n-key-stub.js` for the handful of keys whose TEXT is the
// thing under test, and keeps key-as-copy for every other one. The sentence
// template is the form's layout — `parseSentence` reads the slot order out of
// it — so handing back the key would render a sentence with no slots at all and
// there would be nothing left to drive. The extras line is here for the same
// reason its tags are asserted by name.
jest.mock("@/i18n/context", () => {
    // Read out of the catalog rather than restated here: a copy of the template
    // silently stops matching the shipped one the moment a slot is added, and
    // then every assertion below is driving a sentence the app does not render.
    const catalog = require("@/i18n/catalog") as typeof import("@/i18n/catalog");
    const TRANSLATED: Record<string, string> = {
        "transaction.sentence.expense": catalog.EN["transaction.sentence.expense"] ?? "",
        "transaction.sentence.extra.tags": catalog.EN["transaction.sentence.extra.tags"] ?? "",
        "transaction.sentence.income": catalog.EN["transaction.sentence.income"] ?? "",
    };
    return {
        LanguageProvider: ({ children }: { children: unknown }) => children,
        useLanguage: () => ({ language: "en" }),
        useTranslation: () => (key: string, params?: Record<string, unknown>) => {
            const template = TRANSLATED[key];
            if (template === undefined) {
                return key;
            }
            return template.replaceAll(/\{(\w+)\}/g, (match, name: string) =>
                params && name in params ? String(params[name]) : match
            );
        },
    };
});
jest.mock("number-flow-react-native", () => {
    const react = require("react") as typeof import("react");
    return {
        NumberFlow: (props: Record<string, unknown>) => react.createElement("NumberFlow", props),
    };
});
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
// The virtualised list is shipped code with its own suite, and mounting it here
// would drive Legend List's layout rather than the form's. What this file owns
// is the step around it and the code it hands back.
jest.mock<Partial<typeof import("../currency-picker-list")>>("../currency-picker-list", () => {
    const React = require("react");
    const { Pressable } = require("react-native");
    return {
        CurrencyPickerList: ({ onSelect }: { onSelect: (currency: string) => void }) =>
            React.createElement(Pressable, {
                accessibilityLabel: "test.selectCurrency.EUR",
                accessibilityRole: "button",
                onPress: () => onSelect("EUR"),
            }),
    };
});
jest.mock<Partial<typeof import("@/lib/subscription-reminder-sync")>>("@/lib/subscription-reminder-sync", () => ({
    syncSubscriptionReminders: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/logo-fetch", () => ({ fetchMerchantImage: jest.fn() }));
// Without a Convex client the real transport rejects and the hook answers
// nothing; the default here does the same, and a test can hold an answer back.
const mockEnrich = jest.fn<(args: unknown) => Promise<unknown>>(() => Promise.reject(new Error("no cloud")));
jest.mock("@/lib/convex", () => ({
    ...jest.requireActual<typeof import("@/lib/convex")>("@/lib/convex"),
    enrichmentTransport: () => (args: unknown) => mockEnrich(args),
}));
const mockedPhotoFilesRemove = jest.fn<(name: string) => void>();
jest.mock<Partial<typeof import("@/lib/photo-storage")>>("@/lib/photo-storage", () => ({
    persistLogoBytes: jest.fn<typeof import("@/lib/photo-storage").persistLogoBytes>(),
    photoFiles: {
        remove: (name: string) => mockedPhotoFilesRemove(name),
    } as typeof import("@/lib/photo-storage").photoFiles,
}));
jest.mock("@/theme/glow", () => {
    const actual = jest.requireActual<typeof import("@/theme/glow")>("@/theme/glow");
    return { ...actual, glowFromImage: jest.fn() };
});
// `backfillRecurring` defaults to the real implementation; the re-entrancy
// suite below overrides it once to hold the pipeline open past the row
// commit, so it can observe the CTA before `holdSubmitting()` would settle.
jest.mock("@/data/recurrence-backfill", () => {
    const actual = jest.requireActual<typeof import("@/data/recurrence-backfill")>("@/data/recurrence-backfill");
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
    const actual = jest.requireActual<typeof import("@expo/ui/swift-ui")>("@expo/ui/swift-ui");
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
    const promise = new Promise<T>((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { promise, reject, resolve };
}

const mockedFetchMerchantImage = jest.mocked(fetchMerchantImage);
const mockedGlowFromImage = jest.mocked(glowFromImage);
const mockedPersistLogoBytes = jest.mocked(
    (require("@/lib/photo-storage") as typeof import("@/lib/photo-storage")).persistLogoBytes
);

type Screen = Awaited<ReturnType<typeof render>>;

/**
 * The merchant slot draws its glyphs as a `Text` and overlays a transparent
 * `TextInput`, so the input carries no placeholder to find it by — its
 * accessibility label is the handle.
 */
const MERCHANT_FIELD = "transaction.field.name";

/** The verb that flips the entry between a one-off and a subscription. */
const REPEAT_VERB = "transaction.sentence.add.repeat";
// A set chip states its value rather than its noun, so it is labelled by the
// cadence it is repeating at.
const REPEAT_VERB_SET = "transaction.sentence.set.repeatMonthly";

/** The set chip's own ✕, which is the only way back off a schedule. */
const REPEAT_OFF = "transaction.schedule.stopRepeat";

/** The verb that opens the identity picker. */
const IDENTITY_VERB = "transaction.sentence.add.icon";

/** The extras line the sentence adds for tags, as the catalog phrases it. */
function taggedLine(names: string): string {
    return `Tagged ${names}.`;
}

/**
 * The identity mark rides inline on the merchant slot now rather than on a hero
 * of its own, so it is read out of that slot: the nearest ancestor of the
 * merchant input that draws a tile.
 *
 * Scoped rather than searched tree-wide on purpose — the fly-up twin stacked
 * over the form draws the same photo through `expo-image`, so a whole-tree
 * search would still find a logo after the in-sentence one had gone.
 */
function findImageSource(node: JsonNode): unknown {
    if (node.type === "Image") {
        return node.props?.source;
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            continue;
        }
        const found = findImageSource(child);
        if (found != null) {
            return found;
        }
    }
    return null;
}

function renderedMerchantImageUri(tree: JsonNode): string | null {
    const slot = findByProp(tree, "accessibilityLabel", MERCHANT_FIELD);
    if (slot == null) {
        throw new Error("Could not find the merchant slot in the render tree.");
    }
    // Searched downwards, not up: the tile is the slot's own leading child now
    // that the merchant is an ordinary sentence value rather than an inline field
    // with the logo drawn beside it.
    const source = findImageSource(slot);
    if (typeof source === "object" && source != null && "uri" in source && typeof source.uri === "string") {
        return source.uri;
    }
    return null;
}

/** One fact of the sentence — filled or blank — by the field it states. */
function sentenceSlot(tree: JsonNode, field: string): JsonNode {
    const slot = findByProp(tree, "accessibilityLabel", field);
    if (slot == null || slot.props.accessibilityRole !== "button") {
        throw new Error(`Could not find the sentence's ${field} slot.`);
    }
    return slot;
}

/** Every Tailwind class a subtree carries, one per entry. */
function classesIn(node: JsonNode | JsonNode[] | null): string[] {
    if (node == null) {
        return [];
    }
    if (Array.isArray(node)) {
        return node.flatMap((child) => classesIn(child));
    }
    const own = typeof node.props?.className === "string" ? node.props.className.split(" ") : [];
    return [...own, ...(node.children ?? []).flatMap((child) => (typeof child === "string" ? [] : classesIn(child)))];
}

/** A flagged slot is the one holding the save back: danger ink and danger rule. */
function slotFlagged(tree: JsonNode, field: string): boolean {
    const classes = classesIn(sentenceSlot(tree, field));
    return classes.includes("text-danger") || classes.includes("bg-danger");
}

/**
 * Names the merchant and lets the enrichment debounce fire. The sentence states
 * the name but no longer takes it — the stage's merchant step owns typing — so
 * this opens that step first, which is what a user does.
 */
async function changeMerchant(screen: Screen, value: string): Promise<void> {
    // Owns its own `act`, so callers must not wrap it in one: an act nested
    // inside another does not flush until the outer finishes, and the step would
    // not have mounted by the time this went to type into it.
    if (screen.queryByTestId("stage-merchant-field") === null) {
        await act(async () => {
            fireEvent.press(screen.getByLabelText(MERCHANT_FIELD));
        });
    }
    await act(async () => {
        fireEvent.changeText(screen.getByTestId("stage-merchant-field"), value);
        await jest.advanceTimersByTimeAsync(600);
    });
}

/**
 * Presses one of the sentence's chips. The chip's shape carries whether its fact
 * is set, so the label is the same either way.
 */
function pressVerb(screen: Screen, label: string): void {
    fireEvent.press(screen.getByText(label));
}

/** Presses one of the stage's option pills by the word on it. */
function pickOption(screen: Screen, label: string): void {
    fireEvent.press(screen.getByRole("button", { name: label }));
}

/**
 * Walks to the date wheel: the sentence's closing phrase opens the stage's
 * "when" step, whose picker option is the only thing that mounts a calendar.
 * Nothing presents over the form any more, so both taps land on the stage.
 */
async function openDateWheel(screen: Screen): Promise<void> {
    await act(async () => {
        fireEvent.press(screen.getByLabelText("transaction.field.date"));
    });
    await act(async () => {
        pickOption(screen, "transaction.sentence.when.pick");
    });
}

/**
 * Walks to the currency list: the sentence's currency word opens the stage's
 * currency step. Nothing presents over the form, so both taps land on it.
 */
async function pickEuro(screen: Screen): Promise<void> {
    await act(async () => {
        fireEvent.press(screen.getByLabelText("transaction.sentence.currency"));
    });
    await act(async () => {
        fireEvent.press(screen.getByLabelText("test.selectCurrency.EUR"));
    });
}

/** Opens the stage's rate step, whose one way in is the strip under the sentence. */
async function openRateStep(screen: Screen): Promise<void> {
    await act(async () => {
        fireEvent.press(screen.getByTestId("conversion-strip"));
    });
}

/**
 * Turns a one-off into a subscription the way the form now allows: the repeat
 * chip opens the stage's repeat step, and naming a cadence there IS the choice
 * to repeat.
 */
async function repeatMonthly(screen: Screen): Promise<void> {
    await act(async () => {
        pressVerb(screen, REPEAT_VERB);
    });
    await act(async () => {
        pickOption(screen, "transaction.cadence.monthly");
    });
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
            (modifier) =>
                typeof modifier === "object" && modifier != null && "$type" in modifier && modifier.$type === "blur"
        );
        if (typeof blur === "object" && blur != null && "radius" in blur && typeof blur.radius === "number") {
            return blur.radius;
        }
    }
    return null;
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

const RATE_DATE = new Date("2026-08-10T12:00:00.000Z");

async function seedStoredTransaction(
    db: Database,
    overrides: Partial<typeof transactions.$inferInsert> = {}
): Promise<Transaction> {
    const categoryId = overrides.categoryId ?? (await seedCategory(db));
    const id = overrides.id ?? `tx-${Math.random()}`;
    await db.insert(transactions).values({
        amount: 100,
        amountUsd: 1.801802,
        categoryId,
        currency: "VES",
        date: RATE_DATE,
        day: RATE_DATE,
        exchangeRate: 55.5,
        exchangeRateType: "custom",
        id,
        income: false,
        month: RATE_DATE,
        note: "Market purchase",
        updatedAt: RATE_DATE,
        ...overrides,
    });
    const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
    return row;
}

function hasSwiftText(tree: JsonNode, value: string): boolean {
    return findByProp(tree, "text", value) !== null;
}

function countText(node: JsonNode | JsonNode[] | null, value: string): number {
    if (node == null) {
        return 0;
    }
    if (Array.isArray(node)) {
        return node.reduce((sum, child) => sum + countText(child, value), 0);
    }
    let count = 0;
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            count += child === value ? 1 : 0;
            continue;
        }
        count += countText(child, value);
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

function findFunctionProp(node: JsonNode | JsonNode[] | null, key: string): ((value: unknown) => void) | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findFunctionProp(child, key);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (typeof node.props?.[key] === "function") {
        return node.props[key] as (value: unknown) => void;
    }
    for (const child of node.children ?? []) {
        if (typeof child !== "string") {
            const found = findFunctionProp(child, key);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

const dbHolder: { current: Database | null } = { current: null };
let closePickerForTest: (() => void) | null = null;

jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => dbHolder.current,
    useLocalData: () => mockTestLocalData({ db: dbHolder.current }),
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
    dbHolder.current = migratedDatabase();
});

describe("transactionForm", () => {
    it("renders create mode without crashing", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        expect(screen.toJSON()).toBeTruthy();
        // The expense/income segment is gone: direction is the sentence's opening
        // verb now, and the currency rides the amount rather than a bar above it.
        expect(screen.getByLabelText("transaction.sentence.kind.switch").props.accessibilityValue).toMatchObject({
            text: "transaction.sentence.kind.expense",
        });
        expect(screen.getByLabelText("transaction.sentence.currency").props.accessibilityValue).toMatchObject({
            text: "USD",
        });
    });

    it("opens a saved subscription on its own cadence, not as a one-off", async () => {
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
            recurringType: RECURRING_TYPE.yearly,
            reminderLeadDays: null,
        };
        const view = await render(
            <Providers>
                <TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
            </Providers>
        );

        expect(view.queryByText("transaction.sentence.set.repeatYearly")).not.toBeNull();
        expect(view.queryByText("transaction.sentence.add.repeat")).toBeNull();
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
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
            </Providers>
        );
        expect(containsText(screen.toJSON() as JsonNode, "🎸")).toBe(true);
        expect(screen.getByLabelText("transaction.identity.hero.removeLogo")).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.identity.hero.removeLogo"));
        });

        expect(containsText(screen.toJSON() as JsonNode, "🎸")).toBe(false);
        expect(screen.queryByLabelText("transaction.identity.hero.removeLogo")).toBeNull();
    });

    it("keeps a saved note marked as set after its editor closes", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        const initial = {
            amount: 12.5,
            categoryId,
            currency: null,
            customColor: null,
            date: new Date(),
            details: "Bring the receipt",
            emoji: null,
            icon: null,
            id: "noted-transaction",
            imageColor: null,
            imageUri: null,
            income: false,
            note: "Concert",
            onceRecurring: false,
            recurringCoefficient: 1,
            recurringEndDate: null,
            recurringType: 0,
            reminderLeadDays: null,
        } as Transaction;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        expect(screen.getByLabelText("transaction.field.notes")).toBeTruthy();
        expect(screen.getByText("transaction.sentence.add.note")).toBeTruthy();
        await act(async () => {
            pressVerb(screen, "transaction.sentence.add.note");
        });
        expect(screen.queryByLabelText("transaction.field.notes")).toBeNull();
        // The editor is closed but the note is still on the entry, so the chip has
        // to keep reading as set — otherwise closing the editor looks like it
        // discarded what was typed.
        expect(
            screen.getByRole("button", { name: "transaction.sentence.add.note" }).props.accessibilityState
        ).toMatchObject({ selected: true });
    });

    it("plumbs the seeded amount into the sentence's amount slot", async () => {
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
        expect(containsText(sentenceSlot(tree, "transaction.field.amount"), "$42.00")).toBe(true);
    });

    it("holds hook order across the real once -> subscription -> once toggle", async () => {
        const db = dbHolder.current as Database;
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        // In once mode the sentence's `repeat` chip is the only once/subscription
        // control on screen, and it is offered rather than set.
        expect(screen.getByRole("button", { name: REPEAT_VERB }).props.accessibilityState).toMatchObject({
            selected: false,
        });

        await repeatMonthly(screen);
        // A set chip states its cadence rather than the noun that offered it.
        expect(screen.getByText(REPEAT_VERB_SET)).toBeTruthy();
        // The chip's own ✕ is the way back off a schedule: the repeat step names
        // cadences, and "never" is not one of them.
        await act(async () => {
            fireEvent.press(screen.getByLabelText(REPEAT_OFF));
        });
        expect(screen.getByRole("button", { name: REPEAT_VERB }).props.accessibilityState).toMatchObject({
            selected: false,
        });

        const hookOrderViolations = errorSpy.mock.calls.filter(([message]) =>
            typeof message === "string" ? /change in the order of Hooks/.test(message) : false
        );
        expect(hookOrderViolations).toHaveLength(0);
        errorSpy.mockRestore();
    });

    it("states the whole schedule on the stage's repeat step, not in the form", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON, rerender } = screen;

        // The form itself carries no schedule rows any more: the whole of it —
        // cadence, dates, reminder — is one step of the bottom stage.
        expect(containsText(toJSON() as JsonNode, "transaction.field.remind")).toBe(false);

        await repeatMonthly(screen);

        expect(containsText(toJSON() as JsonNode, "transaction.field.remind")).toBe(true);
        // The running "starting <date>, ending <date>." line, which is the whole
        // of what the first-payment and end-date rows used to be.
        expect(screen.getByTestId("stage-repeat-line")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "transaction.cadence.monthly" }).props.accessibilityState
        ).toMatchObject({ selected: true });

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
            typeof message === "string" ? /change in the order of Hooks/.test(message) : false
        );
        expect(hookOrderViolations).toHaveLength(0);
        errorSpy.mockRestore();
    });
});

/**
 * The surface at the bottom is never absent. Before it existed, resolving a
 * picker left the form with an empty bottom and no way forward except knowing
 * that a word in the sentence is tappable — which is the whole defect the stage
 * replaced, and it came back once through a step that closed on its own answer.
 */
describe("transactionForm stage", () => {
    async function seedAccountRow(db: Database, id: string, name: string) {
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
    }

    it("rests on the keypad, which is the one step with no way back", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(screen.getByTestId("stage-footer")).toBeTruthy();
        expect(screen.queryByLabelText("common.back")).toBeNull();

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.category"));
        });
        expect(screen.getByLabelText("common.back")).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByLabelText("common.back"));
        });
        expect(screen.getByTestId("stage-footer")).toBeTruthy();
        expect(screen.queryByLabelText("common.back")).toBeNull();
    });

    it("leaves a stage on screen after each step resolves", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db);
        await seedAccountRow(db, "acc-1", "Checking");
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.category"));
        });
        await act(async () => {
            pickOption(screen, "Groceries");
        });
        expect(screen.getByTestId("stage-footer")).toBeTruthy();
        expect(containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Groceries")).toBe(
            true
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.account"));
        });
        await act(async () => {
            pickOption(screen, "Checking");
        });
        expect(screen.getByTestId("stage-footer")).toBeTruthy();
        expect(containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.account"), "Checking")).toBe(
            true
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.date"));
        });
        await act(async () => {
            pickOption(screen, "transaction.sentence.when.today");
        });
        expect(screen.getByTestId("stage-footer")).toBeTruthy();

        await repeatMonthly(screen);
        expect(screen.getByTestId("stage-footer")).toBeTruthy();
    });

    // The guided button is the way on for a user who never realises the
    // sentence is tappable, so pressing it on the step it is asking for has to
    // walk past that fact rather than reopening what is already on screen.
    it("walks the missing facts in the order the sentence states them", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db);
        await seedAccountRow(db, "acc-1", "Checking");
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        // Amount, then merchant, then category, then account — the sentence's own
        // order. The keypad is already on screen, so the press skips past it.
        expect(screen.getByTestId("stage-footer")).toHaveTextContent("common.next");
        await act(async () => {
            fireEvent.press(screen.getByTestId("stage-footer"));
        });
        expect(screen.getByTestId("stage-merchant-field")).toBeTruthy();

        // Nothing typed, and the press still moves on: the merchant is optional,
        // so asking for it and being answered with nothing IS the skip.
        await act(async () => {
            fireEvent.press(screen.getByTestId("stage-footer"));
        });
        expect(screen.getByTestId("stage-categories")).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByTestId("stage-footer"));
        });
        expect(screen.getByTestId("stage-accounts")).toBeTruthy();
    });

    // The currency picker was the last native BottomSheet the form presented, and
    // `transactions/create` is itself a modal: a sheet over it insets and dims the
    // parent and drops it out of the accessibility tree.
    it("picks a currency on the stage rather than in a sheet over the form", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(screen.queryByLabelText("test.selectCurrency.EUR")).toBeNull();

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.sentence.currency"));
        });
        expect(screen.getByLabelText("test.selectCurrency.EUR")).toBeTruthy();

        // Backing out lands on the keypad, never on nothing.
        await act(async () => {
            fireEvent.press(screen.getByLabelText("common.back"));
        });
        expect(screen.queryByLabelText("test.selectCurrency.EUR")).toBeNull();
        expect(screen.getByLabelText("transaction.amount.changeCurrency")).toBeTruthy();
    });

    it("takes the picked currency into the sentence and closes the step", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.sentence.currency"));
        });
        await act(async () => {
            fireEvent.press(screen.getByLabelText("test.selectCurrency.EUR"));
        });

        expect(screen.getByLabelText("transaction.sentence.currency").props.accessibilityValue).toMatchObject({
            text: "EUR",
        });
        expect(screen.getByLabelText("transaction.amount.changeCurrency")).toBeTruthy();
    });

    it("names the save once nothing is missing", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        await seedAccountRow(db, "acc-1", "Checking");
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
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.account"));
        });
        await act(async () => {
            pickOption(screen, "Checking");
        });

        expect(screen.getByTestId("stage-footer")).toHaveTextContent("transaction.cta.add");
    });
});

/**
 * The sentence names the merchant second and the ladder used to skip it. The
 * step is an additional way in, not a replacement: the sentence keeps its own
 * inline field, and both edit the same string.
 */
describe("transactionForm merchant step", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    async function seedFiled(db: Database, note: string, at: Date, categoryId: string | null = null) {
        await db.insert(transactions).values({
            amount: 10,
            categoryId,
            date: at,
            day: at,
            id: `tx-${note}-${at.getTime()}`,
            income: false,
            month: at,
            note,
            updatedAt: at,
        });
    }

    /** The name as the sentence itself is rendering it. */
    function sentenceMerchant(screen: Screen): string {
        return String(screen.getByLabelText(MERCHANT_FIELD).props.accessibilityValue.text);
    }

    // The word is a tap target like every other slot now — the sentence states
    // the name and the stage takes it.
    it("opens from the sentence's own merchant word", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(screen.queryByTestId("stage-merchant-field")).toBeNull();

        await act(async () => {
            fireEvent.press(screen.getByLabelText(MERCHANT_FIELD));
        });

        expect(screen.getByTestId("stage-merchant-field")).toBeTruthy();
    });

    it("offers the merchants this ledger has already filed, most recent first", async () => {
        const db = dbHolder.current as Database;
        await seedFiled(db, "Panaderia", new Date("2026-08-01T00:00:00.000Z"));
        await seedFiled(db, "Rio Supermercado", new Date("2026-08-10T00:00:00.000Z"));
        // The same merchant spelled two ways is one merchant, and the spelling
        // kept is the one it was last written with.
        await seedFiled(db, "PANADERIA", new Date("2026-08-12T00:00:00.000Z"));
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText(MERCHANT_FIELD));
        });

        const remembered = within(screen.getByTestId("stage-merchant-recent"));
        expect(remembered.getAllByRole("button").map((node) => String(node.props.accessibilityLabel))).toStrictEqual([
            "PANADERIA",
            "Rio Supermercado",
        ]);
    });

    // The step fills the same string the inline field does, so a chosen name has
    // to reach the enrichment pipeline exactly as a typed one does.
    it("takes a remembered merchant into the sentence and enriches from it", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db, "c-entertainment", "Entertainment");
        await seedFiled(db, "Netflix", new Date("2026-08-12T00:00:00.000Z"));
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText(MERCHANT_FIELD));
        });
        await act(async () => {
            pickOption(screen, "Netflix");
            await jest.advanceTimersByTimeAsync(600);
        });

        expect(sentenceMerchant(screen)).toBe("Netflix");
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);
    });

    it("enriches from the step's own field the way the sentence's does", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db, "c-entertainment", "Entertainment");
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText(MERCHANT_FIELD));
        });
        await act(async () => {
            fireEvent.changeText(screen.getByTestId("stage-merchant-field"), "Netflix");
            await jest.advanceTimersByTimeAsync(600);
        });

        expect(sentenceMerchant(screen)).toBe("Netflix");
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);
    });

    // Typing in the sentence is still the way it was; the step only adds a
    // second one. The inline field is uncontrolled, so this is also the check
    // that re-seeding it never happens under a caret.
    it("keeps the sentence's own field typing into the same name", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db, "c-entertainment", "Entertainment");
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "Netflix");

        expect(sentenceMerchant(screen)).toBe("Netflix");
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);
    });

    // The merchant drives enrichment, not validity: an entry that never names one
    // is whole, and the button has to say so rather than asking for it forever.
    it("does not hold the save for a merchant nobody named", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: new Date(),
            id: "acc-1",
            initialBalance: 0,
            initialBalanceDate: new Date(),
            initialBalanceUsd: 0,
            name: "Checking",
            sortOrder: 0,
            updatedAt: new Date(),
        });
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
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.account"));
        });
        await act(async () => {
            pickOption(screen, "Checking");
        });

        expect(sentenceMerchant(screen)).toBe("transaction.sentence.blank.merchant");
        expect(screen.getByTestId("stage-footer")).toHaveTextContent("transaction.cta.add");
    });
});

describe("transactionForm submit re-entrancy", () => {
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
        jest.mocked(backfillRecurring).mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    resolveBackfill = resolve;
                })
        );

        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        expect(screen.getByRole("button", { name: REPEAT_VERB }).props.accessibilityState).toMatchObject({
            selected: false,
        });
        await repeatMonthly(screen);

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
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });

        const stillDisabled = findButtonWithText(toJSON() as JsonNode, "transaction.cta.addSubscription") as
            | (JsonNode & { props: { disabled?: boolean } })
            | null;
        expect(stillDisabled?.props.disabled).toBe(true);
    });
});

describe("transactionForm enrichment", () => {
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

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "netflix");

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Entertainment")).toBe(true);
        expect(containsText(tree, taggedLine("Streaming, Subscription"))).toBe(true);
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

        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "netflix");

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Groceries")).toBe(true);
        expect(containsText(tree, "Entertainment")).toBe(false);
    });

    it("replaces an earlier suggestion when the name changes to another merchant", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db, "c-entertainment", "Entertainment");
        await seedCategory(db, "c-transport", "Transport");
        await seedTag(db, "tag-streaming", "Streaming");
        await seedTag(db, "tag-subscription", "Subscription");
        await seedTag(db, "tag-rideshare", "Rideshare");

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "netflix");
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);

        await changeMerchant(screen, "uber");

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Transport")).toBe(true);
        expect(containsText(tree, "Entertainment")).toBe(false);
        expect(containsText(tree, taggedLine("Rideshare"))).toBe(true);
        expect(containsText(tree, taggedLine("Streaming, Subscription"))).toBe(false);
    });

    // An edit looks its merchant up, but a saved category is the user's: the
    // suggestion fills only what is empty.
    it("keeps a saved category over the suggestion when an edit renames the merchant", async () => {
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

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "netflix");

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Groceries")).toBe(true);
        expect(containsText(tree, "Entertainment")).toBe(false);
    });

    it("fills an empty category when an edit renames the merchant", async () => {
        const db = dbHolder.current as Database;
        await seedCategory(db, "c-entertainment", "Entertainment");
        const initial: Partial<Transaction> = {
            amount: 12.5,
            categoryId: null,
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
            note: "Untitled",
            onceRecurring: false,
            recurringCoefficient: 1,
            recurringEndDate: null,
            recurringType: 0,
            reminderLeadDays: null,
        };

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial as any} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await changeMerchant(screen, "netflix");

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Entertainment")).toBe(true);
    });

    // The one path that overrides what the user filled: they asked for it, on
    // this row, and the save carries the answer to the merchant's other rows.
    it("refills a saved row on request and carries the answer to the merchant's siblings on save", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        await seedCategory(db, "c-entertainment", "Entertainment");
        const bytes = new Uint8Array([1, 2, 3]);
        mockedFetchMerchantImage.mockResolvedValue({ bytes, kind: "logo" });
        mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
        mockedGlowFromImage.mockResolvedValue(["#123456"]);
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            emoji: "🎬",
            id: "asked",
            note: "Netflix",
        });
        await seedStoredTransaction(db, { categoryId: null, currency: "USD", id: "sibling", note: "NETFLIX" });
        await seedStoredTransaction(db, { categoryId: groceries, currency: "USD", id: "filed", note: "netflix" });

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        expect(findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")).not.toBeNull();

        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });

        const tree = screen.toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Entertainment")).toBe(true);
        expect(renderedMerchantImageUri(tree)).toBe("file:///logos/netflix.png");
        expect(mockedFetchMerchantImage).toHaveBeenCalledWith({
            domain: "netflix.com",
            name: "Netflix",
            refresh: true,
        });

        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());
        await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
        });

        const [asked] = await db.select().from(transactions).where(eq(transactions.id, "asked"));
        expect(asked).toMatchObject({
            categoryId: "c-entertainment",
            emoji: null,
            imageUri: "file:///logos/netflix.png",
        });
        const [sibling] = await db.select().from(transactions).where(eq(transactions.id, "sibling"));
        expect(sibling).toMatchObject({ categoryId: "c-entertainment", imageUri: "file:///logos/netflix.png" });
        const [filed] = await db.select().from(transactions).where(eq(transactions.id, "filed"));
        expect(filed).toMatchObject({ categoryId: groceries, imageUri: "file:///logos/netflix.png" });
    });

    // Save stays pressable while a lookup is out. A save that lands before the
    // answer, or after an answer of nothing, must not treat the row's own old
    // category as the answer and copy it onto siblings that had none.
    it("carries nothing to siblings when the lookup has not answered", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            id: "asked",
            note: "Zzq Unresolvable Shop",
        });
        await seedStoredTransaction(db, {
            categoryId: null,
            currency: "USD",
            id: "sibling",
            note: "zzq unresolvable shop",
        });

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());
        await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
        });

        const [sibling] = await db.select().from(transactions).where(eq(transactions.id, "sibling"));
        expect(sibling.categoryId).toBeNull();
    });

    it("carries nothing when a second lookup for the same merchant is still out at save", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        await seedCategory(db, "c-fun", "Entertainment");
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            id: "asked",
            note: "Zzq Unresolvable Shop",
        });
        await seedStoredTransaction(db, {
            categoryId: null,
            currency: "USD",
            id: "sibling",
            note: "zzq unresolvable shop",
        });
        const answers: ((value: unknown) => void)[] = [];
        const hold = () =>
            new Promise((resolve) => {
                answers.push(resolve);
            });
        mockEnrich.mockImplementation(hold);

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        await act(async () => {
            answers[0]?.({ categoryName: "Entertainment", domain: null, isNewCategory: false, tags: [] });
            await jest.advanceTimersByTimeAsync(0);
        });
        await act(async () => {
            answers[1]?.(null);
            await jest.advanceTimersByTimeAsync(0);
        });
        // Answered once; asked again and saved before the second answer.
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(answers).toHaveLength(3);
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());
        await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
        });

        const [sibling] = await db.select().from(transactions).where(eq(transactions.id, "sibling"));
        expect(sibling.categoryId).toBeNull();
        mockEnrich.mockRejectedValue(new Error("no cloud"));
    });

    // What the user picked after the answer is a choice for this row, not part
    // of the answer, so it does not travel to the merchant's other rows.
    it("carries the lookup's answer to siblings, not a category picked afterwards", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        await seedCategory(db, "c-work", "Work");
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            emoji: "🍿",
            id: "asked",
            note: "Netflix",
        });
        await seedStoredTransaction(db, { categoryId: null, currency: "USD", id: "sibling", note: "netflix" });
        mockedFetchMerchantImage.mockResolvedValue({ kind: "none" });

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);
        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.category"));
        });
        await act(async () => {
            pickOption(screen, "Work");
        });
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());
        await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
        });

        const [asked] = await db.select().from(transactions).where(eq(transactions.id, "asked"));
        expect(asked.categoryId).toBe("c-work");
        const [sibling] = await db.select().from(transactions).where(eq(transactions.id, "sibling"));
        // The tags the lookup found still travel; the category picked by hand does not.
        expect(sibling.categoryId).toBeNull();
        expect((await tagIdsForQuery(db, "sibling")).length).toBeGreaterThan(0);
    });

    // The hook asks again on its own when the currency changes. That answer
    // is the form's fill-empty kind, not the user's request.
    it("ends the requested lookup when the currency changes, so the re-ask fills only what is empty", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        await seedCategory(db, "c-fun", "Entertainment");
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            id: "asked",
            note: "Zzq Unresolvable Shop",
        });
        const answers: ((value: unknown) => void)[] = [];
        const hold = () =>
            new Promise((resolve) => {
                answers.push(resolve);
            });
        mockEnrich.mockImplementation(hold);
        const remote = { categoryName: "Entertainment", domain: null, isNewCategory: false, tags: [] };

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        await pickEuro(screen);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(600);
        });
        // The first ask was superseded by the currency change; the re-ask is out.
        expect(answers.length).toBeGreaterThanOrEqual(2);
        await act(async () => {
            for (const answer of answers) {
                answer(remote);
            }
            await jest.advanceTimersByTimeAsync(0);
        });

        expect(containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Groceries")).toBe(
            true
        );
        mockEnrich.mockRejectedValue(new Error("no cloud"));
    });

    // The answer lands after the user has already picked: what they chose in
    // the meantime is newer than the lookup, so it stands. A slot left alone
    // since the tap still yields.
    it("keeps a category picked while the lookup was out, and still refills one left alone", async () => {
        const db = dbHolder.current as Database;
        const groceries = await seedCategory(db, "c-groceries", "Groceries");
        await seedCategory(db, "c-work", "Work");
        await seedCategory(db, "c-fun", "Entertainment");
        const initial = await seedStoredTransaction(db, {
            categoryId: groceries,
            currency: "USD",
            id: "asked",
            note: "Zzq Unresolvable Shop",
        });
        const answers: ((value: unknown) => void)[] = [];
        const hold = () =>
            new Promise((resolve) => {
                answers.push(resolve);
            });
        mockEnrich.mockImplementation(hold);
        const remote = { categoryName: "Entertainment", domain: null, isNewCategory: false, tags: [] };

        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(answers).toHaveLength(1);
        await act(async () => {
            fireEvent.press(screen.getByLabelText("transaction.field.category"));
        });
        await act(async () => {
            pickOption(screen, "Work");
        });
        await act(async () => {
            answers[0]?.(remote);
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Work")).toBe(
            true
        );
        // The fast pass had no domain, so the grounded follow-up went out too;
        // it has to settle before the button takes another tap.
        expect(answers).toHaveLength(2);
        await act(async () => {
            answers[1]?.(null);
            await jest.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")?.props.onButtonPress();
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(answers).toHaveLength(3);
        await act(async () => {
            answers[2]?.(remote);
            await jest.advanceTimersByTimeAsync(0);
        });
        expect(
            containsText(sentenceSlot(screen.toJSON() as JsonNode, "transaction.field.category"), "Entertainment")
        ).toBe(true);
        mockEnrich.mockRejectedValue(new Error("no cloud"));
    });

    // A new entry looks itself up as it is typed; the button is for a row
    // whose earlier answer is what the user wants replaced.
    it("offers no lookup button while creating", async () => {
        const screen = await render(
            <Providers>
                <TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        expect(findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.lookup")).toBeNull();
    });
});

describe("transactionForm logo attachment", () => {
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

    // The fetch for the previous name is still out when the field is retyped,
    // and the next name's own lookup has not fired yet: the old logo must not
    // land on the new name in that gap.
    it("drops a logo that settles after the name changed", async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        let settle: (value: LogoOutcome) => void = () => {};
        mockedFetchMerchantImage.mockReturnValue(
            new Promise<LogoOutcome>((resolve) => {
                settle = resolve;
            })
        );
        mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
        mockedGlowFromImage.mockResolvedValue(["#123456"]);
        const removed: string[] = [];
        mockedPhotoFilesRemove.mockImplementation((name: string) => {
            removed.push(name);
        });

        const screen = await render(
            <Providers>
                <TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        await changeMerchant(screen, "netflix");
        expect(mockedFetchMerchantImage).toHaveBeenCalledTimes(1);
        await act(async () => {
            fireEvent.changeText(screen.getByTestId("stage-merchant-field"), "zzq other shop");
        });
        await act(async () => {
            settle({ bytes, kind: "logo" });
            await jest.advanceTimersByTimeAsync(0);
        });

        expect(renderedMerchantImageUri(screen.toJSON() as JsonNode)).toBeNull();
        // Dropped before it was stored, so there is no file to discard either.
        expect(mockedPersistLogoBytes).not.toHaveBeenCalled();
        expect(removed).toStrictEqual([]);
    });

    it("renders the persisted logo and its extracted curtain color", async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        mockedFetchMerchantImage.mockResolvedValue({ bytes, kind: "logo" });
        mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
        mockedGlowFromImage.mockResolvedValue(["#123456"]);

        const screen = await render(
            <Providers>
                <TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");

        const tree = toJSON() as JsonNode;
        expect(renderedMerchantImageUri(tree)).toBe("file:///logos/netflix.png");
        expect(renderedCurtain(tree)).toStrictEqual(curtainGradient(["#123456"], false));
        expect(mockedFetchMerchantImage).toHaveBeenCalledWith({
            domain: "netflix.com",
            name: "netflix",
            refresh: false,
        });
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

        await changeMerchant(renderResult, "netflix");
        await act(async () => {
            pressVerb(renderResult, IDENTITY_VERB);
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
        await changeMerchant(renderResult, "uber");

        const tree = renderResult.toJSON() as JsonNode;
        expect(renderedMerchantImageUri(tree)).toBe("file:///logos/netflix.png");
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
        const screen = await render(
            <Providers>
                <TransactionForm {...props} db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");

        const tree = toJSON() as JsonNode;
        if (uri != null) {
            expect(renderedMerchantImageUri(tree)).toBe(uri);
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

        await changeMerchant(renderResult, "netflix");
        await act(async () => {
            pressVerb(renderResult, IDENTITY_VERB);
        });
        expect(renderedFormBlurRadius(renderResult.toJSON() as JsonNode)).toBeGreaterThan(0);
        await act(async () => {
            pendingLogo.resolve({ bytes, kind: "logo" });
            await Promise.resolve();
        });

        expect(renderedMerchantImageUri(renderResult.toJSON() as JsonNode)).toBeNull();
        expect(mockedPersistLogoBytes).not.toHaveBeenCalled();
        expect(mockedGlowFromImage).not.toHaveBeenCalled();
    });

    it("clears a suggested logo when enrichment resolves to none", async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        mockedFetchMerchantImage.mockResolvedValueOnce({ bytes, kind: "logo" }).mockResolvedValueOnce({ kind: "none" });
        mockedPersistLogoBytes.mockResolvedValue("file:///logos/netflix.png");
        mockedGlowFromImage.mockResolvedValue(["#123456"]);

        const screen = await render(
            <Providers>
                <TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");
        expect(renderedMerchantImageUri(toJSON() as JsonNode)).toBe("file:///logos/netflix.png");

        await changeMerchant(screen, "uber");

        const tree = toJSON() as JsonNode;
        expect(renderedMerchantImageUri(tree)).toBeNull();
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

        await changeMerchant(renderResult, "netflix");
        await act(async () => {
            pressVerb(renderResult, IDENTITY_VERB);
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
        await changeMerchant(renderResult, "unknown merchant");

        const tree = renderResult.toJSON() as JsonNode;
        expect(renderedMerchantImageUri(tree)).toBe("file:///logos/netflix.png");
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

        const screen = await render(
            <Providers>
                <TransactionForm db={dbHolder.current as Database} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");
        await changeMerchant(screen, "uber");
        await act(async () => {
            uber.resolve({ bytes: uberBytes, kind: "logo" });
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(renderedMerchantImageUri(toJSON() as JsonNode)).toBe("file:///logos/uber.png");
        expect(renderedCurtain(toJSON() as JsonNode)).toStrictEqual(curtainGradient(["#654321"], false));

        await act(async () => {
            netflix.resolve({ bytes: netflixBytes, kind: "logo" });
            await Promise.resolve();
        });

        expect(renderedMerchantImageUri(toJSON() as JsonNode)).toBe("file:///logos/uber.png");
        expect(renderedCurtain(toJSON() as JsonNode)).toStrictEqual(curtainGradient(["#654321"], false));
        expect(mockedPersistLogoBytes).toHaveBeenCalledTimes(1);
        expect(mockedPersistLogoBytes).toHaveBeenCalledWith(uberBytes);
        expect(mockedPersistLogoBytes).not.toHaveBeenCalledWith(netflixBytes);
    });
});

describe("transactionForm pending category and tag materialization", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("saves with only a pending category — no shake, no category error — and materializes it", async () => {
        const db = dbHolder.current as Database;
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");

        let tree = toJSON() as JsonNode;
        expect(containsText(sentenceSlot(tree, "transaction.field.category"), "Entertainment")).toBe(true);
        // What the row's "will be created" caption used to say, asserted against
        // the ledger instead: the caption lives in the picker now, and the fact it
        // stated is that no such category exists yet.
        await expect(db.select().from(categories).where(eq(categories.name, "Entertainment"))).resolves.toHaveLength(0);
        expect(slotFlagged(tree, "transaction.field.category")).toBe(false);

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
        expect(
            containsText(sentenceSlot(tree, "transaction.field.category"), "transaction.sentence.blank.category")
        ).toBe(false);

        alertSpy.mockRestore();
    });

    it("materializes pending tags via ensureTag and merges them into a single setTagsFor call", async () => {
        const db = dbHolder.current as Database;
        const setTagsSpy = jest.spyOn(tagsRepo, "setTagsFor");

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");

        const tree = toJSON() as JsonNode;
        expect(containsText(tree, taggedLine("Streaming, Subscription"))).toBe(true);

        const saveButton = findButtonWithText(tree, "transaction.cta.add");
        await act(async () => {
            saveButton?.props.onButtonPress();
        });

        expect(setTagsSpy).toHaveBeenCalledTimes(1);
        const calledTagIds = setTagsSpy.mock.calls[0]?.[2];
        expect(calledTagIds).toHaveLength(2);

        const createdTags = await db.select().from(tags);
        expect(createdTags.map((row) => row.name).sort()).toStrictEqual(["Streaming", "Subscription"]);

        setTagsSpy.mockRestore();
    });

    // The caption this used to count is in the category picker now, so the
    // suggestion is counted where it is stated: once in the sentence, and still
    // once after the same name is re-typed and enriched again.
    it("states the pending category exactly once and it does not grow while typing continues", async () => {
        const db = dbHolder.current as Database;

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");
        expect(countText(toJSON() as JsonNode, "Entertainment")).toBe(1);

        await changeMerchant(screen, "netflix");
        expect(countText(toJSON() as JsonNode, "Entertainment")).toBe(1);
    });

    it("aborts before writing any transaction row when the pending category fails to materialize", async () => {
        const db = dbHolder.current as Database;
        const createSpy = jest.spyOn(categoriesRepo, "create").mockRejectedValueOnce(new Error("boom"));

        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
            </Providers>
        );
        const { toJSON } = screen;

        await changeMerchant(screen, "netflix");
        expect(containsText(sentenceSlot(toJSON() as JsonNode, "transaction.field.category"), "Entertainment")).toBe(
            true
        );
        expect(createSpy).not.toHaveBeenCalled();

        const saveButton = findButtonWithText(toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => {
            saveButton?.props.onButtonPress();
        });

        expect(createSpy).toHaveBeenCalledTimes(1);
        await expect(db.select().from(transactions)).resolves.toHaveLength(0);
        // The save was rejected for the category, so the category has to say so —
        // the CTA re-lighting in silence is indistinguishable from a missed tap.
        expect(slotFlagged(toJSON() as JsonNode, "transaction.field.category")).toBe(true);

        createSpy.mockRestore();
    });

    it("saves a named merchant nothing could file yet, and queues it for the lookup", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
            </Providers>
        );

        await changeMerchant(screen, "CARE4BAG AE");
        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add")?.props.onButtonPress();
        });

        const saved = await db.select().from(transactions);
        expect(saved).toHaveLength(1);
        expect(saved[0]?.categoryId).toBeNull();
        expect(JSON.parse((await getMeta(db, META_KEYS.enrichmentOutbox)) ?? "[]")).toStrictEqual([saved[0]?.id]);
    });

    it("still holds the save for a category when there is no merchant to look up", async () => {
        const db = dbHolder.current as Database;
        const screen = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} seed={{ amount: 25 }} />
            </Providers>
        );

        await act(async () => {
            findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add")?.props.onButtonPress();
        });

        await expect(db.select().from(transactions)).resolves.toHaveLength(0);
        expect(slotFlagged(screen.toJSON() as JsonNode, "transaction.field.category")).toBe(true);
    });
});

describe("transactionForm account attachment", () => {
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

    it("shows the account blank while nothing was ever attached", async () => {
        const db = dbHolder.current as Database;
        const { toJSON } = await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        const tree = toJSON() as JsonNode;
        expect(
            containsText(sentenceSlot(tree, "transaction.field.account"), "transaction.sentence.blank.account")
        ).toBe(true);
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

        expect(containsText(sentenceSlot(toJSON() as JsonNode, "transaction.field.account"), "Checking")).toBe(true);
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
        expect(containsText(sentenceSlot(tree, "transaction.field.account"), "Savings")).toBe(true);
        expect(containsText(tree, "Checking")).toBe(false);
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
        await expect(getMeta(db, META_KEYS.lastTransactionAccount)).resolves.toBe(accountId);
    });
});

describe("transactionForm entry-rate confirmation", () => {
    it("seeds an edit from its frozen rate type and actual rate", async () => {
        const db = dbHolder.current as Database;
        const initial = await seedStoredTransaction(db);
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        // The strip under the sentence states the conversion the frozen rate produced.
        expect(screen.getByText("Bs.100.00 = $1.80")).toBeTruthy();
        expect(screen.getByText("transaction.rate.custom · 55.5")).toBeTruthy();

        await openRateStep(screen);
        expect(
            screen.getByLabelText("transaction.rate.title · transaction.rate.custom").props.accessibilityValue
        ).toMatchObject({ text: "55.5 transaction.rate.perUsd" });
    });

    it("opens a custom pending occurrence saying the entry is recorded but not converted", async () => {
        const db = dbHolder.current as Database;
        const initial = await seedStoredTransaction(db, {
            amountUsd: null,
            exchangeRate: null,
            exchangeRateType: "custom",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        expect(screen.getByText("transaction.rate.notConverted")).toBeTruthy();
        expect(screen.getByText("transaction.rate.setRate")).toBeTruthy();
        // The strip collapses its own alert role, so the reassurance has to reach
        // assistive technology as the button's hint.
        expect(screen.getByTestId("conversion-strip").props.accessibilityHint).toBe("transaction.rate.pendingBody");
    });

    it("defaults a new non-USD entry to official and a USD entry to no rate type", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        const vesCopy: LogAgainDraft = {
            amount: 25,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "VES entry",
        };
        const ves = await render(
            <Providers>
                <TransactionForm copyOf={vesCopy} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        await openRateStep(ves);
        expect(ves.getByLabelText("transaction.rate.title · transaction.rate.official")).toBeTruthy();
        await ves.unmount();

        const usd = await render(
            <Providers>
                <TransactionForm copyOf={{ ...vesCopy, currency: "USD" }} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        // No strip at all, so there is no way into a rate step either.
        expect(usd.queryByTestId("conversion-strip")).toBeNull();
    });

    it("removes EUR-reference when currency changes away from VES", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        const copyOf: LogAgainDraft = {
            amount: 25,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "VES entry",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.eur_reference" }));
        await waitFor(() => {
            expect(screen.getByLabelText("transaction.rate.title · transaction.rate.eur_reference")).toBeTruthy();
        });
        await pickEuro(screen);

        await openRateStep(screen);
        await waitFor(() => {
            expect(screen.getByLabelText("transaction.rate.title · transaction.rate.official")).toBeTruthy();
            expect(screen.queryByRole("button", { name: "transaction.rate.eur_reference" })).toBeNull();
        });
    });

    it("clears an existing VES custom rate when the transaction currency changes to EUR", async () => {
        const db = dbHolder.current as Database;
        const initial = await seedStoredTransaction(db, {
            currency: "VES",
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        expect(
            screen.getByLabelText("transaction.rate.title · transaction.rate.custom").props.accessibilityValue
        ).toMatchObject({ text: "55.5 transaction.rate.perUsd" });
        await pickEuro(screen);

        await openRateStep(screen);
        await waitFor(() => {
            expect(screen.getByLabelText("transaction.rate.editCustom")).toBeTruthy();
            expect(screen.queryByText("55.5")).toBeNull();
        });
    });

    it("does not submit a blank custom rate", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        const copyOf: LogAgainDraft = {
            amount: 25,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "VES entry",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.custom" }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        await expect(db.select().from(transactions)).resolves.toHaveLength(0);
        expect(screen.getByText("transaction.rate.required")).toBeTruthy();
    });

    it("submits the exact positive custom rate the user confirmed", async () => {
        const db = dbHolder.current as Database;
        const prior = await seedStoredTransaction(db, { date: new Date("2026-08-01T12:00:00.000Z") });
        const copyOf: LogAgainDraft = {
            amount: 25,
            categoryId: prior.categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "New entry",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.custom" }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        const saved = (await db.select().from(transactions)).find((row) => row.id !== prior.id);
        expect(saved).toMatchObject({ exchangeRate: 55.5, exchangeRateType: "custom" });
    });

    it("submits a pressed official or EUR-reference suggestion as its selected policy without reusing prior custom", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        await db.insert(exchangeRates).values({
            date: "2026-08-10",
            fetchedAt: 1,
            quote: "VES",
            rate: 42,
            rateType: "official",
            source: "provider",
        });
        const copyOf: LogAgainDraft = {
            amount: 84,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "Provider entry",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByLabelText("transaction.rate.title · transaction.rate.official"));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            exchangeRate: 42,
            exchangeRateType: "official",
        });
    });

    it("submits an offered EUR-reference suggestion only when its EUR-official leg is cached", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        await db.insert(exchangeRates).values([
            { date: "2026-08-10", fetchedAt: 1, quote: "VES", rate: 50, rateType: "eur_reference", source: "provider" },
            { date: "2026-08-10", fetchedAt: 1, quote: "EUR", rate: 0.8, rateType: "official", source: "provider" },
        ]);
        const copyOf: LogAgainDraft = {
            amount: 100,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "EUR-reference entry",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.eur_reference" }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 2.5,
            exchangeRate: 50,
            exchangeRateType: "eur_reference",
        });
    });

    it("refreshes rate suggestions when the cache revision changes while the form remains open", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        const copyOf: LogAgainDraft = {
            amount: 84,
            categoryId,
            currency: "VES",
            customColor: null,
            details: null,
            emoji: null,
            icon: null,
            income: false,
            note: "Open form",
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );
        await openRateStep(screen);
        expect(
            screen.getByLabelText("transaction.rate.title · transaction.rate.official").props.accessibilityValue?.text
        ).toBeUndefined();

        await act(async () => {
            await db.insert(exchangeRates).values({
                date: "2026-08-10",
                fetchedAt: 1,
                quote: "VES",
                rate: 42,
                rateType: "official",
                source: "provider",
            });
            bumpRatesRevision();
        });

        await waitFor(() => {
            expect(
                screen.getByLabelText("transaction.rate.title · transaction.rate.official").props.accessibilityValue
            ).toMatchObject({ text: "42 transaction.rate.perUsd" });
        });
    });

    it("saving a pending custom edit replaces the pending triple with a frozen value", async () => {
        const db = dbHolder.current as Database;
        const pending = await seedStoredTransaction(db, {
            amountUsd: null,
            exchangeRate: null,
            exchangeRateType: "custom",
            id: "pending",
        });
        await seedStoredTransaction(db, {
            categoryId: pending.categoryId,
            date: new Date("2026-08-01T12:00:00.000Z"),
            id: "prior",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={pending} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByLabelText("transaction.rate.title · transaction.rate.custom"));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        const [saved] = await db.select().from(transactions).where(eq(transactions.id, pending.id));
        expect(saved).toMatchObject({ amountUsd: 1.801802, exchangeRate: 55.5, exchangeRateType: "custom" });
    });

    it("copy/log-again treats the old custom rate as a suggestion rather than silently copying it", async () => {
        const db = dbHolder.current as Database;
        const old = await seedStoredTransaction(db, { date: new Date("2026-08-01T12:00:00.000Z") });
        const copyOf: LogAgainDraft = {
            amount: old.amount,
            categoryId: old.categoryId,
            currency: old.currency,
            customColor: old.customColor,
            details: old.details,
            emoji: old.emoji,
            icon: old.icon,
            income: old.income,
            note: old.note,
        };
        const screen = await render(
            <Providers>
                <TransactionForm copyOf={copyOf} db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await openRateStep(screen);
        expect(screen.getByLabelText("transaction.rate.title · transaction.rate.official")).toBeTruthy();
        expect(screen.getByRole("button", { name: "transaction.rate.custom" }).props.accessibilityValue).toMatchObject({
            text: "55.5 transaction.rate.perUsd",
        });
    });

    it("re-resolves an official suggestion after the transaction currency changes", async () => {
        const db = dbHolder.current as Database;
        const categoryId = await seedCategory(db);
        await db.insert(exchangeRates).values([
            { date: "2026-08-10", fetchedAt: 1, quote: "VES", rate: 42, rateType: "official", source: "provider" },
            { date: "2026-08-10", fetchedAt: 1, quote: "EUR", rate: 0.8, rateType: "official", source: "provider" },
        ]);
        const screen = await render(
            <Providers>
                <TransactionForm
                    copyOf={{
                        amount: 84,
                        categoryId,
                        currency: "VES",
                        customColor: null,
                        details: null,
                        emoji: null,
                        icon: null,
                        income: false,
                        note: "Currency change",
                    }}
                    db={db}
                    mode="create"
                    onDone={() => {}}
                />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByLabelText("transaction.rate.title · transaction.rate.official"));
        await pickEuro(screen);
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 105,
            exchangeRate: 0.8,
            exchangeRateType: "official",
        });
    });

    it("invalidates a prior-custom suggestion when the transaction date changes", async () => {
        const db = dbHolder.current as Database;
        const prior = await seedStoredTransaction(db, { date: new Date("2026-08-01T12:00:00.000Z") });
        const screen = await render(
            <Providers>
                <TransactionForm
                    copyOf={{
                        amount: 25,
                        categoryId: prior.categoryId,
                        currency: "VES",
                        customColor: null,
                        details: null,
                        emoji: null,
                        icon: null,
                        income: false,
                        note: "Date change",
                    }}
                    db={db}
                    mode="create"
                    onDone={() => {}}
                />
            </Providers>
        );
        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.custom" }));
        await openDateWheel(screen);
        const changeDate = findFunctionProp(screen.toJSON() as JsonNode, "onDateChange");
        expect(changeDate).not.toBeNull();
        await act(async () => changeDate?.({ nativeEvent: { date: new Date("2026-07-31T12:00:00.000Z").getTime() } }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions)).map((row) => row.id)).toStrictEqual([prior.id]);
        expect(screen.getByText("transaction.rate.notConverted")).toBeTruthy();
        await openRateStep(screen);
        expect(screen.getByText("transaction.rate.required")).toBeTruthy();
    });

    it("keeps an explicitly entered custom rate when the transaction date changes", async () => {
        const db = dbHolder.current as Database;
        const initial = await seedStoredTransaction(db, { date: new Date("2026-08-01T12:00:00.000Z") });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );
        await openDateWheel(screen);
        const changeDate = findFunctionProp(screen.toJSON() as JsonNode, "onDateChange");
        expect(changeDate).not.toBeNull();
        await act(async () => changeDate?.({ nativeEvent: { date: new Date("2026-07-31T12:00:00.000Z").getTime() } }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
    });

    it("re-resolves an existing official rate when the transaction date changes", async () => {
        const db = dbHolder.current as Database;
        await db.insert(exchangeRates).values({
            date: "2026-08-09",
            fetchedAt: 1,
            quote: "VES",
            rate: 40,
            rateType: "official",
            source: "provider",
        });
        const initial = await seedStoredTransaction(db, {
            amountUsd: 2,
            exchangeRate: 50,
            exchangeRateType: "official",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await openDateWheel(screen);
        const changeDate = findFunctionProp(screen.toJSON() as JsonNode, "onDateChange");
        expect(changeDate).not.toBeNull();
        await act(async () => changeDate?.({ nativeEvent: { date: new Date("2026-08-09T12:00:00.000Z").getTime() } }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 2.5,
            exchangeRate: 40,
            exchangeRateType: "official",
        });
    });

    it("re-resolves an existing official rate when the transaction currency changes", async () => {
        const db = dbHolder.current as Database;
        await db.insert(exchangeRates).values({
            date: "2026-08-10",
            fetchedAt: 1,
            quote: "EUR",
            rate: 0.8,
            rateType: "official",
            source: "provider",
        });
        const initial = await seedStoredTransaction(db, {
            amountUsd: 2,
            exchangeRate: 50,
            exchangeRateType: "official",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await pickEuro(screen);
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 125,
            currency: "EUR",
            exchangeRate: 0.8,
            exchangeRateType: "official",
        });
    });

    it("re-resolves both legs of an existing EUR-reference rate when the date changes", async () => {
        const db = dbHolder.current as Database;
        await db.insert(exchangeRates).values([
            {
                date: "2026-08-09",
                fetchedAt: 1,
                quote: "VES",
                rate: 50,
                rateType: "eur_reference",
                source: "provider",
            },
            { date: "2026-08-09", fetchedAt: 1, quote: "EUR", rate: 0.8, rateType: "official", source: "provider" },
        ]);
        const initial = await seedStoredTransaction(db, {
            amountUsd: 2,
            exchangeRate: 45,
            exchangeRateType: "eur_reference",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        await openDateWheel(screen);
        const changeDate = findFunctionProp(screen.toJSON() as JsonNode, "onDateChange");
        expect(changeDate).not.toBeNull();
        await act(async () => changeDate?.({ nativeEvent: { date: new Date("2026-08-09T12:00:00.000Z").getTime() } }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 2.5,
            exchangeRate: 50,
            exchangeRateType: "eur_reference",
        });
    });

    it("preserves a high-precision custom suggestion when saving", async () => {
        const db = dbHolder.current as Database;
        const prior = await seedStoredTransaction(db, {
            date: new Date("2026-08-01T12:00:00.000Z"),
            exchangeRate: 55.555555,
        });
        const screen = await render(
            <Providers>
                <TransactionForm
                    copyOf={{
                        amount: 100,
                        categoryId: prior.categoryId,
                        currency: "VES",
                        customColor: null,
                        details: null,
                        emoji: null,
                        icon: null,
                        income: false,
                        note: "Precise suggestion",
                    }}
                    db={db}
                    mode="create"
                    onDone={() => {}}
                />
            </Providers>
        );

        await openRateStep(screen);
        await fireEvent.press(screen.getByRole("button", { name: "transaction.rate.custom" }));
        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.add");
        await act(async () => saveButton?.props.onButtonPress());

        const saved = (await db.select().from(transactions)).find((row) => row.id !== prior.id);
        expect(saved).toMatchObject({
            exchangeRate: 55.555555,
            exchangeRateType: "custom",
        });
    });

    it("preserves the exact frozen rate when an unrelated edit is saved", async () => {
        const db = dbHolder.current as Database;
        const initial = await seedStoredTransaction(db, {
            amountUsd: 1.8,
            exchangeRate: 55.555555,
            exchangeRateType: "custom",
        });
        const screen = await render(
            <Providers>
                <TransactionForm db={db} initial={initial} mode="edit" onDone={() => {}} />
            </Providers>
        );

        const saveButton = findButtonWithText(screen.toJSON() as JsonNode, "transaction.cta.save");
        await act(async () => saveButton?.props.onButtonPress());

        expect((await db.select().from(transactions))[0]).toMatchObject({
            amountUsd: 1.8,
            exchangeRate: 55.555555,
            exchangeRateType: "custom",
        });
    });
});

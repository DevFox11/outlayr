import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";

import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";
import type { EnrichmentSuggestion } from "@/hooks/use-transaction-enrichment";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionForm } from "./index";

const SENTINEL_LOCALE = "es-VE";
const SENTINEL_REGION = "VE";

jest.mock("@/components/thinking-orb/thinking-orb", () => ({ ThinkingOrb: () => null }));
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
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

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

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => dbHolder.current,
    useLocalData: () => mockTestLocalData({ db: dbHolder.current }),
}));

const mockUseTransactionEnrichment = jest.fn((..._args: unknown[]) => ({
    lookupNow: () => Promise.resolve(),
    onNameChange: () => {},
    pending: false,
}));

jest.mock<Partial<typeof import("@/hooks/use-transaction-enrichment")>>("@/hooks/use-transaction-enrichment", () => ({
    useTransactionEnrichment: (...args: unknown[]) => mockUseTransactionEnrichment(...args),
}));

jest.mock<Partial<typeof import("@/hooks/use-locale-tag")>>("@/hooks/use-locale-tag", () => ({
    useLocaleTag: () => SENTINEL_LOCALE,
}));

jest.mock<Partial<typeof import("@/hooks/use-region-code")>>("@/hooks/use-region-code", () => ({
    useRegionCode: () => SENTINEL_REGION,
}));

const mockFetchMerchantImage = jest.fn((..._args: unknown[]) => Promise.resolve({ kind: "none" as const }));

jest.mock<Partial<typeof import("@/lib/logo-fetch")>>("@/lib/logo-fetch", () => ({
    fetchMerchantImage: (...args: unknown[]) => mockFetchMerchantImage(...args),
}));

function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AppSettingsProvider>
            <IdentityDraftProvider>{children}</IdentityDraftProvider>
        </AppSettingsProvider>
    );
}

beforeEach(() => {
    dbHolder.current = migratedDatabase();
    mockUseTransactionEnrichment.mockClear();
    mockFetchMerchantImage.mockClear();
});

function latestOnSuggest(): (suggestion: EnrichmentSuggestion) => void {
    const { calls } = mockUseTransactionEnrichment.mock;
    const args = calls.at(-1)?.[0] as {
        onSuggest: (suggestion: EnrichmentSuggestion) => void;
    };
    return args.onSuggest;
}

describe("transactionForm enrichment locale wiring", () => {
    it("passes the device locale from useLocaleTag, not useLanguage, into useTransactionEnrichment", async () => {
        const db = dbHolder.current as Database;
        await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(mockUseTransactionEnrichment).toHaveBeenCalledWith(expect.objectContaining({ locale: SENTINEL_LOCALE }));
    });
});

describe("transactionForm regionCode wiring", () => {
    it("passes the device region from useRegionCode into useTransactionEnrichment", async () => {
        const db = dbHolder.current as Database;
        await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(mockUseTransactionEnrichment).toHaveBeenCalledWith(
            expect.objectContaining({ regionCode: SENTINEL_REGION })
        );
    });
});

describe("transactionForm groundedLookup wiring", () => {
    it("passes the groundedLookup setting into useTransactionEnrichment", async () => {
        const db = dbHolder.current as Database;
        await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        expect(mockUseTransactionEnrichment).toHaveBeenCalledWith(expect.objectContaining({ groundedLookup: true }));
    });
});

describe("transactionForm merchant logo wiring", () => {
    it("passes a remote suggestion's domain into fetchMerchantImage", async () => {
        const db = dbHolder.current as Database;
        await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            latestOnSuggest()({
                categoryId: null,
                domain: "example.com",
                pendingCategory: null,
                pendingTagNames: [],
                source: "remote",
                tagIds: [],
            });
        });

        expect(mockFetchMerchantImage).toHaveBeenCalledWith(expect.objectContaining({ domain: "example.com" }));
    });

    it("fetches nothing for a curated suggestion with no domain", async () => {
        const db = dbHolder.current as Database;
        await render(
            <Providers>
                <TransactionForm db={db} mode="create" onDone={() => {}} />
            </Providers>
        );

        await act(async () => {
            latestOnSuggest()({
                categoryId: null,
                domain: null,
                pendingCategory: null,
                pendingTagNames: [],
                source: "curated",
                tagIds: [],
            });
        });

        expect(mockFetchMerchantImage).not.toHaveBeenCalled();
    });
});

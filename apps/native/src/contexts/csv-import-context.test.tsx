import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppSettingsProvider } from "@/contexts/display-settings-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";
import { importDraftStore } from "@/lib/import-draft-store";

import { CsvImportProvider, useCsvImportContext } from "./csv-import-context";

jest.mock<Partial<typeof import("@react-native-async-storage/async-storage")>>(
    "@react-native-async-storage/async-storage",
    () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock<Partial<typeof import("expo-sqlite")>>("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));

const dbHolder: { current: Database | null } = { current: null };

jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => dbHolder.current,
    useLocalData: () => mockTestLocalData({ db: dbHolder.current }),
}));

beforeEach(() => {
    dbHolder.current = migratedDatabase();
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

describe("csvImportProvider", () => {
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
});

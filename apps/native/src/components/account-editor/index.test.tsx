import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import { testAppSettings as mockTestAppSettings } from "@/contexts/test-settings";
import { getAccountById } from "@/data/accounts-core";
import { invalidate } from "@/data/table-invalidation";
import { DeferredDeleteProvider } from "@/data/use-deferred-delete";
import type { Database } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import type { AccountEditorDetailsSection } from "./details-section";
import AccountEditor from "./index";

const mockDb: { current: Database | null } = { current: null };

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock("expo-router", () => require("../../../jest/expo-router-stub"));
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useAppSettings: () => mockTestAppSettings(),
}));
jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => mockDb.current,
    useLocalData: () => mockTestLocalData({ db: mockDb.current }),
}));
jest.mock("@expo/ui/swift-ui", () => {
    const { useRef } = require("react") as typeof import("react");
    return {
        ...jest.requireActual<typeof import("@expo/ui/swift-ui")>("@expo/ui/swift-ui"),
        useNativeState: <T,>(initial: T) => useRef({ value: initial }).current,
    };
});
jest.mock("./details-section", () => {
    const { Pressable } = require("react-native") as typeof import("react-native");
    return {
        AccountEditorDetailsSection: ({ onToggleSign }: Parameters<typeof AccountEditorDetailsSection>[0]) => (
            <Pressable accessibilityLabel="sign" onPress={onToggleSign} />
        ),
    };
});

const OPENED = new Date(2026, 5, 1, 17, 58).getTime();
const CHARGED = new Date(2026, 5, 1, 18, 0);
const SAVED = new Date(2026, 5, 1, 18, 5).getTime();
const MORNING = new Date(2026, 5, 1, 9, 0);

async function addExpense(db: Database, id: string, amount: number, date: Date): Promise<void> {
    await db.insert(transactions).values({
        accountId: "checking",
        amount,
        amountUsd: amount,
        currency: "USD",
        date,
        day: date,
        id,
        income: false,
        month: date,
        note: id,
        updatedAt: date,
    });
}

describe("restating an account's balance", () => {
    let db: Database;

    beforeEach(async () => {
        db = migratedDatabase();
        mockDb.current = db;
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: MORNING,
            id: "checking",
            initialBalance: 100,
            initialBalanceDate: MORNING,
            name: "Checking",
            updatedAt: MORNING,
        });
        await addExpense(db, "coffee", 10, MORNING);
        await addExpense(db, "rent", 7, CHARGED);
        jest.spyOn(Date, "now").mockReturnValue(OPENED);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("derives the opening at the moment the shown balance was read, not when it is saved", async () => {
        await render(
            <DeferredDeleteProvider>
                <IdentityDraftProvider>
                    <AccountEditor id="checking" mode="edit" />
                </IdentityDraftProvider>
            </DeferredDeleteProvider>
        );
        jest.spyOn(Date, "now").mockReturnValue(SAVED);
        await act(async () => {
            invalidate("transactions");
        });

        await fireEvent.press(screen.getByLabelText("sign"));
        await fireEvent.press(screen.getByText("accounts.saveAccount"));

        await waitFor(() => expect(getAccountById(db, "checking")?.initialBalance).toBe(-80));
    });
});

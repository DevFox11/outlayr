import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { IdentityDraftProvider } from "@/contexts/identity-draft-context";
import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import { testAppSettings as mockTestAppSettings } from "@/contexts/test-settings";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import AccountEditor from "./index.android";

const mockDb: { current: Database | null } = { current: null };
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRequestDelete = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => ({ back: mockBack, push: mockPush }),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock("@/theme/use-material-colors", () => ({
    useMaterialColors: () => new Proxy({}, { get: () => "#336699" }),
}));
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
jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ requestDelete: mockRequestDelete }),
}));
// The sheet header's Android sibling is the one with buttons in it; the plain
// file renders nothing because iOS keeps its native toolbar.
jest.mock("@/components/sheet-header", () => jest.requireActual("@/components/sheet-header.android"));
// The Compose switch has no jest runtime: an RN stand-in with the same contract.
jest.mock("@/components/material/switch-row", () => {
    const { Pressable } = require("react-native") as typeof import("react-native");
    return {
        SwitchRow: ({ label, value, onChange }: import("@/components/material/switch-row").SwitchRowProps) => (
            <Pressable
                accessibilityLabel={label}
                accessibilityRole="switch"
                accessibilityState={{ checked: value }}
                onPress={() => onChange(!value)}
            />
        ),
    };
});

const NOW = new Date(2026, 9, 15, 9, 0);

function renderEditor(props: Parameters<typeof AccountEditor>[0]) {
    return render(
        <IdentityDraftProvider>
            <AccountEditor {...props} />
        </IdentityDraftProvider>
    );
}

const save = () => screen.getByRole("button", { name: "common.save" });

beforeEach(() => {
    mockDb.current = migratedDatabase();
    mockBack.mockClear();
    mockPush.mockClear();
    mockRequestDelete.mockClear();
});

describe("android account editor", () => {
    it("keeps Save disabled until the account has a name", async () => {
        await renderEditor({ mode: "create" });
        expect(save()).toBeDisabled();

        await act(async () => {
            fireEvent.changeText(screen.getByLabelText("accounts.field.name"), "Chase");
        });
        expect(save()).toBeEnabled();
    });

    it("creates the account as money owed and closes the sheet", async () => {
        await renderEditor({ mode: "create" });
        await act(async () => {
            fireEvent.changeText(screen.getByLabelText("accounts.field.name"), "Visa");
        });
        await act(async () => {
            fireEvent.press(screen.getByRole("switch", { name: "accounts.field.kind" }));
        });
        await act(async () => {
            fireEvent.press(save());
        });

        await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
        const rows = await (mockDb.current as Database).select().from(accounts);
        expect(rows.map(({ name, kind }) => ({ kind, name }))).toStrictEqual([{ kind: "liability", name: "Visa" }]);
    });

    it("defers the delete behind the undo toast and closes the sheet", async () => {
        await (mockDb.current as Database).insert(accounts).values({
            currency: "USD",
            dateCreated: NOW,
            id: "checking",
            initialBalance: 0,
            initialBalanceDate: NOW,
            name: "Checking",
            updatedAt: NOW,
        });
        await renderEditor({ id: "checking", mode: "edit" });

        await act(async () => {
            fireEvent.press(screen.getByRole("button", { name: "common.delete" }));
        });

        expect(mockRequestDelete).toHaveBeenCalledWith("checking", "accounts.undo.body");
        expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("stands its header and tile down while the identity picker is open", async () => {
        await renderEditor({ mode: "create" });
        await act(async () => {
            fireEvent.changeText(screen.getByLabelText("accounts.field.name"), "Chase");
        });
        const tile = screen.getByLabelText("transaction.identity.hero.logo");

        await act(async () => {
            fireEvent.press(tile);
        });
        expect(mockPush).toHaveBeenCalledWith("/transactions/identity");
        expect(save()).toBeDisabled();

        await act(async () => {
            fireEvent.press(tile);
        });
        expect(mockPush).toHaveBeenCalledTimes(1);
    });
});

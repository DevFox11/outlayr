import { render } from "@testing-library/react-native";

import { Sync } from "./sync";

let mockAccountId: string | null = null;
let mockCloudConfigured = false;
let mockSyncEnabled = false;

jest.mock("@/components/mono-label", () => {
    const { Text } = require("react-native");
    return { MonoLabel: ({ children }: { children: string }) => <Text>{children}</Text> };
});
jest.mock("@/components/settings/account-row", () => {
    const { Text } = require("react-native");
    return { AccountRow: () => <Text>account-row</Text> };
});
jest.mock("@/components/settings/settings-row", () => {
    const { Text } = require("react-native");
    return {
        LinkRow: ({ title, value }: { title: string; value?: string }) => <Text>{`${title}:${value ?? ""}`}</Text>,
        SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
            <>
                <Text>{title}</Text>
                {children}
            </>
        ),
        ToggleRow: ({ title }: { title: string }) => <Text>{title}</Text>,
    };
});
jest.mock("@/components/settings/settings-screen", () => ({
    SettingsScreen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/text", () => {
    const { Text } = require("react-native");
    return { Text };
});
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { use24Hour: false } }),
}));
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => ({}) }));
jest.mock("@/data/ledger-adoption", () => ({ runAdoption: jest.fn() }));
jest.mock("@/data/live-query", () => ({ useLiveQuery: () => [{ value: mockSyncEnabled ? "1" : "0" }] }));
jest.mock("@/data/sync-outbox-core", () => ({ setSyncEnabled: jest.fn() }));
jest.mock("@/data/use-sync-status", () => ({
    useSyncStatus: () => ({ pending: 9, syncedAt: new Date(1_700_000_000_000) }),
}));
jest.mock("@/db/schema", () => ({ appMeta: {} }));
jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
jest.mock("@/lib/adoption-engine", () => ({ adoptionEngine: () => null }));
jest.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ accountId: mockAccountId }) }));
jest.mock("@/lib/cloud-runtime", () => ({
    get cloudRuntime() {
        return mockCloudConfigured ? {} : null;
    },
}));
jest.mock("@/lib/ledger-adoption", () => ({ useLedgerAdoption: () => ({ status: "settled" }) }));

describe("sync capability UI", () => {
    beforeEach(() => {
        mockAccountId = null;
        mockCloudConfigured = false;
        mockSyncEnabled = false;
    });

    it("unconfigured-sync-adoption-photo-status-is-unavailable-without-account", async () => {
        const { getByText, queryByText } = await render(<Sync />);

        expect(getByText("settings.account.unavailable")).toBeTruthy();
        expect(queryByText("settings.sync.statusSection")).toBeNull();
    });

    it("same-account-sync-off-offers-enable", async () => {
        mockAccountId = "account-a";
        mockCloudConfigured = true;
        const { getByText, queryByText } = await render(<Sync />);

        expect(getByText("settings.sync.toggle")).toBeTruthy();
        expect(queryByText("settings.sync.statusSection")).toBeNull();
    });
});

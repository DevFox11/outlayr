import { beforeEach, describe, expect, it, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { testLocalData as mockTestLocalData } from "@/contexts/test-local-data";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { Account } from "./account";

const mockRunAccountLifecycle = jest.fn<typeof import("@/lib/account-lifecycle").runAccountLifecycle>();
const mockRecoverDeviceReset = jest.fn<typeof import("@/lib/device-data-reset").recoverDeviceReset>();
jest.mock("@/lib/account-lifecycle", () => ({
    resumeCloudDeletion: jest.fn<typeof import("@/lib/account-lifecycle").resumeCloudDeletion>(),
    runAccountLifecycle: (...args: Parameters<typeof mockRunAccountLifecycle>) => mockRunAccountLifecycle(...args),
}));
jest.mock("@/lib/device-data-reset", () => ({
    createDeviceResetGate: () => ({ recover: mockRecoverDeviceReset }),
    writeDeviceResetMarker: jest.fn<typeof import("@/lib/device-data-reset").writeDeviceResetMarker>(),
}));
jest.mock("@/db/client", () => ({ closeDatabase: jest.fn() }));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
    useLocalData: () => mockTestLocalData({ retry: jest.fn() }),
}));

interface StubButtonsProps {
    busy: string | null;
    start: (provider: string, getToken: () => Promise<string | null>) => void;
}

jest.mock("@/components/account/provider-sign-in-buttons", () => {
    const { Pressable, Text } = require("react-native");
    return {
        ProviderSignInButtons: ({ busy, start }: StubButtonsProps) => (
            <Pressable
                onPress={() => start("apple", () => Promise.resolve("token"))}
                testID="provider-sign-in-buttons-stub"
            >
                <Text>{busy ?? "idle"}</Text>
            </Pressable>
        ),
    };
});

jest.mock("expo-router", () => ({
    router: {
        back: jest.fn(),
        canDismiss: jest.fn(),
        dismiss: jest.fn(),
        dismissAll: jest.fn(),
        navigate: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
        setParams: jest.fn(),
    },
}));

const mockUseSession = jest.fn();
const mockClient = {
    deleteUser: jest.fn(),
    signOut: jest.fn(),
    useSession: mockUseSession,
};
jest.mock("@/lib/auth-client", () => ({
    get authClient() {
        return mockClient;
    },
}));

jest.mock("@/lib/auth-session", () => ({
    useAuthSession: () => ({ accountId: "session-user" }),
}));

jest.mock<Partial<typeof import("@/lib/convex")>>("@/lib/convex", () => ({ convex: null }));

const mockUseProviderSignIn = jest.fn();
jest.mock("@/lib/use-provider-sign-in", () => ({
    useProviderSignIn: (...args: unknown[]) => mockUseProviderSignIn(...args),
}));

const routerSpy = jest.mocked(jest.requireMock<typeof import("expo-router")>("expo-router").router);

function calledRouterMethods(): string[] {
    return Object.entries(routerSpy)
        .filter(([, method]) => method.mock.calls.length > 0)
        .map(([name]) => name);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockRunAccountLifecycle.mockReset();
    mockRunAccountLifecycle.mockResolvedValue(undefined);
    mockRecoverDeviceReset.mockResolvedValue({ failures: [] });
    mockUseProviderSignIn.mockReturnValue({
        busy: null,
        error: null,
        start: jest.fn(),
    });
});

describe("account — restoring", () => {
    it("shows only the checking title, no detail, no button", async () => {
        mockUseSession.mockReturnValue({ data: undefined, isPending: true });
        const { getByText, queryAllByRole, queryByTestId, queryByText } = await render(<Account />);
        expect(getByText("settings.account.checking")).toBeTruthy();
        expect(queryByText("settings.account.signedOutDetail")).toBeNull();
        expect(queryAllByRole("button")).toHaveLength(0);
        expect(queryByTestId("provider-sign-in-buttons-stub")).toBeNull();
        expect(calledRouterMethods()).toStrictEqual([]);
    });
});

describe("account — signed-out", () => {
    beforeEach(() => {
        mockUseSession.mockReturnValue({ data: undefined, isPending: false });
    });

    it("shows notSignedIn, signedOutDetail and the sign-in controls", async () => {
        const { getByText, getByTestId } = await render(<Account />);
        expect(getByText("settings.account.notSignedIn")).toBeTruthy();
        expect(getByText("settings.account.signedOutDetail")).toBeTruthy();
        expect(getByText("settings.account.signInSection")).toBeTruthy();
        expect(getByText("settings.account.signInFooter")).toBeTruthy();
        expect(getByTestId("provider-sign-in-buttons-stub")).toBeTruthy();
        expect(calledRouterMethods()).toStrictEqual([]);
    });

    it("renders Failure with the mapped message on a rejected sign-in", async () => {
        mockUseProviderSignIn.mockReturnValue({
            busy: null,
            error: "settings.account.genericFailure",
            start: jest.fn(),
        });
        const { getByText } = await render(<Account />);
        expect(getByText("settings.account.genericFailure")).toBeTruthy();
        expect(calledRouterMethods()).toStrictEqual([]);
    });

    it("wires the stub's press through to useProviderSignIn's start", async () => {
        const start = jest.fn();
        mockUseProviderSignIn.mockReturnValue({ busy: null, error: null, start });
        const { getByTestId } = await render(<Account />);
        fireEvent.press(getByTestId("provider-sign-in-buttons-stub"));
        expect(start).toHaveBeenCalledWith("apple", expect.any(Function));
        expect(calledRouterMethods()).toStrictEqual([]);
    });
});

describe("account — signed-in", () => {
    it("shows the label plus sign-out and delete rows, no sign-in controls", async () => {
        mockUseSession.mockReturnValue({
            data: { user: { email: "jane@example.com", name: "Jane" } },
            isPending: false,
        });
        const { getByText, getByRole, queryByTestId, queryAllByRole } = await render(<Account />);
        expect(getByText("settings.account.signedInAs")).toBeTruthy();
        expect(getByText("Jane")).toBeTruthy();
        expect(getByRole("button", { name: "settings.account.signOut" })).toBeTruthy();
        expect(getByRole("button", { name: "settings.account.delete" })).toBeTruthy();
        expect(queryByTestId("provider-sign-in-buttons-stub")).toBeNull();
        expect(queryAllByRole("button")).toHaveLength(3);
        expect(calledRouterMethods()).toStrictEqual([]);
    });
});

test("runs full-device deletion once only after its destructive confirmation", async () => {
    mockUseSession.mockReturnValue({
        data: { user: { email: "jane@example.com", name: "Jane" } },
        isPending: false,
    });
    const alert = jest.spyOn(require("react-native").Alert, "alert");
    const { getByRole } = await render(<Account />);
    fireEvent.press(getByRole("button", { name: "settings.account.eraseDevice" }));
    const actions = alert.mock.calls[0]?.[2] as { onPress?: () => void }[];
    actions[1]?.onPress?.();

    expect(mockRunAccountLifecycle).toHaveBeenCalledTimes(1);
    expect(mockRunAccountLifecycle).toHaveBeenCalledWith("deleteAll", expect.any(Object));
});

test("keeps cloud-only deletion on its separate lifecycle action", async () => {
    mockUseSession.mockReturnValue({
        data: { user: { email: "jane@example.com", name: "Jane" } },
        isPending: false,
    });
    const alert = jest.spyOn(require("react-native").Alert, "alert");
    const { getByRole } = await render(<Account />);
    fireEvent.press(getByRole("button", { name: "settings.account.delete" }));
    const actions = alert.mock.calls[0]?.[2] as { onPress?: () => void }[];
    actions[1]?.onPress?.();

    expect(mockRunAccountLifecycle).toHaveBeenCalledWith("deleteCloud", expect.any(Object));
});

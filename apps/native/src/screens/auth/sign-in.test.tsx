import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { testAppSettings as mockTestAppSettings } from "@/contexts/test-settings";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { SignIn } from "./sign-in";

jest.mock<Partial<typeof import("@react-native-async-storage/async-storage")>>(
    "@react-native-async-storage/async-storage",
    () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@/lib/auth-client", () => ({ authClient: {} }));

jest.mock<Partial<typeof import("@/lib/google-sign-in")>>("@/lib/google-sign-in", () => ({
    googleIdToken: jest.fn<typeof import("@/lib/google-sign-in").googleIdToken>(),
    isGoogleSignInAvailable: false,
}));

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ background: "#F2F0EA" }),
}));

jest.mock("@/lib/use-provider-sign-in", () => ({
    useProviderSignIn: () => ({
        busy: null,
        error: "settings.account.genericFailure",
        start: jest.fn(),
    }),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useAppSettings: () => mockTestAppSettings({ number: () => 0 }),
}));

jest.mock<Partial<typeof import("@/data/app-meta")>>("@/data/app-meta", () => ({ useGlobalCurrency: () => "USD" }));

jest.mock("@/data/onboarding", () => ({
    deferAccount: jest.fn(),
    useReminderChosen: () => false,
}));

describe("sign-in screen", () => {
    it("routes a rejected sign-in into FirstRun's error slot, not the button component", async () => {
        const { getByRole, getByText } = await render(<SignIn />);
        const alert = getByRole("alert");
        expect(alert.props.children).toBe("settings.account.genericFailure");
        expect(getByText("settings.account.genericFailure")).toBeTruthy();
    });
});

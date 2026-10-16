import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AiConsent } from "@/data/settings-core";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";
import type { AuthGate } from "@/domain/auth-gate";

import { AiConsentGate, AiConsentSheet } from "./ai-consent";

interface SheetProps {
    onOpenChange: (next: boolean) => void;
    open: boolean;
}

/** What the last render handed the sheet. */
let mockSheet: SheetProps | null = null;

// The sheet presents through a native host that renders to nothing here.
jest.mock("panelui-native", () => {
    const react = require("react") as typeof import("react");
    const actual = jest.requireActual("panelui-native") as typeof import("panelui-native");
    const Content = ({ children }: { children?: ReactNode }) => children;
    const Root = ({ children, ...props }: SheetProps & { children?: ReactNode }) => {
        mockSheet = props;
        return react.createElement(react.Fragment, null, children);
    };
    return { ...actual, BottomSheet: Object.assign(Root, { Content }) };
});

const mockBack = jest.fn();
let mockSegment = "(tabs)";
jest.mock("expo-router", () => ({
    useRouter: () => ({ back: mockBack }),
    useSegments: () => [mockSegment],
}));

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

jest.mock("react-native-safe-area-context", () => {
    const react = require("react") as typeof import("react");
    const insets = { bottom: 0, left: 0, right: 0, top: 0 };
    return {
        SafeAreaInsetsContext: react.createContext(insets),
        useSafeAreaInsets: () => insets,
    };
});

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock("@/components/app-lock-gate", () => ({ useAppLockOpen: () => true }));
jest.mock("@/components/auth-cover", () => ({ useAuthCovered: () => false }));

let mockGate: AuthGate = "signed-in";
jest.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ gate: mockGate }) }));

let mockConsent: AiConsent = "unanswered";
jest.mock("@/data/settings", () => ({ useAiConsent: () => mockConsent }));

const mockSetBoolSetting = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock<Partial<typeof import("@/data/settings-core")>>("@/data/settings-core", () => ({
    setBoolSetting: (...args: unknown[]) => mockSetBoolSetting(...args),
}));

beforeEach(() => {
    mockBack.mockClear();
    mockSetBoolSetting.mockClear();
    mockSegment = "(tabs)";
    mockGate = "signed-in";
    mockConsent = "unanswered";
    mockSheet = null;
});

describe("aiConsentSheet", () => {
    it.each([
        { consent: "unanswered", expected: true, gate: "signed-in", segment: "(tabs)" },
        { consent: "declined", expected: false, gate: "signed-in", segment: "(tabs)" },
        { consent: "allowed", expected: false, gate: "signed-in", segment: "(tabs)" },
        { consent: "unanswered", expected: false, gate: "signed-out", segment: "(tabs)" },
        { consent: "unanswered", expected: false, gate: "signed-in", segment: "transactions" },
    ] as const)("opens $expected for $consent, $gate, on $segment", async ({ consent, expected, gate, segment }) => {
        mockConsent = consent;
        mockGate = gate;
        mockSegment = segment;

        await render(<AiConsentSheet />);

        expect(mockSheet?.open).toBe(expected);
    });

    it("records a swipe away as Not now, and not a close the answer caused", async () => {
        const tree = await render(<AiConsentSheet />);
        mockSheet?.onOpenChange(false);
        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "aiConsent", false);

        mockSetBoolSetting.mockClear();
        mockConsent = "allowed";
        await tree.rerender(<AiConsentSheet />);
        mockSheet?.onOpenChange(false);

        expect(mockSetBoolSetting).not.toHaveBeenCalled();
    });
});

describe("aiConsentGate", () => {
    it("records Allow and stays, so the screen behind it can start", async () => {
        const { getByText } = await render(<AiConsentGate />);

        fireEvent.press(getByText("aiConsent.allow"));

        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "aiConsent", true);
        expect(mockBack).not.toHaveBeenCalled();
    });

    it("records Not now and leaves the screen", async () => {
        const { getByText } = await render(<AiConsentGate />);

        fireEvent.press(getByText("aiConsent.notNow"));

        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "aiConsent", false);
        expect(mockBack).toHaveBeenCalledTimes(1);
    });
});

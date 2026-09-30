import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import type { Account } from "@/data/accounts-core";
import type { SavedTransfer } from "@/data/transfers-core";
import { testColors as mockTestColors } from "@/theme/test-colors";

import TransferEditor from "./index";

const mockAccounts = [
    { currency: "USD", id: "usd", initialBalance: 0, name: "Zinli" } as Account,
    { currency: "USD", id: "usd-2", initialBalance: 0, name: "Mercantil" } as Account,
];
const mockNumberEntryType = jest.fn<() => number>(() => 1);

jest.mock("@/data/accounts", () => ({
    useAccountBalance: () => ({ total: 500 }),
    useAccounts: () => mockAccounts,
}));
jest.mock("@/data/transfer-rates", () => ({ useTransferRates: () => ({}) }));
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => ({}) }));
jest.mock("@/contexts/display-settings-context", () => ({
    useSettingNumber: () => mockNumberEntryType(),
}));
jest.mock("@/hooks/use-pro-gate", () => ({ useAccountCreateRoute: () => "/accounts/create" }));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<Partial<typeof import("expo-router")>>("expo-router", () => require("../../../jest/expo-router-stub"));
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("number-flow-react-native", () => {
    const react = require("react") as typeof import("react");
    return {
        NumberFlow: (props: Record<string, unknown>) => react.createElement("NumberFlow", props),
    };
});
jest.mock("@/i18n/context", () => {
    const catalog = require("@/i18n/catalog") as typeof import("@/i18n/catalog");
    return {
        useLanguage: () => ({ language: "en" }),
        useTranslation: () => (key: string, params?: Record<string, unknown>) => {
            const template = /^transfers\.(a11y|sentence)\.(?!blank)/.test(key) ? catalog.EN[key] : undefined;
            return template === undefined
                ? key
                : template.replaceAll(/\{(\w+)\}/g, (match, name: string) =>
                      params && name in params ? String(params[name]) : match
                  );
        },
    };
});

const SENT = "transfers.field.sent";

const SAVED: SavedTransfer = {
    arrived: 100,
    date: new Date(2026, 8, 1),
    fee: 0,
    feeSide: "source",
    fromAccountId: "usd",
    fromCurrency: "USD",
    id: "transfer",
    note: "",
    rate: 1,
    rateType: null,
    sent: 100,
    toAccountId: "usd-2",
    toCurrency: "USD",
};

async function press(label: string): Promise<void> {
    await act(async () => {
        fireEvent(screen.getByLabelText(label), "click");
    });
}

const slotValue = (label: string) => screen.getByLabelText(label).props.accessibilityValue?.text;

beforeEach(() => {
    mockNumberEntryType.mockReturnValue(1);
});

describe("transfer editor keypad", () => {
    beforeEach(() => {
        mockNumberEntryType.mockReturnValue(2);
    });

    it("replaces the amount when 0 is the first key on a pre-dotted pad", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        await press("0");
        await press("5");
        await press("0");

        expect(slotValue(SENT)).toBe("$0.50");
    });

    it("ends empty when a first digit and a backspace land in one render", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        const digit = screen.getByLabelText("5");
        const backspace = screen.getByLabelText("transaction.numpad.delete");

        await act(async () => {
            digit.props.onClick();
            backspace.props.onClick();
        });

        expect(slotValue(SENT)).not.toContain("$");
    });

    it("trims the last digit when backspace is the first key on a pre-dotted pad", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        await press("transaction.numpad.delete");

        expect(slotValue(SENT)).toBe("$10.00");
    });

    it("clears the amount when a long press is the first key", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        await act(async () => {
            fireEvent(screen.getByLabelText("transaction.numpad.delete"), "longPress");
        });

        expect(slotValue(SENT)).not.toContain("$");
    });

    it("trims the last digit when backspace is the first key", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        await press("transaction.numpad.delete");

        expect(slotValue(SENT)).toBe("$10.00");
    });
});

describe("transfer editor balances", () => {
    it("shows the current balance alone once an edit has no amount", async () => {
        await render(<TransferEditor onDone={jest.fn()} saved={SAVED} />);

        await press("1");
        await press("transaction.numpad.delete");

        expect(screen.getAllByText("$500.00")).toHaveLength(2);
    });
});

describe("transfer editor accessibility", () => {
    it("names the note once, by its placeholder while empty and by its label after", async () => {
        await render(<TransferEditor onDone={jest.fn()} />);
        const note = () => screen.getByPlaceholderText("transfers.field.note");
        expect(note().props.accessibilityLabel).toBeUndefined();

        await act(async () => {
            fireEvent.changeText(note(), "rent");
        });

        expect(note().props.accessibilityLabel).toBe("transfers.field.note");
    });

    it("reads each balance line as one element", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }} />
        );

        expect(screen.getByLabelText("Zinli, $500.00, then $400.00").props.accessible).toBe(true);
        expect(screen.getByLabelText("Mercantil, $500.00, then $600.00").props.accessible).toBe(true);
    });

    it("announces the field a refused save is missing", async () => {
        const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
        await render(<TransferEditor onDone={jest.fn()} />);

        await press("common.next");

        expect(announce).toHaveBeenCalledWith("Missing: transfers.field.sent");
    });
});

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";
import { AccessibilityInfo, DeviceEventEmitter } from "react-native";

import type { Account } from "@/data/accounts-core";
import type { SavedTransfer, TransferInput } from "@/data/transfers-core";
import { testColors as mockTestColors } from "@/theme/test-colors";

import TransferEditor from "./index";

const mockAccounts = [
    { currency: "USD", id: "usd", initialBalance: 0, name: "Zinli" } as Account,
    { currency: "USD", id: "usd-2", initialBalance: 0, name: "Mercantil" } as Account,
    { currency: "VES", id: "ves", initialBalance: 0, name: "Banesco" } as Account,
    { currency: "ARS", id: "ars", initialBalance: 0, name: "Galicia" } as Account,
    { currency: "MXN", id: "mxn", initialBalance: 0, name: "BBVA" } as Account,
];
const mockRateTables = jest.fn<typeof import("@/data/transfer-rates").useTransferRates>(() => ({}));
const mockPriorRate = jest.fn<typeof import("@/data/transfer-rates").usePriorCustomRate>(() => null);
const mockNumberEntryType = jest.fn<() => number>(() => 1);
const mockCreate = jest.fn<(db: unknown, input: TransferInput) => Promise<string>>();
const mockUpdate = jest.fn<(db: unknown, id: string, input: TransferInput) => Promise<void>>();
const mockPush = jest.fn();
const mockNotifySaved = jest.fn<typeof import("@/lib/notify").notifySaved>();

jest.mock("@/data/accounts", () => ({
    useAccountBalance: () => ({ total: 500 }),
    useAccounts: () => mockAccounts,
}));
jest.mock<typeof import("@/data/transfer-rates")>("@/data/transfer-rates", () => ({
    ...jest.requireActual<typeof import("@/data/transfer-rates")>("@/data/transfer-rates"),
    usePriorCustomRate: (...args) => mockPriorRate(...args),
    useTransferRates: (...args) => mockRateTables(...args),
}));
jest.mock("@/data/transfers-core", () => ({
    lastTransfer: () => null,
    transfersRepo: {
        create: (db: unknown, input: TransferInput) => mockCreate(db, input),
        update: (db: unknown, id: string, input: TransferInput) => mockUpdate(db, id, input),
    },
}));
jest.mock<Partial<typeof import("@/lib/notify")>>("@/lib/notify", () => ({
    notifySaved: (notice) => mockNotifySaved(notice),
}));
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => ({}) }));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { use24Hour: true } }),
    useSettingNumber: () => mockNumberEntryType(),
}));
jest.mock("@/hooks/use-pro-gate", () => ({ useAccountCreateRoute: () => "/accounts/create" }));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<Partial<typeof import("expo-router")>>("expo-router", () => ({
    ...require("../../../jest/expo-router-stub"),
    useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));
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
    const { translate } = require("@/i18n/translate") as typeof import("@/i18n/translate");
    return {
        useLanguage: () => ({ language: "en" }),
        useTranslation: () => (key: string, params?: Record<string, string | number>) =>
            /^(transfers\.(a11y|gap|rate|saved\.title|sentence)(?!\.blank)|transaction\.(rate|sentence\.rateSource)\.)/.test(
                key
            )
                ? translate(key, { catalog: catalog.EN, fallback: catalog.EN, params })
                : key,
    };
});

const SENT = "transfers.field.sent";
const SEED = { amount: 100, fromAccountId: "usd", toAccountId: "usd-2" };

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

const CROSS = { amount: 50, date: new Date(2026, 8, 29, 12), fromAccountId: "usd", toAccountId: "ves" };
const quotedAt = (rate: number) => ({
    earliest: () => null,
    get: () => rate,
    source: () => ({ date: "2026-09-19", fetchedAt: 0 }),
});

const slotValue = (label: string) => screen.getByLabelText(label).props.accessibilityValue?.text;

beforeEach(() => {
    mockNumberEntryType.mockReturnValue(1);
    mockCreate.mockReset();
    mockCreate.mockResolvedValue("transfer");
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue();
    mockPush.mockReset();
    mockNotifySaved.mockReset();
    mockRateTables.mockReset();
    mockRateTables.mockReturnValue({});
    mockPriorRate.mockReset();
    mockPriorRate.mockReturnValue(null);
});

describe("transfer editor keypad", () => {
    beforeEach(() => {
        mockNumberEntryType.mockReturnValue(2);
    });

    it("replaces the amount when 0 is the first key on a pre-dotted pad", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);

        await press("0");
        await press("5");
        await press("0");

        expect(slotValue(SENT)).toBe("$0.50");
    });

    it("ends empty when a first digit and a backspace land in one render", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);

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

    it("puts Delete in the bar when the screen can delete", async () => {
        const onDelete = jest.fn();
        await render(
            <TransferEditor
                onDelete={onDelete}
                onDone={jest.fn()}
                seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }}
            />
        );

        screen.getByLabelText("transfers.delete.row").props.onButtonPress();

        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("reports an edit on the first key", async () => {
        const onDirtyChange = jest.fn();
        await render(
            <TransferEditor
                onDirtyChange={onDirtyChange}
                onDone={jest.fn()}
                seed={{ amount: 100, fromAccountId: "usd", toAccountId: "usd-2" }}
            />
        );
        expect(onDirtyChange).not.toHaveBeenCalled();

        await press("5");

        expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    it("trims the last digit when backspace is the first key", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);

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
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);

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

describe("transfer editor at rest", () => {
    const FEE = { ...SAVED, arrived: 98, fee: 2, note: "rent" };

    function Resting({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
        const [awake, setAwake] = useState(false);
        return (
            <TransferEditor
                onDirtyChange={onDirtyChange}
                onDone={jest.fn()}
                rest={awake ? undefined : { onHeight: jest.fn(), onWake: () => setAwake(true) }}
                saved={FEE}
            />
        );
    }

    it("shows the sentence and a filled note without a keypad, balances or Save", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} rest={{ onHeight: jest.fn(), onWake: jest.fn() }} saved={FEE} />
        );

        expect(slotValue(SENT)).toBe("$100.00");
        expect(screen.getByDisplayValue("rent")).toBeTruthy();
        expect(screen.queryByLabelText("5")).toBeNull();
        expect(screen.queryByLabelText("Zinli, $500.00")).toBeNull();
        expect(screen.queryByText("transfers.save")).toBeNull();
    });

    it("hides an empty note", async () => {
        await render(
            <TransferEditor onDone={jest.fn()} rest={{ onHeight: jest.fn(), onWake: jest.fn() }} saved={SAVED} />
        );

        expect(screen.queryByPlaceholderText("transfers.field.note")).toBeNull();
    });

    it("wakes on a tapped word and opens that word's step", async () => {
        await render(<Resting />);
        expect(screen.queryByText("transfers.field.date")).toBeNull();

        await press("transfers.field.date");

        expect(screen.getByText("transfers.field.date")).toBeTruthy();
        expect(screen.getByText("transfers.save")).toBeTruthy();
    });

    it("only wakes when the fee's account is tapped, leaving the fee where it was", async () => {
        const onDirtyChange = jest.fn();
        await render(<Resting onDirtyChange={onDirtyChange} />);

        await press("transfers.field.feeSide");

        expect(screen.getByLabelText("5")).toBeTruthy();
        expect(slotValue("transfers.field.feeSide")).toBe("Zinli");
        expect(onDirtyChange).not.toHaveBeenCalled();
    });

    it("states a shortfall at rest without offering to resolve it there", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        await render(
            <TransferEditor
                onDone={jest.fn()}
                rest={{ onHeight: jest.fn(), onWake: jest.fn() }}
                saved={{
                    ...SAVED,
                    arrived: 42_427.5,
                    rate: 848.55,
                    rateType: "official",
                    toAccountId: "ves",
                    toCurrency: "VES",
                }}
            />
        );

        expect(screen.getByText(/less arrived/)).toBeTruthy();
        expect(screen.queryByText("It's a fee")).toBeNull();
    });

    it("reports its height so the sheet can fit it", async () => {
        const onHeight = jest.fn();
        await render(<TransferEditor onDone={jest.fn()} rest={{ onHeight, onWake: jest.fn() }} saved={FEE} />);

        await act(async () => {
            fireEvent(screen.getByLabelText("transfers.field.feeSide"), "contentSizeChange", 402, 96);
        });

        expect(onHeight).toHaveBeenLastCalledWith(96);
    });

    it("wakes when its note is focused", async () => {
        const onWake = jest.fn();
        await render(<TransferEditor onDone={jest.fn()} rest={{ onHeight: jest.fn(), onWake }} saved={FEE} />);

        await act(async () => {
            fireEvent(screen.getByDisplayValue("rent"), "focus");
        });

        expect(onWake).toHaveBeenCalledTimes(1);
    });
});

describe("transfer editor footer", () => {
    it("moves an incomplete draft to the missing step, flags it and does not save", async () => {
        await render(<TransferEditor onDone={jest.fn()} />);
        await press("transfers.field.date");
        expect(screen.queryByLabelText("1")).toBeNull();

        await press("common.next");

        expect(screen.getByLabelText("1")).toBeTruthy();
        const blank = within(screen.getByLabelText(SENT)).getByText("transfers.sentence.blank.amount");
        expect(blank.props.className).toContain("text-danger");
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("saves a same-currency transfer with its fee", async () => {
        const onDone = jest.fn();
        await render(<TransferEditor onDone={onDone} seed={SEED} />);
        await press("transfers.field.fee");
        await press("5");
        await press("0");
        await press("0");

        await press("transfers.save");

        expect(mockCreate).toHaveBeenCalledWith(expect.anything(), {
            date: expect.any(Date),
            exchangeRate: 1,
            exchangeRateType: null,
            fee: { amount: 5, note: "transfers.fee.note", side: "source" },
            fromAccountId: "usd",
            fromAmount: 95,
            fromCurrency: "USD",
            note: "",
            toAccountId: "usd-2",
            toAmount: 95,
            toCurrency: "USD",
        });
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("shows a failed save inline and takes the footer again", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        mockCreate.mockRejectedValueOnce(new Error("disk full"));
        const onDone = jest.fn();
        await render(<TransferEditor onDone={onDone} seed={SEED} />);

        await press("transfers.save");
        expect(screen.getByText("transfers.save.failed")).toBeTruthy();
        expect(onDone).not.toHaveBeenCalled();

        await press("transfers.save");
        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(onDone).toHaveBeenCalledTimes(1);
    });
});

describe("transfer editor saved notice", () => {
    it("states the move of a new transfer and offers another", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);

        await press("transfers.save");

        expect(mockNotifySaved).toHaveBeenCalledTimes(1);
        const [[notice]] = mockNotifySaved.mock.calls;
        expect(notice).toMatchObject({
            actionLabel: "transfers.saved.another",
            amount: { text: "$100.00" },
            stamp: "Transfer added",
            title: "Mercantil",
            tone: { ends: { from: { name: "Zinli" }, to: { name: "Mercantil" } }, kind: "transfer" },
        });
        notice.onActionPress?.({ hide: jest.fn(), id: "toast" });
        expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/create");
    });

    it("says nothing after an edit", async () => {
        const onDone = jest.fn();
        await render(<TransferEditor onDone={onDone} saved={SAVED} />);

        await press("transfers.save");

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(mockNotifySaved).not.toHaveBeenCalled();
    });
});

describe("transfer editor rate step", () => {
    beforeEach(() => {
        mockRateTables.mockReturnValue({ eur_reference: quotedAt(974.42), official: quotedAt(848.55) });
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 1020 });
    });

    it("lists each source with its figure, unit and age, and marks the one in force", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);

        await press("transfers.field.rateType");

        const rows = screen.getAllByRole("radio");
        expect(rows.map((row) => [row.props.accessibilityLabel, row.props.accessibilityValue.text])).toStrictEqual([
            ["USD (BCV)", "848.55 Bs. per $, 10 days old · 19 Sep"],
            ["EUR (BCV)", "974.42 Bs. per $, 10 days old · 19 Sep"],
            ["USDT (Binance)", "Unavailable, As of 29 Sep"],
            ["My rate", "Type, Last used 1,020.00 · 27 Sep"],
        ]);
        expect(rows.map((row) => row.props.accessibilityState.checked)).toStrictEqual([true, false, false, false]);
        const stale = screen.getAllByText("10 days old · 19 Sep");
        expect(stale).toHaveLength(2);
        expect(stale[0].props.className).toContain("text-warning-foreground");
        expect(screen.getByText("Last used 1,020.00 · 27 Sep")).toBeTruthy();
    });

    it("returns to the amount from Done without saving", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.rateType");
        expect(screen.queryByLabelText("transfers.save")).toBeNull();

        await press("common.done");

        expect(mockCreate).not.toHaveBeenCalled();
        expect(screen.queryAllByRole("radio")).toHaveLength(0);
        expect(screen.getByLabelText("common.next")).toBeTruthy();
    });

    it("applies the last used rate from My rate", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.rateType");

        await press("My rate");
        await press("common.back");
        await press("common.next");
        await press("transfers.save");

        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            exchangeRate: 1020,
            exchangeRateType: "custom",
            toAmount: 51_000,
        });
    });

    it("opens dollars to bolívares on the Binance rate and names it in the sentence", async () => {
        mockRateTables.mockReturnValue({
            binance: quotedAt(1031.52),
            eur_reference: quotedAt(974.42),
            official: quotedAt(848.55),
        });
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);

        expect(slotValue("transfers.field.rateType")).toBe("USDT (Binance)");
        await press("transfers.field.rateType");

        const checked = screen.getAllByRole("radio").find((row) => row.props.accessibilityState.checked);
        expect(checked?.props.accessibilityValue.text).toBe("1,031.52 Bs. per $, 10 days old · 19 Sep");
        expect(checked?.props.accessibilityLabel).toBe("USDT (Binance)");
    });

    it("books what Payoneer lost on the way to Binance as a dollar fee and saves it as my rate", async () => {
        mockRateTables.mockReturnValue({ binance: quotedAt(1031.52), official: quotedAt(848.55) });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, amount: 160 }} />);
        await press("transfers.field.arrives");
        for (const key of "15747166") {
            await press(key);
        }
        expect(screen.getByText("$7.34 less arrived")).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByText("It's a fee"));
        });

        expect(screen.queryByText(/ (less|more) arrived/)).toBeNull();
        expect(slotValue("transfers.field.fee")).toBe("$7.34");
        expect(slotValue("transfers.field.feeSide")).toBe("Zinli");
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            exchangeRateType: "custom",
            fee: { amount: 7.34, side: "source" },
            fromAmount: 152.66,
            toAmount: 157_471.66,
        });
    });

    it("keeps an arrival typed before USDT (Binance) is picked, and closes the loss as a fee", async () => {
        mockRateTables.mockReturnValue({ binance: quotedAt(1031.52), official: quotedAt(848.55) });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, amount: 160 }} />);
        await press("transfers.field.rateType");
        await press("USD (BCV)");
        await press("transfers.field.arrives");
        for (const key of "15747166") {
            await press(key);
        }
        await press("transfers.field.rateType");

        await press("USDT (Binance)");

        expect(slotValue("transfers.field.arrives")).toBe("Bs.157,471.66");
        expect(screen.getByText("$7.34 less arrived")).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText("It's a fee"));
        });
        expect(screen.queryByText(/ (less|more) arrived/)).toBeNull();
        expect(slotValue("transfers.field.arrives")).toBe("Bs.157,471.66");
    });

    it("lets an arrival opened but never typed follow the amount", async () => {
        mockNumberEntryType.mockReturnValue(2);
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.arrives");
        await press("common.back");

        await press("6");
        await press("0");

        expect(slotValue("transfers.field.arrives")).toBe("Bs.50,913.00");
    });

    it("opens the rate keypad from My rate", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.rateType");

        await press("My rate");

        expect(screen.getByText("My rate")).toBeTruthy();
        expect(screen.getByLabelText("1")).toBeTruthy();
    });
});

describe("transfer editor typed rate", () => {
    const reference = (name: string) => screen.getByRole("button", { name }).props.accessibilityValue?.text;

    beforeEach(() => {
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 1020 });
    });

    it("weighs a typed rate against USD (BCV) and offers it, USDT (Binance) and the last one used", async () => {
        mockRateTables.mockReturnValue({
            binance: quotedAt(1031.52),
            eur_reference: quotedAt(974.42),
            official: quotedAt(848.55),
        });
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.rate");

        for (const key of "900") {
            await press(key);
        }

        expect(screen.getByText("6.1% above USD (BCV) · Bs.2,572.50 more than at USD (BCV)")).toBeTruthy();
        expect(reference("USD (BCV)")).toBe("848.55");
        expect(reference("USDT (Binance)")).toBe("1,031.52");
        expect(reference("Last used · 27 Sep")).toBe("1,020.00");
        expect(screen.queryByRole("button", { name: "EUR (BCV)" })).toBeNull();
        expect(screen.getByLabelText("Use 900.00")).toBeTruthy();
    });

    it("offers no USDT (Binance) for dollars to pesos", async () => {
        mockRateTables.mockReturnValue({ binance: quotedAt(19.5), official: quotedAt(18.3) });
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 18.1 });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, toAccountId: "mxn" }} />);
        await press("transfers.field.rate");

        await press("1");
        await press("9");

        expect(screen.getByText(/^3\.8% above official · /)).toBeTruthy();
        expect(reference("Official")).toBe("18.30");
        expect(reference("Last used · 27 Sep")).toBe("18.10");
        expect(screen.queryByRole("button", { name: "USDT (Binance)" })).toBeNull();
    });

    it("says how far off a rate with a missed separator is", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(1523.4) });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, toAccountId: "ars" }} />);
        await press("transfers.field.rate");

        for (const key of "15984") {
            await press(key);
        }

        expect(screen.getByText(/^949\.2% above official · /)).toBeTruthy();
    });

    it("applies the last used rate at full precision, not the four decimals it shows", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 1020.123456 });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, amount: 10_000 }} />);
        await press("transfers.field.rate");

        await press("Last used · 27 Sep");

        expect(slotValue("transfers.field.rate")).toBe("1,020.1235 Bs. per $");
        expect(slotValue("transfers.field.arrives")).toBe("Bs.10,201,234.56");
    });

    it("applies My rate from the rate list at the same full precision", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 1020.123456 });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, amount: 10_000 }} />);
        await press("transfers.field.rateType");

        await press("My rate");
        await press("common.back");

        expect(slotValue("transfers.field.arrives")).toBe("Bs.10,201,234.56");
    });

    it("leaves a picked reference in force when the rate step is opened and left untouched", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.rate");
        for (const key of "900") {
            await press(key);
        }
        await press("Use 900.00");
        await press("transfers.field.rate");
        await press("USD (BCV)");

        await press("transfers.field.rate");
        await press("common.back");

        expect(slotValue("transfers.field.arrives")).toBe("Bs.42,427.50");
        await press("common.next");
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ exchangeRateType: "official", toAmount: 42_427.5 });
    });
});

describe("transfer editor money from another account", () => {
    it("holds a surplus until it came from another account, then saves it at the rate typed", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        mockPriorRate.mockReturnValue({ date: new Date(2026, 8, 27), rate: 957.1 });
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...CROSS, amount: 160 }} />);
        await press("transfers.field.rate");
        await press("Last used · 27 Sep");
        await press("transfers.field.arrives");
        for (const key of "15747166") {
            await press(key);
        }
        expect(screen.getByText("$4.53 more arrived")).toBeTruthy();
        expect(screen.queryByText("It's a fee")).toBeNull();
        expect(screen.queryByLabelText("transfers.save")).toBeNull();
        await press("common.next");
        expect(mockCreate).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.press(screen.getByText("It came from another account"));
        });
        expect(screen.queryByText(/more arrived/)).toBeNull();
        expect(slotValue("transfers.field.outside")).toBe("$4.53");

        await press("transfers.field.outside");
        expect(screen.getByText("$4.53 more arrived")).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText("It came from another account"));
        });

        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            exchangeRate: 957.1,
            exchangeRateType: "custom",
            fromAmount: 160,
            toAmount: 157_471.66,
        });
    });
});

describe("transfer editor arrival", () => {
    it("says what arrives after a fee in one currency, and opens its keypad", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);
        expect(screen.queryByLabelText("transfers.field.arrives")).toBeNull();

        await press("transfers.field.fee");
        await press("2");
        await press("0");
        await press("0");

        expect(screen.getByText("After")).toBeTruthy();
        expect(screen.getByText("arrives.")).toBeTruthy();
        expect(slotValue("transfers.field.arrives")).toBe("$98.00");

        await press("transfers.field.arrives");

        expect(screen.getByText("transfers.field.arrives")).toBeTruthy();
    });

    it("refuses an arrival in one currency that the amount and the fee do not add up to", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={SEED} />);
        await press("transfers.field.fee");
        await press("2");
        await press("0");
        await press("0");
        await press("transfers.field.arrives");
        await press("1");
        await press("5");
        await press("0");
        await press("0");
        await press("0");
        expect(slotValue("transfers.field.arrives")).toBe("$150.00");
        expect(screen.queryByLabelText("transfers.save")).toBeNull();

        await press("common.next");

        expect(mockCreate).not.toHaveBeenCalled();
    });
});

describe("transfer editor conversion", () => {
    beforeEach(() => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
    });

    it("reads Next on the amount, shows the estimate on what arrives, and saves it from there", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        expect(screen.queryByLabelText("transfers.save")).toBeNull();

        await press("common.next");

        expect(mockCreate).not.toHaveBeenCalled();
        expect(screen.getByText("transfers.field.arrives")).toBeTruthy();
        expect(slotValue("transfers.field.arrives")).toBe("Bs.42,427.50");
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ fromAmount: 50, toAmount: 42_427.5 });
    });

    it("routes a save from the bar to what arrives until it has been seen", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await act(async () => {
            DeviceEventEmitter.emit("keyboardWillShow", {});
        });

        await act(async () => {
            screen.getByLabelText("transfers.save").props.onButtonPress();
        });

        expect(mockCreate).not.toHaveBeenCalled();
        expect(screen.getByText("transfers.field.arrives")).toBeTruthy();
    });

    it("saves a reopened conversion without asking again", async () => {
        await render(
            <TransferEditor
                onDone={jest.fn()}
                saved={{
                    ...SAVED,
                    arrived: 42_427.5,
                    rate: 848.55,
                    rateType: "official",
                    toAccountId: "ves",
                    toCurrency: "VES",
                }}
            />
        );

        await press("transfers.save");

        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
});

describe("transfer editor fee on top", () => {
    it("charges a fee on top of the amount sent to the sender", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...SEED, amount: 500 }} />);
        await press("transfers.field.fee");
        await press("transfers.fee.onTop");
        for (const key of "2500") {
            await press(key);
        }

        expect(screen.getByText("Plus")).toBeTruthy();
        expect(screen.getByText("$525.00")).toBeTruthy();
        expect(screen.getByLabelText("Zinli, $500.00, then -$25.00")).toBeTruthy();
        expect(screen.getByLabelText("Mercantil, $500.00, then $1,000.00")).toBeTruthy();
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            fee: { amount: 25, side: "source" },
            fromAmount: 500,
            toAmount: 500,
        });
    });

    it("types a fee charged to the receiver in its currency and takes it from the full conversion", async () => {
        mockRateTables.mockReturnValue({ official: quotedAt(848.55) });
        await render(<TransferEditor onDone={jest.fn()} seed={CROSS} />);
        await press("transfers.field.fee");
        await press("transfers.fee.chargedTo, Zinli");
        await press("transfers.fee.onTop");
        for (const key of "100000") {
            await press(key);
        }

        expect(screen.getByTestId("stage-fee-field").props.accessibilityValue.text).toBe("1000.00 VES");
        expect(slotValue("transfers.field.arrives")).toBe("Bs.42,427.50");
        expect(screen.getByLabelText("Banesco, Bs.500.00, then Bs.41,927.50")).toBeTruthy();
        await press("common.next");
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            fee: { amount: 1000, side: "destination" },
            fromAmount: 50,
            toAmount: 42_427.5,
        });
    });

    it("offers a fee on top when that is what leaves the arrival unexplained", async () => {
        await render(<TransferEditor onDone={jest.fn()} seed={{ ...SEED, amount: 500 }} />);
        await press("transfers.field.fee");
        for (const key of "2500") {
            await press(key);
        }
        await press("transfers.field.arrives");
        for (const key of "50000") {
            await press(key);
        }
        expect(screen.getByText("$25.00 more arrived")).toBeTruthy();
        expect(screen.queryByText("It's a fee")).toBeNull();

        await act(async () => {
            fireEvent.press(screen.getByText("It's on top"));
        });

        expect(screen.queryByText(/ (less|more) arrived/)).toBeNull();
        expect(screen.queryByText("transfers.field.arrives")).toBeNull();
        expect(screen.getByText("transfers.field.sent")).toBeTruthy();
        await press("transfers.save");
        expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
            fee: { amount: 25, side: "source" },
            fromAmount: 500,
            toAmount: 500,
        });
    });
});

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, DeviceEventEmitter } from "react-native";

import type { Account } from "@/data/accounts-core";
import type { SavedTransfer, TransferInput } from "@/data/transfers-core";
import { testColors as mockTestColors } from "@/theme/test-colors";

import TransferEditor from "./index";

const mockAccounts = [
    { currency: "USD", id: "usd", initialBalance: 0, name: "Zinli" } as Account,
    { currency: "USD", id: "usd-2", initialBalance: 0, name: "Mercantil" } as Account,
    { currency: "VES", id: "ves", initialBalance: 0, name: "Banesco" } as Account,
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
            /^(transfers\.(a11y|gap|saved\.title|sentence)(?!\.blank)|transaction\.rate\.)/.test(key)
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
        expect(notice).toMatchObject({ actionLabel: "transfers.saved.another", title: "Moved $100.00 to Mercantil" });
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
        expect(screen.getByText("-$7.34 unaccounted")).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByText("It's a fee"));
        });

        expect(screen.queryByText(/unaccounted/)).toBeNull();
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
        expect(screen.getByText("-$7.34 unaccounted")).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText("It's a fee"));
        });
        expect(screen.queryByText(/unaccounted/)).toBeNull();
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

        expect(screen.getByText("transfers.field.rate")).toBeTruthy();
        expect(screen.getByLabelText("1")).toBeTruthy();
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

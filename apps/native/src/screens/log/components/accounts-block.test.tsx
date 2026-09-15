import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";

import type { Account } from "@/data/accounts-core";
import type { AccountsOverview, OverviewRow } from "@/domain/account-display";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { AccountsBlock } from "./accounts-block";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));

function account(id: string, overrides: Partial<Account> = {}): Account {
    return {
        currency: "USD",
        customColor: null,
        dateCreated: new Date(0),
        deletedAt: null,
        emoji: null,
        icon: "Bank",
        id,
        imageColor: null,
        imageKey: null,
        imageUri: null,
        initialBalance: 0,
        initialBalanceDate: new Date(0),
        initialBalanceUsd: 0,
        kind: "asset",
        name: id,
        sortOrder: 0,
        updatedAt: new Date(0),
        ...overrides,
    };
}

function row(id: string, balance: number, overrides: Partial<OverviewRow> = {}): OverviewRow {
    return { balance, exact: true, id, kind: "asset", multiCurrency: false, ...overrides };
}

function overview(rows: OverviewRow[], overrides: Partial<AccountsOverview> = {}): AccountsOverview {
    const total = rows.reduce((sum, entry) => sum + entry.balance, 0);
    return { count: rows.length, exact: true, owe: 0, own: total, rows, total, ...overrides };
}

const noop = () => {};

/** A press flushes its update here, or the next test starts on a pending one. */
async function press(element: Parameters<typeof fireEvent.press>[0]) {
    await act(async () => {
        fireEvent.press(element);
    });
}

describe("accountsBlock", () => {
    it("renders nothing when there are no accounts", async () => {
        const { toJSON } = await render(
            <AccountsBlock accounts={[]} currency="USD" onOpen={noop} onOpenAll={noop} overview={null} showCents />
        );
        expect(toJSON()).toBeNull();
    });

    it("lists every account with its balance under the count and the total", async () => {
        const { getByText } = await render(
            <AccountsBlock
                accounts={[account("Zinli"), account("Cash")]}
                currency="USD"
                onOpen={noop}
                onOpenAll={noop}
                overview={overview([row("Zinli", 3412.4), row("Cash", 220)])}
                showCents
            />
        );
        getByText("accounts.overview.heading · 2  ›");
        getByText("$3,632.40");
        getByText("Zinli");
        getByText("$3,412.40");
        getByText("Cash");
        getByText("$220.00");
    });

    it("states a liability as owed, positive, where an asset says its currency", async () => {
        const { getByText, queryByText } = await render(
            <AccountsBlock
                accounts={[account("Visa", { kind: "liability" }), account("Zinli")]}
                currency="USD"
                onOpen={noop}
                onOpenAll={noop}
                overview={overview([row("Visa", -200, { kind: "liability" }), row("Zinli", 500)])}
                showCents
            />
        );
        getByText("accounts.overview.owed");
        getByText("$200.00");
        expect(queryByText("-$200.00")).toBeNull();
        getByText("USD");
    });

    it("keeps the minus on an overdrawn asset, which is a problem", async () => {
        const { getAllByText } = await render(
            <AccountsBlock
                accounts={[account("Checking")]}
                currency="USD"
                onOpen={noop}
                onOpenAll={noop}
                overview={overview([row("Checking", -40)])}
                showCents
            />
        );
        // The total repeats the only row's figure, minus included.
        expect(getAllByText("-$40.00")).toHaveLength(2);
    });

    it("gives up a row to the pointer once the ledger is over the cap", async () => {
        const ids = ["a", "b", "c", "d", "e", "f"];
        const onOpenAll = jest.fn();
        const { getByText, queryByText } = await render(
            <AccountsBlock
                accounts={ids.map((id) => account(id))}
                currency="USD"
                onOpen={noop}
                onOpenAll={onOpenAll}
                overview={overview(ids.map((id) => row(id, 1)))}
                showCents
            />
        );
        getByText("a");
        getByText("c");
        expect(queryByText("d")).toBeNull();
        await press(getByText("accounts.overview.more"));
        expect(onOpenAll).toHaveBeenCalledTimes(1);
    });

    it("shows all four rows at the cap, with no pointer", async () => {
        const ids = ["a", "b", "c", "d"];
        const { getByText, queryByText } = await render(
            <AccountsBlock
                accounts={ids.map((id) => account(id))}
                currency="USD"
                onOpen={noop}
                onOpenAll={noop}
                overview={overview(ids.map((id) => row(id, 1)))}
                showCents
            />
        );
        getByText("d");
        expect(queryByText("accounts.overview.more")).toBeNull();
    });

    it("opens the account from its row and the list from the heading", async () => {
        const onOpen = jest.fn();
        const onOpenAll = jest.fn();
        const { getByText } = await render(
            <AccountsBlock
                accounts={[account("Zinli")]}
                currency="USD"
                onOpen={onOpen}
                onOpenAll={onOpenAll}
                overview={overview([row("Zinli", 10)])}
                showCents
            />
        );
        await press(getByText("Zinli"));
        expect(onOpen).toHaveBeenCalledWith("Zinli");
        await press(getByText("accounts.overview.heading · 1  ›"));
        expect(onOpenAll).toHaveBeenCalledTimes(1);
    });

    it("keeps the pointer glyph out of what VoiceOver announces", async () => {
        const { getByTestId } = await render(
            <AccountsBlock
                accounts={[account("Zinli")]}
                currency="USD"
                onOpen={jest.fn()}
                onOpenAll={jest.fn()}
                overview={overview([row("Zinli", 10)])}
                showCents
            />
        );

        const card = getByTestId("accounts-overview-card");
        expect(card.props.accessibilityLabel).toBe("accounts.overview.heading · 1");
        expect(card.props.accessibilityLabel).not.toContain("\u203A");
        expect(card.props.accessibilityValue?.text).toBe("$10.00");
        expect(card.props.accessibilityHint).toBe("accounts.overview.openHint");
    });

    it("marks an approximate row and total with the currency chip", async () => {
        const { toJSON } = await render(
            <AccountsBlock
                accounts={[account("GBP", { currency: "GBP" })]}
                currency="USD"
                onOpen={noop}
                onOpenAll={noop}
                overview={overview([row("GBP", 80, { exact: false })], { exact: false })}
                showCents
            />
        );
        // Counted in the tree rather than queried: the text query's hidden-element
        // check answers differently depending on which test ran before it.
        expect(JSON.stringify(toJSON()).match(/"USD\?"/g)).toHaveLength(2);
    });
});

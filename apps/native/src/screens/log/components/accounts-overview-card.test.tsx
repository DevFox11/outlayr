import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { AccountsOverviewCard } from "./accounts-overview-card";

describe("accountsOverviewCard", () => {
    it("renders nothing when there are no accounts", async () => {
        const { toJSON } = await render(
            <AccountsOverviewCard currency="USD" onPress={() => {}} overview={null} showCents />
        );
        expect(toJSON()).toBeNull();
    });

    it("shows the count and the valued total", async () => {
        const { getByText } = await render(
            <AccountsOverviewCard
                currency="USD"
                onPress={() => {}}
                overview={{ count: 3, exact: true, owe: 0, own: 0, total: 4210.55 }}
                showCents
            />
        );
        getByText("accounts.overview.heading · 3");
        getByText("$4,210.55");
    });

    it("prints a negative total with its sign", async () => {
        const { getByText } = await render(
            <AccountsOverviewCard
                currency="USD"
                onPress={() => {}}
                overview={{ count: 1, exact: true, owe: 0, own: 0, total: -120 }}
                showCents
            />
        );
        getByText("-$120.00");
    });

    it("marks an approximate total with the currency chip", async () => {
        const { getByText, queryByText, rerender } = await render(
            <AccountsOverviewCard
                currency="USD"
                onPress={() => {}}
                overview={{ count: 2, exact: false, owe: 0, own: 0, total: 100 }}
                showCents
            />
        );
        getByText("USD?");

        await rerender(
            <AccountsOverviewCard
                currency="USD"
                onPress={() => {}}
                overview={{ count: 2, exact: true, owe: 0, own: 0, total: 100 }}
                showCents
            />
        );
        expect(queryByText("USD?")).toBeNull();
    });

    it("routes the tap through onPress", async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <AccountsOverviewCard
                currency="USD"
                onPress={onPress}
                overview={{ count: 1, exact: true, owe: 0, own: 0, total: 0 }}
                showCents
            />
        );
        fireEvent.press(getByTestId("accounts-overview-card"));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});

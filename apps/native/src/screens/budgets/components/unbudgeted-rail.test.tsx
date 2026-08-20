import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import type { UnbudgetedScope } from "@/data/budgets";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { UnbudgetedRail } from "./unbudgeted-rail";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));

function scope(name: string, typical: number): UnbudgetedScope {
    return { categoryId: name.toLowerCase(), color: "#c2371b", emoji: null, icon: null, name, typical };
}

describe("the unbudgeted rail", () => {
    it("names each scope with what it typically costs", async () => {
        const { getByText } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={null}
                offerEverything={false}
                onPress={jest.fn()}
                periodPhrase="a month"
                scopes={[scope("Groceries", 372)]}
            />
        );

        expect(getByText("Groceries")).toBeTruthy();
        expect(getByText(/budgets\.rail\.typical.*372.*a month/)).toBeTruthy();
    });

    it("offers at most two, because the rail is a suggestion and not a chore list", async () => {
        const { queryByText } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={null}
                offerEverything={false}
                onPress={jest.fn()}
                periodPhrase="a month"
                scopes={[scope("Groceries", 372), scope("Dining", 288), scope("Transport", 96)]}
            />
        );

        expect(queryByText("Groceries")).toBeTruthy();
        expect(queryByText("Dining")).toBeTruthy();
        expect(queryByText("Transport")).toBeNull();
    });

    it("offers the whole ledger first while no overall budget exists", async () => {
        const onPress = jest.fn();
        const { getByText } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={2410}
                offerEverything
                onPress={onPress}
                periodPhrase="a month"
                scopes={[scope("Groceries", 372)]}
            />
        );

        fireEvent(getByText("budgets.scope.everything"), "click");

        // Null is the whole ledger: it has no category to name.
        expect(onPress).toHaveBeenCalledWith(null);
    });

    it("still offers the whole ledger on a ledger too young to have a typical figure", async () => {
        // The only path left to an overall budget once a category budget exists,
        // so it cannot depend on there being closed windows to average.
        const onPress = jest.fn();
        const { getByText, queryByText } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={null}
                offerEverything
                onPress={onPress}
                periodPhrase="a month"
                scopes={[]}
            />
        );

        expect(getByText("budgets.scope.everything")).toBeTruthy();
        expect(queryByText(/budgets\.rail\.typical/)).toBeNull();
    });

    it("draws nothing at all when everything is budgeted", async () => {
        const { toJSON } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={null}
                offerEverything={false}
                onPress={jest.fn()}
                periodPhrase="a month"
                scopes={[]}
            />
        );

        expect(toJSON()).toBeNull();
    });

    it("hands the whole scope back, so the sheet opens on the row that was pressed", async () => {
        const onPress = jest.fn();
        const groceries = scope("Groceries", 372);
        const { getByText } = await render(
            <UnbudgetedRail
                currency="USD"
                everythingTypical={null}
                offerEverything={false}
                onPress={onPress}
                periodPhrase="a month"
                scopes={[groceries]}
            />
        );

        fireEvent(getByText("Groceries"), "click");

        expect(onPress).toHaveBeenCalledWith(groceries);
    });
});

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionSentenceBody } from "./sentence-body";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

describe("transactionSentenceBody", () => {
    it("shows only the set facts and one add chip at rest, and wakes from either", async () => {
        const onWake = jest.fn();
        const onTags = jest.fn();

        await render(
            <TransactionSentenceBody
                account="Chase"
                amount="$8.35"
                category="Transport"
                categoryFlagged={false}
                categoryPending={false}
                categoryShake={false}
                contentWidth={400}
                extras={[]}
                fee={null}
                labels={{
                    account: { blank: "an account", field: "Account" },
                    amount: { blank: "an amount", field: "Amount" },
                    category: { blank: "a category", field: "Category" },
                    currency: { code: null, field: "Change currency" },
                    fee: { field: "Card fee" },
                    kind: { switchLabel: "Expense or income", verb: "Spent" },
                    merchant: { field: "Name", placeholder: "a merchant" },
                    optional: "Optional",
                    rate: { blank: "a rate", converted: "In dollars", field: "Rate", source: "Rate source" },
                    template: "{kind} {amount} at {merchant} for {category} from {account} {when}.",
                    when: { field: "Date" },
                }}
                merchant="Lyft"
                onAccountPress={jest.fn()}
                onAmountPress={jest.fn()}
                onCategoryPress={jest.fn()}
                onCurrencyPress={jest.fn()}
                onFeePress={jest.fn()}
                onKindPress={jest.fn()}
                onMerchantPress={jest.fn()}
                onWhenPress={jest.fn()}
                rest={{ addAccessibilityLabel: "Add details", addLabel: "add", onWake }}
                verbs={[
                    { active: true, key: "icon", label: "icon", onPress: jest.fn(), onRemove: jest.fn() },
                    { active: true, key: "tags", label: "Rideshare", onPress: onTags },
                    { active: false, key: "split", label: "split", onPress: jest.fn() },
                ]}
                when="today"
            />
        );

        expect(screen.queryByText("icon")).toBeNull();
        expect(screen.queryByText("split")).toBeNull();

        await fireEvent.press(screen.getByText("Rideshare"));
        expect(onTags).toHaveBeenCalledTimes(1);

        await fireEvent.press(screen.getByLabelText("Add details"));
        expect(onWake).toHaveBeenCalledTimes(2);
    });
});

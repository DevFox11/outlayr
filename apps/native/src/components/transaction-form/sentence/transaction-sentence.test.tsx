import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionSentence } from "./transaction-sentence";
import type { TransactionSentenceLabels } from "./transaction-sentence";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

const words = (node: JsonNode | string | null): string[] => {
    if (node === null) {
        return [];
    }
    if (typeof node === "string") {
        return [node];
    }
    return (node.children ?? []).flatMap(words);
};

const labelsFor = (template: string): TransactionSentenceLabels => ({
    account: { blank: "an account", field: "Account" },
    amount: { blank: "an amount", field: "Amount" },
    category: { blank: "a category", field: "Category" },
    currency: { code: "USD", field: "Change currency" },
    fee: { field: "Card fee" },
    kind: { switchLabel: "Expense or income", verb: "Spent" },
    merchant: { field: "Name", placeholder: "a merchant" },
    rate: { blank: "a rate", converted: "In dollars", field: "Rate", source: "Rate source" },
    template,
    when: { field: "Date" },
});

const renderWith = async (template: string) => {
    const { toJSON } = await render(
        <TransactionSentence
            account="Chase"
            activeSlot={null}
            amount="$10.00"
            category="Streaming"
            categoryFlagged={false}
            categoryPending={false}
            categoryShake={false}
            fee={null}
            labels={labelsFor(template)}
            merchant="Netflix"
            onAccountPress={jest.fn()}
            onAmountPress={jest.fn()}
            onCategoryPress={jest.fn()}
            onCurrencyPress={jest.fn()}
            onFeePress={jest.fn()}
            onKindPress={jest.fn()}
            onMerchantPress={jest.fn()}
            onWhenPress={jest.fn()}
            when="today"
        />
    );
    return words(toJSON() as JsonNode);
};

/*
 * The templates here are the shipped strings, copied rather than read out of the
 * catalog: `slots.test.ts` already holds the catalog to the slot set, and what
 * this file is for is proving the RENDERED ORDER follows whichever language is
 * in force. Reading the catalog would make both tests restate the same fact.
 */
const EN = "{kind} {amount} at {merchant} for {category} from {account} {when}.";
const ES = "{kind} {amount} en {merchant} para {category} con {account} {when}.";

describe("transactionSentence", () => {
    it("reads as an English sentence under the English template", async () => {
        await expect(renderWith(EN)).resolves.toStrictEqual([
            "Spent",
            "$10.00",
            "USD",
            "at",
            "Netflix",
            "for",
            "Streaming",
            "from",
            "Chase",
            "today",
            ".",
        ]);
    });

    it("reads as a Spanish sentence under the Spanish template", async () => {
        await expect(renderWith(ES)).resolves.toStrictEqual([
            "Spent",
            "$10.00",
            "USD",
            "en",
            "Netflix",
            "para",
            "Streaming",
            "con",
            "Chase",
            "today",
            ".",
        ]);
    });

    // Nothing about the component tree changed between those two renders. If this
    // ever fails, layout has stopped following the template and gone back to
    // following the code.
    it("puts the account before the category when a language asks for it", async () => {
        await expect(
            renderWith("{kind} {account} pagó {amount} por {category} en {merchant} {when}.")
        ).resolves.toStrictEqual([
            "Spent",
            "Chase",
            "pagó",
            "$10.00",
            "USD",
            "por",
            "Streaming",
            "en",
            "Netflix",
            "today",
            ".",
        ]);
    });

    it("exposes each picked fact's value and pending state to assistive technology", async () => {
        const screen = await render(
            <TransactionSentence
                account="Chase"
                activeSlot={null}
                amount="$10.00"
                category="Streaming"
                categoryFlagged={false}
                categoryPending
                categoryShake={false}
                fee={null}
                labels={labelsFor(EN)}
                merchant="Netflix"
                onAccountPress={jest.fn()}
                onAmountPress={jest.fn()}
                onCategoryPress={jest.fn()}
                onCurrencyPress={jest.fn()}
                onFeePress={jest.fn()}
                onKindPress={jest.fn()}
                onMerchantPress={jest.fn()}
                onWhenPress={jest.fn()}
                when="today"
            />
        );

        expect(screen.getByLabelText("Amount").props.accessibilityValue).toMatchObject({ text: "$10.00" });
        expect(screen.getByLabelText("Category").props.accessibilityState).toMatchObject({ busy: true });
        expect(screen.getByLabelText("Category").props.accessibilityValue).toMatchObject({ text: "Streaming" });
    });

    // The merchant used to be an inline field whose visible glyphs were a `Text`
    // laid over it and hidden from assistive technology, so the input could carry
    // the label alone. It is an ordinary slot now, so it announces itself.
    it("announces both a blank's visible value and a filled merchant's", async () => {
        const screen = await render(
            <TransactionSentence
                account={null}
                activeSlot={null}
                amount={null}
                category={null}
                categoryFlagged={false}
                categoryPending={false}
                categoryShake={false}
                fee={null}
                labels={labelsFor(EN)}
                merchant="Netflix"
                onAccountPress={jest.fn()}
                onAmountPress={jest.fn()}
                onCategoryPress={jest.fn()}
                onCurrencyPress={jest.fn()}
                onFeePress={jest.fn()}
                onKindPress={jest.fn()}
                onMerchantPress={jest.fn()}
                onWhenPress={jest.fn()}
                when="today"
            />
        );

        expect(screen.getByLabelText("Category").props.accessibilityValue).toMatchObject({ text: "a category" });
        expect(screen.getByLabelText("Name").props.accessibilityValue).toMatchObject({ text: "Netflix" });
    });

    it("appends the rate clause with its source, rate and dollar value as facts to tap", async () => {
        const onRatePress = jest.fn();
        const screen = await render(
            <TransactionSentence
                account="Banesco"
                activeSlot="rate"
                amount="Bs.15,000.00"
                category="Health"
                categoryFlagged={false}
                categoryPending={false}
                categoryShake={false}
                fee={null}
                labels={labelsFor(EN)}
                merchant="Farmatodo"
                onAccountPress={jest.fn()}
                onAmountPress={jest.fn()}
                onCategoryPress={jest.fn()}
                onCurrencyPress={jest.fn()}
                onFeePress={jest.fn()}
                onKindPress={jest.fn()}
                onMerchantPress={jest.fn()}
                onWhenPress={jest.fn()}
                rate={{
                    converted: { amount: 17.68, text: "$17.68" },
                    flagged: false,
                    onConvertedPress: jest.fn(),
                    onRatePress,
                    onSourcePress: jest.fn(),
                    rate: "848.55 Bs. per $",
                    shake: false,
                    source: "official",
                    template: "At the {rateSource} rate, {rate}, that's {converted}.",
                }}
                when="today"
            />
        );

        expect(screen.getByLabelText("Rate source").props.accessibilityValue).toMatchObject({ text: "official" });
        expect(screen.getByLabelText("In dollars").props.accessibilityValue).toMatchObject({ text: "$17.68" });
        await fireEvent.press(screen.getByLabelText("Rate"));
        expect(onRatePress).toHaveBeenCalledTimes(1);
    });

    it("asks for a rate instead of stating dollars it does not have", async () => {
        const screen = await render(
            <TransactionSentence
                account="Banesco"
                activeSlot={null}
                amount="Bs.15,000.00"
                category="Health"
                categoryFlagged={false}
                categoryPending={false}
                categoryShake={false}
                fee={null}
                labels={labelsFor(EN)}
                merchant="Farmatodo"
                onAccountPress={jest.fn()}
                onAmountPress={jest.fn()}
                onCategoryPress={jest.fn()}
                onCurrencyPress={jest.fn()}
                onFeePress={jest.fn()}
                onKindPress={jest.fn()}
                onMerchantPress={jest.fn()}
                onWhenPress={jest.fn()}
                rate={{
                    converted: null,
                    flagged: true,
                    onConvertedPress: jest.fn(),
                    onRatePress: jest.fn(),
                    onSourcePress: jest.fn(),
                    rate: null,
                    shake: false,
                    source: "my",
                    template: "It counts in dollars once it has {rate}.",
                }}
                when="today"
            />
        );

        expect(screen.getByLabelText("Rate").props.accessibilityValue).toMatchObject({ text: "a rate" });
        expect(screen.queryByLabelText("In dollars")).toBeNull();
    });
});

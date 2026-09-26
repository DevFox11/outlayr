import type { ReactNode } from "react";
import { View } from "react-native";

import { Sentence } from "../../sentence/sentence";
import { SentenceBlank } from "../../sentence/sentence-blank";
import { SentenceToggle } from "../../sentence/sentence-toggle";
import { SentenceValue } from "../../sentence/sentence-value";
import type { SentenceFigure } from "../../sentence/sentence-value";
import { CurrencyCode } from "./currency-code";
import type { TransactionRateSlot, TransactionSentenceMark, TransactionSentenceSlot } from "./slots";

export interface TransactionSentenceLabels {
    account: { blank: string; field: string };
    amount: { blank: string; field: string };
    category: { blank: string; field: string };
    currency: { code: string; field: string };
    fee: { field: string };
    kind: { switchLabel: string; verb: string };
    merchant: { field: string; placeholder: string };
    rate: { blank: string; converted: string; field: string; source: string };
    template: string;
    when: { field: string };
}

export interface TransactionRateClause {
    converted: { amount: number; text: string } | null;
    flagged: boolean;
    onConvertedPress: () => void;
    onRatePress: () => void;
    onSourcePress: () => void;
    rate: string | null;
    shake: boolean;
    source: string;
    template: string;
}

interface TransactionSentenceProps {
    account: string | null;
    accountTile?: ReactNode;
    /**
     * The slot the stage below is editing. The primitives draw the wash; this
     * only says which one of them is being edited.
     */
    activeSlot: TransactionSentenceMark | null;
    amount: string | null;
    /**
     * The amount can hold the save back as readily as the category, and a
     * filled one can be the fault: zero is a value, not a blank.
     */
    amountFigure?: SentenceFigure;
    amountFlagged?: boolean;
    amountShake?: boolean;
    category: string | null;
    /** The category is the one blank that can hold the save back. */
    categoryFlagged: boolean;
    categoryPending: boolean;
    /** Answers a save rejected for want of a category. */
    categoryShake: boolean;
    categoryTile?: ReactNode;
    fee: string | null;
    labels: TransactionSentenceLabels;
    /** The name as entered, or null while the slot is still empty. */
    merchant: string | null;
    merchantTile?: ReactNode;
    onAccountPress: () => void;
    onAmountPress: () => void;
    onCategoryPress: () => void;
    onCurrencyPress: () => void;
    onFeePress: () => void;
    onKindPress: () => void;
    onMerchantPress: () => void;
    onWhenPress: () => void;
    rate?: TransactionRateClause;
    when: string;
}

/**
 * The entry, stated as one sentence. Every fact is a tap target and the
 * template decides where each one sits, so this component names the slots but
 * never their order.
 */
export function TransactionSentence({
    account,
    accountTile,
    activeSlot,
    amount,
    amountFigure,
    amountFlagged,
    amountShake,
    category,
    categoryFlagged,
    categoryPending,
    categoryShake,
    categoryTile,
    fee,
    labels,
    merchant,
    merchantTile,
    onAccountPress,
    onAmountPress,
    onCategoryPress,
    onCurrencyPress,
    onFeePress,
    onKindPress,
    onMerchantPress,
    onWhenPress,
    rate,
    when,
}: TransactionSentenceProps) {
    let rateFill: ReactNode = null;
    if (rate?.rate === null) {
        rateFill = (
            <SentenceBlank
                accessibilityLabel={labels.rate.field}
                active={activeSlot === "rate"}
                flagged={rate.flagged}
                label={labels.rate.blank}
                onPress={rate.onRatePress}
                shake={rate.shake}
            />
        );
    } else if (rate !== undefined) {
        rateFill = (
            <SentenceValue
                accessibilityLabel={labels.rate.field}
                active={activeSlot === "rate"}
                flagged={rate.flagged}
                onPress={rate.onRatePress}
                shake={rate.shake}
                swapKey="rate"
                value={rate.rate}
            />
        );
    }

    return (
        <Sentence<TransactionRateSlot | TransactionSentenceSlot>
            slots={{
                account:
                    account === null ? (
                        <SentenceBlank
                            accessibilityLabel={labels.account.field}
                            active={activeSlot === "account"}
                            label={labels.account.blank}
                            onPress={onAccountPress}
                        />
                    ) : (
                        <SentenceValue
                            accessibilityLabel={labels.account.field}
                            active={activeSlot === "account"}
                            onPress={onAccountPress}
                            value={account}
                        >
                            {accountTile}
                        </SentenceValue>
                    ),
                amount: (
                    <View className="flex-row items-baseline gap-1.5">
                        {amount === null ? (
                            <SentenceBlank
                                accessibilityLabel={labels.amount.field}
                                active={activeSlot === "amount"}
                                flagged={amountFlagged}
                                label={labels.amount.blank}
                                onPress={onAmountPress}
                                shake={amountShake}
                            />
                        ) : (
                            <SentenceValue
                                accessibilityLabel={labels.amount.field}
                                active={activeSlot === "amount"}
                                figure={amountFigure}
                                flagged={amountFlagged}
                                onPress={onAmountPress}
                                shake={amountShake}
                                swapKey="amount"
                                value={amount}
                            />
                        )}
                        <CurrencyCode
                            accessibilityLabel={labels.currency.field}
                            code={labels.currency.code}
                            onPress={onCurrencyPress}
                        />
                        {fee === null ? null : (
                            <SentenceValue
                                accessibilityLabel={labels.fee.field}
                                active={activeSlot === "fee"}
                                onPress={onFeePress}
                                swapKey="fee"
                                value={fee}
                            />
                        )}
                    </View>
                ),
                category:
                    category === null ? (
                        <SentenceBlank
                            accessibilityLabel={labels.category.field}
                            active={activeSlot === "category"}
                            flagged={categoryFlagged}
                            label={labels.category.blank}
                            onPress={onCategoryPress}
                            shake={categoryShake}
                        />
                    ) : (
                        <SentenceValue
                            accessibilityLabel={labels.category.field}
                            active={activeSlot === "category"}
                            flagged={categoryFlagged}
                            onPress={onCategoryPress}
                            pending={categoryPending}
                            shake={categoryShake}
                            value={category}
                        >
                            {categoryTile}
                        </SentenceValue>
                    ),
                converted:
                    rate?.converted == null ? null : (
                        <SentenceValue
                            accessibilityLabel={labels.rate.converted}
                            active={activeSlot === "converted"}
                            figure={{ amount: rate.converted.amount, code: "USD" }}
                            onPress={rate.onConvertedPress}
                            swapKey="converted"
                            value={rate.converted.text}
                        />
                    ),
                kind: (
                    <SentenceToggle
                        accessibilityLabel={labels.kind.switchLabel}
                        onPress={onKindPress}
                        value={labels.kind.verb}
                    />
                ),
                // A tap target like every other slot rather than an inline field.
                // It used to be a `TextInput` with a `Text` laid over it to fix its
                // baseline, and the stage's merchant step now owns typing — so the
                // sentence states the name and the stage takes it, which is what
                // every other fact here already does.
                merchant:
                    merchant === null ? (
                        <SentenceBlank
                            accessibilityLabel={labels.merchant.field}
                            active={activeSlot === "merchant"}
                            label={labels.merchant.placeholder}
                            onPress={onMerchantPress}
                        />
                    ) : (
                        <SentenceValue
                            accessibilityLabel={labels.merchant.field}
                            active={activeSlot === "merchant"}
                            onPress={onMerchantPress}
                            value={merchant}
                        >
                            {merchantTile}
                        </SentenceValue>
                    ),
                rate: rateFill,
                rateSource:
                    rate === undefined ? null : (
                        <SentenceValue
                            accessibilityLabel={labels.rate.source}
                            active={activeSlot === "rateSource"}
                            onPress={rate.onSourcePress}
                            value={rate.source}
                        />
                    ),
                when: (
                    <SentenceValue
                        accessibilityLabel={labels.when.field}
                        active={activeSlot === "when"}
                        onPress={onWhenPress}
                        value={when}
                    />
                ),
            }}
            template={rate === undefined ? labels.template : `${labels.template} ${rate.template}`}
        />
    );
}

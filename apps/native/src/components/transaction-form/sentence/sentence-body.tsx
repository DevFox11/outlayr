import type { ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { revealEntering } from "../../sentence/sentence-motion";
import type { SentenceFigure } from "../../sentence/sentence-value";
import { FactChips } from "./fact-chips";
import type { SentenceFactKey, SentenceVerb } from "./fact-glyphs";
import type { TransactionSentenceMark } from "./slots";
import { TransactionSentence } from "./transaction-sentence";
import type {
    TransactionPaidViaClause,
    TransactionRateClause,
    TransactionSentenceLabels,
} from "./transaction-sentence";

const REST_FACTS: ReadonlySet<SentenceFactKey> = new Set(["repeat", "tags"]);

interface SentenceBodyProps {
    account: string | null;
    accountTile?: ReactNode;
    /** The slot the stage below is editing, marked in place. */
    activeSlot?: TransactionSentenceMark | null;
    amount: string | null;
    amountFigure?: SentenceFigure;
    /**
     * The amount can hold the save back as readily as the category, and a
     * filled one can be the fault: zero is a value, not a blank.
     */
    amountFlagged?: boolean;
    amountShake?: boolean;
    category: string | null;
    categoryFlagged: boolean;
    categoryPending: boolean;
    categoryShake: boolean;
    categoryTile?: ReactNode;
    /**
     * `RNHostView matchContents` resolves an unconstrained child against the
     * SCREEN rather than the padded parent, so the sentence has to be told the
     * box it wraps inside or it bleeds past the form's margins.
     */
    contentWidth: number;
    feeLine?: ReactNode;
    /** Short clauses for anything the sentence itself does not carry. */
    extras: readonly string[];
    fee: string | null;
    labels: TransactionSentenceLabels;
    merchant: string | null;
    merchantTile?: ReactNode;
    onAccountPress: () => void;
    /** The first-run line, drawn between the sentence and the chips. */
    coach?: ReactNode;
    onAmountPress: () => void;
    onCategoryPress: () => void;
    onCurrencyPress: () => void;
    onFeePress: () => void;
    onKindPress: () => void;
    onLayout?: (height: number) => void;
    onMerchantPress: () => void;
    onWhenPress: () => void;
    paidVia?: TransactionPaidViaClause;
    rate?: TransactionRateClause;
    rest?: { addAccessibilityLabel: string; addLabel: string; onWake: () => void };
    verbs: readonly SentenceVerb[];
    when: string;
}

export function TransactionSentenceBody({
    account,
    accountTile,
    activeSlot = null,
    amount,
    amountFigure,
    amountFlagged,
    amountShake,
    category,
    categoryFlagged,
    categoryPending,
    categoryShake,
    categoryTile,
    coach,
    contentWidth,
    extras,
    fee,
    feeLine,
    labels,
    merchant,
    merchantTile,
    onAccountPress,
    onAmountPress,
    onCategoryPress,
    onCurrencyPress,
    onFeePress,
    onKindPress,
    onLayout,
    onMerchantPress,
    onWhenPress,
    paidVia,
    rate,
    rest,
    verbs,
    when,
}: SentenceBodyProps) {
    const chips: readonly SentenceVerb[] =
        rest === undefined
            ? verbs
            : [
                  ...verbs
                      .filter((verb) => verb.active && REST_FACTS.has(verb.key))
                      .map((verb) => ({
                          ...verb,
                          onPress: () => {
                              rest.onWake();
                              verb.onPress();
                          },
                          onRemove: undefined,
                      })),
                  {
                      accessibilityLabel: rest.addAccessibilityLabel,
                      active: false,
                      key: "add",
                      label: rest.addLabel,
                      onPress: rest.onWake,
                  },
              ];

    // `pt-8`: the sentence opens the screen now that the segment above it is gone,
    // so it carries its own distance from the header rather than inheriting the
    // bar's bottom margin.
    return (
        <View
            className="pt-8"
            onLayout={(event) => onLayout?.(event.nativeEvent.layout.height)}
            style={{ width: contentWidth }}
        >
            <TransactionSentence
                account={account}
                accountTile={accountTile}
                activeSlot={activeSlot}
                amount={amount}
                amountFigure={amountFigure}
                amountFlagged={amountFlagged}
                amountShake={amountShake}
                category={category}
                categoryFlagged={categoryFlagged}
                categoryPending={categoryPending}
                categoryShake={categoryShake}
                categoryTile={categoryTile}
                fee={fee}
                labels={labels}
                merchant={merchant}
                merchantTile={merchantTile}
                onAccountPress={onAccountPress}
                onAmountPress={onAmountPress}
                onCategoryPress={onCategoryPress}
                onCurrencyPress={onCurrencyPress}
                onFeePress={onFeePress}
                onKindPress={onKindPress}
                onMerchantPress={onMerchantPress}
                onWhenPress={onWhenPress}
                paidVia={paidVia}
                rate={rate}
                when={when}
            />

            {feeLine === undefined ? null : (
                <Animated.View className="mt-5" entering={revealEntering()}>
                    {feeLine}
                </Animated.View>
            )}

            {extras.length > 0 ? (
                <View className="mt-5 gap-1">
                    {extras.map((extra) => (
                        <Animated.Text className="text-muted text-subtitle" entering={revealEntering()} key={extra}>
                            {extra}
                        </Animated.Text>
                    ))}
                </View>
            ) : null}

            {coach === undefined ? null : (
                <Animated.View className="mt-5" entering={revealEntering()}>
                    {coach}
                </Animated.View>
            )}

            <FactChips chips={chips} />
        </View>
    );
}

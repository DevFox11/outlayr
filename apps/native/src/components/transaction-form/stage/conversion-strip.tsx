import { Pressable } from "react-native";

import { formatAmount } from "@/domain/money";
import { formatQuotedRate, transactionRateOptions } from "@/domain/transaction-entry-rate";
import type { Language } from "@/i18n/languages";

import { MetaLine } from "./meta-line";

interface ConversionStripLabels {
    /** Statement while nothing is converted, e.g. "Not converted". */
    notConverted: string;
    /**
     * Mono sub-line while nothing is converted: the native amount is the fact and
     * is already recorded, so only cross-currency totals are waiting.
     */
    pendingBody: string;
    /** Right-hand qualifier while nothing is converted, e.g. "Set a rate". */
    setRate: string;
}

interface ConversionStripRate {
    /** Display name of what produced the rate: Official, EUR reference, Custom. */
    source: string;
    value: number;
}

export interface ConversionStripProps {
    /** Entry amount, in `currency`. */
    amount: number;
    /**
     * USD value of `amount` at the rate in force. Null until a rate is confirmed —
     * never derived here, because `eur_reference` is two-legged and its EUR leg is
     * resolved against the provider, not against `rate`.
     */
    amountUsd: number | null;
    currency: string;
    labels: ConversionStripLabels;
    language: Language;
    /** Opens the rate step. The whole strip is the target. */
    onPress: () => void;
    rate: ConversionStripRate | null;
}

/**
 * The readout beneath the sentence. `transactionRateOptions` is the single answer
 * to whether a currency converts at all: it is empty for USD, which has no rate to
 * state and so no strip.
 */
export function ConversionStrip({
    amount,
    amountUsd,
    currency,
    labels,
    language,
    onPress,
    rate,
}: ConversionStripProps) {
    if (transactionRateOptions(currency).length === 0) {
        return null;
    }

    const readout =
        rate === null || amountUsd === null
            ? null
            : {
                  qualifier: `${rate.source} · ${formatQuotedRate(currency, rate.value)}`,
                  statement: `${formatAmount(amount, currency, true, language)} = ${formatAmount(amountUsd, "USD", true, language)}`,
              };

    const statement = readout === null ? labels.notConverted : readout.statement;
    const qualifier = readout === null ? labels.setRate : readout.qualifier;

    return (
        // The hint carries the pending sentence because a Pressable collapses its
        // subtree in the accessibility tree: MetaLine's own `alert` role is
        // unreachable from out here, so an unconfirmed rate would otherwise be
        // announced as a bare button with no hint that anything is outstanding.
        <Pressable
            accessibilityHint={readout === null ? labels.pendingBody : undefined}
            accessibilityLabel={`${statement} · ${qualifier}`}
            accessibilityRole="button"
            onPress={onPress}
            testID="conversion-strip"
        >
            <MetaLine
                qualifier={qualifier}
                statement={statement}
                detail={readout === null ? labels.pendingBody : undefined}
                tone={readout === null ? "warning" : "muted"}
            />
        </Pressable>
    );
}

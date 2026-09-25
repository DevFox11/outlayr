import { Sentence } from "@/components/sentence/sentence";
import { SentenceBlank } from "@/components/sentence/sentence-blank";
import { SentenceValue } from "@/components/sentence/sentence-value";
import { useTranslation } from "@/i18n/context";

export const TRANSFER_SENTENCE_SLOTS = [
    "amount",
    "arrives",
    "fee",
    "feeSide",
    "from",
    "rate",
    "rateType",
    "to",
    "when",
] as const;

export type TransferSentenceSlot = (typeof TRANSFER_SENTENCE_SLOTS)[number];

export const TRANSFER_SENTENCE_KEYS = [
    "transfers.sentence.move",
    "transfers.sentence.rate",
    "transfers.sentence.fee",
    "transfers.sentence.noFee",
] as const;

export type TransferSentenceValues = Readonly<Record<TransferSentenceSlot, string | null>>;

interface TransferSentenceProps {
    activeSlot: TransferSentenceSlot | null;
    crossCurrency: boolean;
    flaggedSlot: TransferSentenceSlot | null;
    hasFee: boolean;
    onSlotPress: (slot: TransferSentenceSlot) => void;
    values: TransferSentenceValues;
}

export function TransferSentence({
    activeSlot,
    crossCurrency,
    flaggedSlot,
    hasFee,
    onSlotPress,
    values,
}: TransferSentenceProps) {
    const t = useTranslation();

    const labels = {
        amount: t("transfers.field.sent"),
        arrives: t("transfers.field.arrives"),
        fee: t("transfers.field.fee"),
        feeSide: t("transfers.field.feeSide"),
        from: t("transfers.field.from"),
        rate: t("transfers.field.rate"),
        rateType: t("transfers.field.rateType"),
        to: t("transfers.field.to"),
        when: t("transfers.field.date"),
    } satisfies Record<TransferSentenceSlot, string>;

    const blanks = {
        amount: t("transfers.sentence.blank.amount"),
        arrives: t("transfers.sentence.blank.amount"),
        fee: t("transfers.sentence.blank.noFee"),
        feeSide: t("transfers.sentence.blank.account"),
        from: t("transfers.sentence.blank.account"),
        rate: t("transfers.sentence.blank.rate"),
        rateType: t("transfers.sentence.blank.rate"),
        to: t("transfers.sentence.blank.account"),
        when: t("transfers.field.date"),
    } satisfies Record<TransferSentenceSlot, string>;

    const part = (slot: TransferSentenceSlot) => {
        const value = values[slot];
        const shared = {
            accessibilityLabel: labels[slot],
            active: activeSlot === slot,
            flagged: flaggedSlot === slot,
            onPress: () => onSlotPress(slot),
            shake: flaggedSlot === slot,
        };
        return value === null ? (
            <SentenceBlank {...shared} label={blanks[slot]} />
        ) : (
            <SentenceValue {...shared} swapKey={slot} value={value} />
        );
    };

    const template = [
        t("transfers.sentence.move"),
        crossCurrency ? t("transfers.sentence.rate") : null,
        t(hasFee ? "transfers.sentence.fee" : "transfers.sentence.noFee"),
    ]
        .filter((clause) => clause !== null)
        .join(" ");

    return (
        <Sentence
            slots={{
                amount: part("amount"),
                arrives: part("arrives"),
                fee: part("fee"),
                feeSide: part("feeSide"),
                from: part("from"),
                rate: part("rate"),
                rateType: part("rateType"),
                to: part("to"),
                when: part("when"),
            }}
            template={template}
        />
    );
}
